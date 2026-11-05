import type { MailService, Progress, ScanOptions, Sender, UnsubscribeResult } from "../types";
import { groupBySender, type MessageMeta } from "./aggregate";
import { buildRawEmail } from "./headers";
import { mapWithConcurrency, sleep } from "./pool";

const API = "https://gmail.googleapis.com/gmail/v1/users/me";
const METADATA_HEADERS = ["From", "Subject", "List-Unsubscribe", "List-Unsubscribe-Post"];
// Gmail allows 250 quota units per user per second, and messages.get/trash cost 5,
// so at most ~50 calls a second. We start one request every 30 ms (~33/s) to stay
// safely under it, and keep a few in flight to hide network latency.
const CONCURRENCY = 6;
const MIN_REQUEST_GAP_MS = 30;
const MAX_RETRIES = 6;
const LIST_PAGE_SIZE = 500;
// Gmail reports per-user rate limits as 429 *or* as 403 with one of these reasons.
const RATE_LIMIT_REASONS = new Set(["rateLimitExceeded", "userRateLimitExceeded"]);

export class AuthExpiredError extends Error {
  constructor() {
    super("Your Google session expired. Please sign in again.");
    this.name = "AuthExpiredError";
  }
}

export class GmailApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "GmailApiError";
    this.status = status;
  }
}

interface ListResponse {
  messages?: { id: string }[];
  nextPageToken?: string;
}

interface MessageResponse {
  id: string;
  labelIds?: string[];
  internalDate: string;
  payload?: { headers?: { name: string; value: string }[] };
}

export class GmailService implements MailService {
  readonly isDemo = false;
  private readonly accessToken: string;
  /** Earliest time the next request may start (simple client-side rate limiter). */
  private nextRequestAt = 0;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  async getAccountEmail(): Promise<string> {
    const profile = await this.request<{ emailAddress: string }>("/profile");
    return profile.emailAddress;
  }

  async scan(options: ScanOptions, onProgress: (p: Progress) => void): Promise<Sender[]> {
    const query = options.promotionsOnly ? "category:promotions" : "-in:sent -in:drafts -in:chats";
    const ids = await this.listMessageIds(query, options.limit);
    onProgress({ done: 0, total: ids.length });

    const messages = await mapWithConcurrency(
      ids,
      CONCURRENCY,
      (id) => this.getMessageMeta(id),
      (done) => onProgress({ done, total: ids.length }),
    );
    return groupBySender(messages.filter((m): m is MessageMeta => m !== null));
  }

  async trashMessages(ids: string[], onProgress: (p: Progress) => void): Promise<number> {
    onProgress({ done: 0, total: ids.length });
    const results = await mapWithConcurrency(
      ids,
      CONCURRENCY,
      async (id) => {
        try {
          await this.request(`/messages/${id}/trash`, { method: "POST" });
          return true;
        } catch (error) {
          // Already deleted elsewhere: nothing left to do.
          if (error instanceof GmailApiError && error.status === 404) return true;
          if (error instanceof AuthExpiredError) throw error;
          return false;
        }
      },
      (done) => onProgress({ done, total: ids.length }),
    );
    return results.filter(Boolean).length;
  }

  async unsubscribe(sender: Sender): Promise<UnsubscribeResult> {
    const info = sender.unsubscribe;
    if (!info) throw new Error(`${sender.name} does not offer an unsubscribe link.`);

    // A web page must be opened synchronously inside the click, or the popup blocker stops it.
    if (!info.oneClickUrl && !info.mailto && info.httpUrl) {
      window.open(info.httpUrl, "_blank", "noopener,noreferrer");
      return { method: "web-page", needsUserAction: true };
    }

    if (info.oneClickUrl) {
      // RFC 8058 one-click unsubscribe. The sender's server does not allow us to read
      // the response (CORS), so "no-cors" sends the request without reading the reply.
      await fetch(info.oneClickUrl, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: "List-Unsubscribe=One-Click",
      });
      return { method: "one-click", needsUserAction: false };
    }

    const { to, subject, body } = info.mailto!;
    await this.request("/messages/send", {
      method: "POST",
      body: JSON.stringify({ raw: buildRawEmail(to, subject, body) }),
    });
    return { method: "email", needsUserAction: false };
  }

  async blockSender(email: string): Promise<void> {
    try {
      await this.request("/settings/filters", {
        method: "POST",
        body: JSON.stringify({
          criteria: { from: email },
          action: { addLabelIds: ["TRASH"], removeLabelIds: ["INBOX"] },
        }),
      });
    } catch (error) {
      // Gmail answers 400 "Filter already exists" when it is already blocked.
      if (error instanceof GmailApiError && /already exists/i.test(error.message)) return;
      throw error;
    }
  }

  private async listMessageIds(query: string, limit: number): Promise<string[]> {
    const ids: string[] = [];
    let pageToken: string | undefined;
    do {
      const params = new URLSearchParams({
        q: query,
        maxResults: String(Math.min(LIST_PAGE_SIZE, limit - ids.length)),
      });
      if (pageToken) params.set("pageToken", pageToken);
      const page = await this.request<ListResponse>(`/messages?${params}`);
      ids.push(...(page.messages ?? []).map((m) => m.id));
      pageToken = page.nextPageToken;
    } while (pageToken && ids.length < limit);
    return ids;
  }

  private async getMessageMeta(id: string): Promise<MessageMeta | null> {
    const params = new URLSearchParams({ format: "metadata" });
    for (const header of METADATA_HEADERS) params.append("metadataHeaders", header);
    try {
      const message = await this.request<MessageResponse>(`/messages/${id}?${params}`);
      const headers = new Map(
        (message.payload?.headers ?? []).map((h) => [h.name.toLowerCase(), h.value]),
      );
      return {
        id: message.id,
        labelIds: message.labelIds ?? [],
        internalDate: Number(message.internalDate),
        from: headers.get("from") ?? "",
        subject: headers.get("subject") ?? "(no subject)",
        listUnsubscribe: headers.get("list-unsubscribe"),
        listUnsubscribePost: headers.get("list-unsubscribe-post"),
      };
    } catch (error) {
      // A message that was deleted mid-scan, or that keeps failing after all
      // retries, is skipped so one bad message never sinks the whole scan.
      if (error instanceof GmailApiError) return null;
      throw error;
    }
  }

  /** Waits for this request's turn so we never burst past Gmail's per-user quota. */
  private async throttle(): Promise<void> {
    const now = Date.now();
    const startAt = Math.max(now, this.nextRequestAt);
    this.nextRequestAt = startAt + MIN_REQUEST_GAP_MS;
    if (startAt > now) await sleep(startAt - now);
  }

  /** Calls the Gmail API, retrying rate limits and server errors with backoff. */
  private async request<T = unknown>(path: string, init: RequestInit = {}, attempt = 0): Promise<T> {
    await this.throttle();
    const response = await fetch(`${API}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...init.headers,
      },
    });

    if (response.ok) {
      const text = await response.text();
      return (text ? JSON.parse(text) : {}) as T;
    }
    if (response.status === 401) throw new AuthExpiredError();

    const error = await readError(response);
    if (isRetryable(response.status, error.reasons) && attempt < MAX_RETRIES) {
      // Exponential backoff with jitter: ~1s, 2s, 4s… capped at 30s, or what Gmail asks for.
      const retryAfter = Number(response.headers.get("Retry-After")) * 1000;
      const backoff = Math.min(2 ** attempt * 1000, 30_000) + Math.random() * 500;
      await sleep(retryAfter > 0 ? retryAfter : backoff);
      return this.request<T>(path, init, attempt + 1);
    }
    throw new GmailApiError(response.status, error.message);
  }
}

interface ApiError {
  message: string;
  reasons: string[];
}

async function readError(response: Response): Promise<ApiError> {
  const fallback = `Gmail request failed (${response.status})`;
  try {
    const body = (await response.json()) as {
      error?: { message?: string; errors?: { reason?: string }[] };
    };
    return {
      message: body.error?.message || fallback,
      reasons: (body.error?.errors ?? []).map((e) => e.reason ?? ""),
    };
  } catch {
    return { message: fallback, reasons: [] };
  }
}

export function isRetryable(status: number, reasons: string[]): boolean {
  if (status === 429 || status >= 500) return true;
  return status === 403 && reasons.some((r) => RATE_LIMIT_REASONS.has(r));
}
