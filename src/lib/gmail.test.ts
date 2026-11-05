import { afterEach, describe, expect, it, vi } from "vitest";
import { GmailService, isRetryable } from "./gmail";
import { mapWithConcurrency } from "./pool";

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const rateLimited = () =>
  json(403, { error: { message: "User-rate limit exceeded", errors: [{ reason: "userRateLimitExceeded" }] } });

const message = (id: string) =>
  json(200, {
    id,
    internalDate: "1700000000000",
    labelIds: ["INBOX"],
    payload: { headers: [{ name: "From", value: "Shop <shop@x.example>" }, { name: "Subject", value: "Sale" }] },
  });

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("isRetryable", () => {
  it("retries 429, 5xx and 403 rate limits only", () => {
    expect(isRetryable(429, [])).toBe(true);
    expect(isRetryable(503, [])).toBe(true);
    expect(isRetryable(403, ["userRateLimitExceeded"])).toBe(true);
    expect(isRetryable(403, ["rateLimitExceeded"])).toBe(true);
    expect(isRetryable(403, ["insufficientPermissions"])).toBe(false);
    expect(isRetryable(400, [])).toBe(false);
  });
});

describe("GmailService.scan", () => {
  it("recovers from a 403 rate limit instead of failing the whole scan", async () => {
    vi.useFakeTimers();
    let firstGet = true;
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/messages?")) return json(200, { messages: [{ id: "a" }, { id: "b" }] });
      if (url.includes("/messages/a") && firstGet) {
        firstGet = false;
        return rateLimited();
      }
      return message(url.includes("/messages/a") ? "a" : "b");
    });

    const scan = new GmailService("token").scan({ limit: 10, promotionsOnly: false }, () => undefined);
    await vi.runAllTimersAsync();
    const senders = await scan;

    expect(senders).toHaveLength(1);
    expect(senders[0].messageIds.sort()).toEqual(["a", "b"]);
  });

  it("skips a message that keeps failing with a non-retryable error", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/messages?")) return json(200, { messages: [{ id: "ok" }, { id: "bad" }] });
      if (url.includes("/messages/bad")) return json(400, { error: { message: "Invalid id" } });
      return message("ok");
    });

    const senders = await new GmailService("token").scan({ limit: 10, promotionsOnly: false }, () => undefined);
    expect(senders[0].messageIds).toEqual(["ok"]);
  });
});

describe("mapWithConcurrency after a failure", () => {
  it("stops starting new work and stops reporting progress", async () => {
    const events: string[] = [];
    await expect(
      mapWithConcurrency(
        [1, 2, 3, 4, 5, 6, 7, 8],
        2,
        async (n) => {
          events.push(`start ${n}`);
          await new Promise((r) => setTimeout(r, n === 2 ? 3 : 10));
          if (n === 2) {
            events.push("failed");
            throw new Error("boom");
          }
          return n;
        },
        (done) => events.push(`progress ${done}`),
      ),
    ).rejects.toThrow("boom");
    // Let any runner that was mid-item finish.
    await new Promise((r) => setTimeout(r, 40));
    const afterFailure = events.slice(events.indexOf("failed") + 1);
    expect(afterFailure.filter((e) => e.startsWith("start"))).toEqual([]);
    expect(afterFailure.filter((e) => e.startsWith("progress"))).toEqual([]);
  });
});
