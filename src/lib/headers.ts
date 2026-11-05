import type { UnsubscribeInfo } from "../types";

export interface ParsedAddress {
  name: string;
  email: string;
}

/** Parses a From header: `"Name" <a@b.com>`, `Name <a@b.com>` or `a@b.com`. */
export function parseFrom(value: string): ParsedAddress {
  const trimmed = value.trim();
  const angle = trimmed.match(/^(.*?)\s*<([^<>]+)>\s*$/);
  if (angle) {
    const email = angle[2].trim().toLowerCase();
    const name = angle[1].trim().replace(/^"(.*)"$/, "$1").replace(/\\"/g, '"').trim();
    return { name: name || email, email };
  }
  const email = trimmed.replace(/^"|"$/g, "").toLowerCase();
  return { name: email, email };
}

export function domainOf(email: string): string {
  const at = email.lastIndexOf("@");
  return at === -1 ? email : email.slice(at + 1);
}

/**
 * Parses List-Unsubscribe (RFC 2369) and List-Unsubscribe-Post (RFC 8058).
 * Example: `<mailto:unsub@x.com?subject=stop>, <https://x.com/u?id=1>`
 */
export function parseListUnsubscribe(
  header: string | undefined,
  postHeader: string | undefined,
): UnsubscribeInfo | null {
  if (!header) return null;
  const entries = [...header.matchAll(/<([^>]+)>/g)].map((m) => m[1].trim());
  const info: UnsubscribeInfo = {};

  for (const entry of entries) {
    if (/^https:\/\//i.test(entry) && !info.httpUrl) {
      info.httpUrl = entry;
    } else if (/^mailto:/i.test(entry) && !info.mailto) {
      info.mailto = parseMailto(entry);
    }
  }

  const oneClick = postHeader?.replace(/\s/g, "").toLowerCase() === "list-unsubscribe=one-click";
  if (oneClick && info.httpUrl) info.oneClickUrl = info.httpUrl;

  return info.httpUrl || info.mailto ? info : null;
}

function parseMailto(uri: string): UnsubscribeInfo["mailto"] {
  const withoutScheme = uri.slice("mailto:".length);
  const [rawTo, query = ""] = withoutScheme.split("?");
  const params = new URLSearchParams(query);
  return {
    to: safeDecode(rawTo),
    subject: params.get("subject") || "unsubscribe",
    body: params.get("body") || "Please unsubscribe me from this mailing list.",
  };
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** Base64url-encodes a UTF-8 string, as the Gmail API expects for raw messages. */
export function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Builds a minimal RFC 2822 message. Non-ASCII subjects are MIME-encoded. */
export function buildRawEmail(to: string, subject: string, body: string): string {
  // eslint-disable-next-line no-control-regex
  const encodedSubject = /^[\x00-\x7F]*$/.test(subject)
    ? subject
    : `=?UTF-8?B?${btoa(String.fromCharCode(...new TextEncoder().encode(subject)))}?=`;
  const message = [
    `To: ${to}`,
    `Subject: ${encodedSubject}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "",
    body,
  ].join("\r\n");
  return toBase64Url(message);
}
