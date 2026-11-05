import type { MailService, Progress, ScanOptions, Sender, UnsubscribeResult } from "../types";
import { groupBySender, type MessageMeta } from "./aggregate";
import { sleep } from "./pool";

// Fictional senders, so the app can be tried without connecting a real inbox.
const DEMO_SENDERS: {
  from: string;
  subjects: string[];
  count: number;
  promo: boolean;
  unsub: "one-click" | "mailto" | "web" | "none";
}[] = [
  { from: '"Wave Riders Surf Co." <news@waveriders.example>', subjects: ["Second pick is FREE*", "New boardshorts just dropped 🌊", "Last chance: 25% off"], count: 64, promo: true, unsub: "one-click" },
  { from: '"שעונים בחינם 🎁" <gifts@freewatch.example>', subjects: ["זכית בשעון חכם בחינם! | פרסומת", "נשארו 20 דקות למימוש הזכייה | פרסומת"], count: 48, promo: true, unsub: "web" },
  { from: '"SkyLow Airlines" <deals@skylow.example>', subjects: ["Plan your 2027 getaway!", "Up to 40% off flights"], count: 37, promo: true, unsub: "one-click" },
  { from: '"TripNest Hotels" <mail@tripnest.example>', subjects: ["Members get savings!", "VIP Access: save on top hotels"], count: 31, promo: true, unsub: "mailto" },
  { from: '"FitWear" <hello@fitwear.example>', subjects: ["נובמבר סייל: טייצים ב-99 ₪ | פרסומת", "הקולקציה החדשה כאן | פרסומת"], count: 26, promo: true, unsub: "one-click" },
  { from: '"Galaxy Electronics" <promo@galaxy-electronics.example>', subjects: ["The new foldable is almost yours [פרסומת]"], count: 22, promo: true, unsub: "one-click" },
  { from: '"BurgerNow" <marketing@burgernow.example>', subjects: ["!מבצעי נובמבר באפליקציה | פרסומת"], count: 19, promo: true, unsub: "mailto" },
  { from: '"TicketMaster Pro" <alerts@tickets.example>', subjects: ["Your favourite artist is coming soon"], count: 15, promo: true, unsub: "web" },
  { from: '"Chocolate House" <cs@chocohouse.example>', subjects: ["40% הנחה לחברי מועדון 🍫 [פרסומת]"], count: 12, promo: true, unsub: "one-click" },
  { from: '"Weekly Money Summary" <hello@moneyweek.example>', subjects: ["Your spending this week"], count: 9, promo: true, unsub: "web" },
  { from: '"DevTools Team" <team@devtools.example>', subjects: ["New: AI code review is here"], count: 8, promo: true, unsub: "one-click" },
  { from: '"City College" <noreply@college.example>', subjects: ["Exam schedule – Semester A", "Academic calendar"], count: 14, promo: false, unsub: "none" },
  { from: '"CS Department" <cs-office@college.example>', subjects: ["RE: Data Structures grade"], count: 6, promo: false, unsub: "none" },
  { from: '"MyBank" <statements@mybank.example>', subjects: ["Your monthly statement is ready"], count: 5, promo: false, unsub: "none" },
  { from: '"GitHub" <noreply@github.example>', subjects: ["[PazSamovski/Geometric-Shapes] New star"], count: 4, promo: false, unsub: "web" },
];

function buildDemoMessages(): MessageMeta[] {
  const now = Date.now();
  const messages: MessageMeta[] = [];
  let id = 0;
  for (const sender of DEMO_SENDERS) {
    const domain = sender.from.match(/@([^>]+)>/)?.[1] ?? "example.com";
    const listUnsubscribe =
      sender.unsub === "none"
        ? undefined
        : sender.unsub === "mailto"
          ? `<mailto:unsubscribe@${domain}?subject=unsubscribe>`
          : `<https://${domain}/unsubscribe?u=demo>`;
    for (let i = 0; i < sender.count; i++) {
      messages.push({
        id: `demo-${id++}`,
        labelIds: [
          "INBOX",
          ...(sender.promo ? ["CATEGORY_PROMOTIONS"] : []),
          ...(i % 3 !== 0 ? ["UNREAD"] : []),
        ],
        internalDate: now - (i * 1.7 + DEMO_SENDERS.indexOf(sender) * 0.3) * 86_400_000,
        from: sender.from,
        subject: sender.subjects[i % sender.subjects.length],
        listUnsubscribe,
        listUnsubscribePost: sender.unsub === "one-click" ? "List-Unsubscribe=One-Click" : undefined,
      });
    }
  }
  return messages;
}

/** Same interface as GmailService, backed by fake data and fake delays. */
export class DemoService implements MailService {
  readonly isDemo = true;
  private messages = buildDemoMessages();

  async getAccountEmail(): Promise<string> {
    return "demo@example.com";
  }

  async scan(options: ScanOptions, onProgress: (p: Progress) => void): Promise<Sender[]> {
    const pool = this.messages
      .filter((m) => !options.promotionsOnly || m.labelIds.includes("CATEGORY_PROMOTIONS"))
      .slice(0, options.limit);
    const step = Math.max(1, Math.ceil(pool.length / 20));
    for (let done = 0; done < pool.length; done += step) {
      onProgress({ done, total: pool.length });
      await sleep(60);
    }
    onProgress({ done: pool.length, total: pool.length });
    return groupBySender(pool);
  }

  async trashMessages(ids: string[], onProgress: (p: Progress) => void): Promise<number> {
    const toDelete = new Set(ids);
    for (let done = 0; done <= ids.length; done += Math.max(1, Math.ceil(ids.length / 8))) {
      onProgress({ done: Math.min(done, ids.length), total: ids.length });
      await sleep(70);
    }
    this.messages = this.messages.filter((m) => !toDelete.has(m.id));
    return ids.length;
  }

  async unsubscribe(sender: Sender): Promise<UnsubscribeResult> {
    if (!sender.unsubscribe) throw new Error(`${sender.name} does not offer an unsubscribe link.`);
    await sleep(500);
    if (sender.unsubscribe.oneClickUrl) return { method: "one-click", needsUserAction: false };
    if (sender.unsubscribe.mailto) return { method: "email", needsUserAction: false };
    return { method: "web-page", needsUserAction: true };
  }

  async blockSender(): Promise<void> {
    await sleep(400);
  }
}
