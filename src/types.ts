/** How a sender lets you unsubscribe, parsed from the List-Unsubscribe headers. */
export interface UnsubscribeInfo {
  /** RFC 8058 one-click: a POST to this URL unsubscribes without opening a page. */
  oneClickUrl?: string;
  /** A web page the user opens to unsubscribe. */
  httpUrl?: string;
  /** An address we email to unsubscribe. */
  mailto?: { to: string; subject: string; body: string };
}

/** Everything we know about one sender, aggregated from their messages. */
export interface Sender {
  email: string;
  name: string;
  domain: string;
  messageIds: string[];
  unreadCount: number;
  /** Messages Gmail filed under the Promotions tab. */
  promotionsCount: number;
  latestDate: number;
  latestSubject: string;
  unsubscribe: UnsubscribeInfo | null;
}

export type UnsubscribeMethod = "one-click" | "email" | "web-page";

export interface UnsubscribeResult {
  method: UnsubscribeMethod;
  /** For web-page unsubscribes the user still has to finish on the page we opened. */
  needsUserAction: boolean;
}

export interface ScanOptions {
  /** Maximum number of messages to read. */
  limit: number;
  /** Only look at the Promotions tab. */
  promotionsOnly: boolean;
}

export interface Progress {
  done: number;
  total: number;
}

/**
 * The app talks to mail through this interface, so the UI does not care whether
 * it is the real Gmail API or the offline demo.
 */
export interface MailService {
  readonly isDemo: boolean;
  getAccountEmail(): Promise<string>;
  scan(options: ScanOptions, onProgress: (p: Progress) => void): Promise<Sender[]>;
  trashMessages(ids: string[], onProgress: (p: Progress) => void): Promise<number>;
  unsubscribe(sender: Sender): Promise<UnsubscribeResult>;
  /** Creates a Gmail filter that sends future mail from this address straight to Trash. */
  blockSender(email: string): Promise<void>;
}
