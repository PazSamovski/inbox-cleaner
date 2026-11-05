import type { Sender } from "../types";
import { domainOf, parseFrom, parseListUnsubscribe } from "./headers";

/** The fields we read from each message (Gmail "metadata" format). */
export interface MessageMeta {
  id: string;
  labelIds: string[];
  internalDate: number;
  from: string;
  subject: string;
  listUnsubscribe?: string;
  listUnsubscribePost?: string;
}

/** Groups messages by sender address, newest information first, biggest senders first. */
export function groupBySender(messages: readonly MessageMeta[]): Sender[] {
  const sorted = [...messages].sort((a, b) => b.internalDate - a.internalDate);
  const senders = new Map<string, Sender>();

  for (const message of sorted) {
    if (!message.from) continue;
    const { name, email } = parseFrom(message.from);
    let sender = senders.get(email);
    if (!sender) {
      sender = {
        email,
        name,
        domain: domainOf(email),
        messageIds: [],
        unreadCount: 0,
        promotionsCount: 0,
        latestDate: message.internalDate,
        latestSubject: message.subject,
        unsubscribe: null,
      };
      senders.set(email, sender);
    }

    sender.messageIds.push(message.id);
    if (message.labelIds.includes("UNREAD")) sender.unreadCount++;
    if (message.labelIds.includes("CATEGORY_PROMOTIONS")) sender.promotionsCount++;
    // Messages are newest-first, so the first unsubscribe header we see is the freshest.
    sender.unsubscribe ??= parseListUnsubscribe(message.listUnsubscribe, message.listUnsubscribePost);
  }

  return [...senders.values()].sort(
    (a, b) => b.messageIds.length - a.messageIds.length || b.latestDate - a.latestDate,
  );
}
