import { describe, expect, it } from "vitest";
import { groupBySender, type MessageMeta } from "./aggregate";
import { buildRawEmail, parseFrom, parseListUnsubscribe } from "./headers";
import { mapWithConcurrency } from "./pool";

describe("parseFrom", () => {
  it("parses quoted names", () => {
    expect(parseFrom('"Wave Riders" <News@WaveRiders.example>')).toEqual({
      name: "Wave Riders",
      email: "news@waveriders.example",
    });
  });

  it("parses unquoted and Hebrew names", () => {
    expect(parseFrom("פינק ליידי <help@pink.example>")).toEqual({ name: "פינק ליידי", email: "help@pink.example" });
  });

  it("falls back to the address when there is no name", () => {
    expect(parseFrom("solo@example.com")).toEqual({ name: "solo@example.com", email: "solo@example.com" });
  });
});

describe("parseListUnsubscribe", () => {
  it("reads both mailto and https entries", () => {
    const info = parseListUnsubscribe(
      "<mailto:unsub@x.example?subject=stop%20please>, <https://x.example/u?id=1>",
      undefined,
    );
    expect(info?.httpUrl).toBe("https://x.example/u?id=1");
    expect(info?.mailto).toEqual({
      to: "unsub@x.example",
      subject: "stop please",
      body: "Please unsubscribe me from this mailing list.",
    });
    expect(info?.oneClickUrl).toBeUndefined();
  });

  it("detects RFC 8058 one-click", () => {
    const info = parseListUnsubscribe("<https://x.example/u>", "List-Unsubscribe=One-Click");
    expect(info?.oneClickUrl).toBe("https://x.example/u");
  });

  it("ignores insecure http links and empty headers", () => {
    expect(parseListUnsubscribe("<http://x.example/u>", undefined)).toBeNull();
    expect(parseListUnsubscribe(undefined, undefined)).toBeNull();
  });
});

describe("buildRawEmail", () => {
  it("produces base64url and MIME-encodes non-ASCII subjects", () => {
    const raw = buildRawEmail("a@b.example", "הסר", "body");
    expect(raw).not.toMatch(/[+/=]/);
    const decoded = atob(raw.replace(/-/g, "+").replace(/_/g, "/"));
    expect(decoded).toContain("To: a@b.example");
    expect(decoded).toContain("Subject: =?UTF-8?B?");
  });
});

describe("groupBySender", () => {
  const msg = (id: string, from: string, date: number, extra: Partial<MessageMeta> = {}): MessageMeta => ({
    id,
    from,
    internalDate: date,
    labelIds: ["INBOX"],
    subject: `subject ${id}`,
    ...extra,
  });

  it("groups by address, sorts by volume and keeps the newest subject and unsubscribe link", () => {
    const senders = groupBySender([
      msg("1", "A <a@x.example>", 1, { listUnsubscribe: "<https://old.example>" }),
      msg("2", "A <a@x.example>", 3, {
        listUnsubscribe: "<https://new.example>",
        labelIds: ["UNREAD", "CATEGORY_PROMOTIONS"],
      }),
      msg("3", "B <b@y.example>", 2),
    ]);
    expect(senders.map((s) => s.email)).toEqual(["a@x.example", "b@y.example"]);
    expect(senders[0]).toMatchObject({
      messageIds: ["2", "1"],
      unreadCount: 1,
      promotionsCount: 1,
      latestSubject: "subject 2",
      domain: "x.example",
    });
    expect(senders[0].unsubscribe?.httpUrl).toBe("https://new.example");
  });
});

describe("mapWithConcurrency", () => {
  it("keeps order and never exceeds the limit", async () => {
    let running = 0;
    let peak = 0;
    const result = await mapWithConcurrency([5, 1, 4, 2, 3], 2, async (n) => {
      running++;
      peak = Math.max(peak, running);
      await new Promise((r) => setTimeout(r, n));
      running--;
      return n * 10;
    });
    expect(result).toEqual([50, 10, 40, 20, 30]);
    expect(peak).toBe(2);
  });
});
