import { useCallback, useMemo, useRef, useState } from "react";
import { DemoService } from "./lib/demo";
import { AuthExpiredError, GmailService } from "./lib/gmail";
import { requestAccessToken, revokeAccessToken } from "./lib/google-auth";
import { plural } from "./lib/format";
import { loadKept, saveKept } from "./lib/storage";
import type { MailService, Progress, ScanOptions, Sender, UnsubscribeMethod } from "./types";

export type Phase = "signed-out" | "connecting" | "scanning" | "results";

/** What has happened to a sender during this session. */
export interface SenderStatus {
  unsubscribed?: UnsubscribeMethod;
  trashed?: number;
  blocked?: boolean;
  busy?: string;
  error?: string;
}

export interface CleanChoice {
  unsubscribe: boolean;
  trash: boolean;
  block: boolean;
}

export interface Toast {
  id: number;
  kind: "success" | "error" | "info";
  text: string;
}

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
export const hasClientId = Boolean(CLIENT_ID);

const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** A web-page unsubscribe opens a tab, which only works for one sender at a time. */
export const needsWebPage = (s: Sender) =>
  Boolean(s.unsubscribe && !s.unsubscribe.oneClickUrl && !s.unsubscribe.mailto);

export function useCleaner() {
  const [phase, setPhase] = useState<Phase>("signed-out");
  const [account, setAccount] = useState("");
  const [isDemo, setIsDemo] = useState(false);
  const [senders, setSenders] = useState<Sender[]>([]);
  const [statuses, setStatuses] = useState<Record<string, SenderStatus>>({});
  const [kept, setKept] = useState<Set<string>>(new Set());
  const [progress, setProgress] = useState<Progress | null>(null);
  const [progressLabel, setProgressLabel] = useState("");
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [options, setOptions] = useState<ScanOptions>({ limit: 1000, promotionsOnly: false });
  const service = useRef<MailService | null>(null);
  const token = useRef<string | null>(null);
  const toastId = useRef(0);

  const toast = useCallback((kind: Toast["kind"], text: string) => {
    const id = ++toastId.current;
    setToasts((t) => [...t, { id, kind, text }]);
    // Errors stay longer so there is time to read them.
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === "error" ? 15000 : 6000);
  }, []);

  const dismissToast = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const patchStatus = useCallback((email: string, patch: Partial<SenderStatus>) => {
    setStatuses((s) => ({ ...s, [email]: { ...s[email], ...patch } }));
  }, []);

  const signOut = useCallback(async () => {
    if (token.current) await revokeAccessToken(token.current).catch(() => undefined);
    token.current = null;
    service.current = null;
    setSenders([]);
    setStatuses({});
    setAccount("");
    setIsDemo(false);
    setPhase("signed-out");
  }, []);

  const handleError = useCallback(
    (error: unknown) => {
      if (error instanceof AuthExpiredError) {
        toast("error", error.message);
        void signOut();
        return;
      }
      toast("error", errorText(error));
    },
    [signOut, toast],
  );

  const scan = useCallback(
    async (scanOptions: ScanOptions = options) => {
      const mail = service.current;
      if (!mail) return;
      setPhase("scanning");
      setProgress({ done: 0, total: 0 });
      setProgressLabel("Reading your inbox…");
      try {
        const found = await mail.scan(scanOptions, setProgress);
        setSenders(found);
        setStatuses({});
        setPhase("results");
      } catch (error) {
        handleError(error);
        if (service.current) setPhase("results");
      } finally {
        setProgress(null);
      }
    },
    [handleError, options],
  );

  const start = useCallback(
    async (mail: MailService) => {
      service.current = mail;
      setIsDemo(mail.isDemo);
      const email = await mail.getAccountEmail();
      setAccount(email);
      setKept(loadKept(email));
      await scan();
    },
    [scan],
  );

  const signIn = useCallback(async () => {
    if (!CLIENT_ID) return;
    setPhase("connecting");
    try {
      const accessToken = await requestAccessToken(CLIENT_ID);
      token.current = accessToken.value;
      await start(new GmailService(accessToken.value));
    } catch (error) {
      setPhase("signed-out");
      handleError(error);
    }
  }, [handleError, start]);

  const tryDemo = useCallback(() => void start(new DemoService()), [start]);

  const toggleKeep = useCallback(
    (email: string) => {
      setKept((prev) => {
        const next = new Set(prev);
        if (next.has(email)) next.delete(email);
        else next.add(email);
        saveKept(account, next);
        return next;
      });
    },
    [account],
  );

  /** Runs the chosen clean-up steps for one sender. Returns how many emails were trashed. */
  const cleanOne = useCallback(
    async (sender: Sender, choice: CleanChoice, reportProgress: boolean): Promise<number> => {
      const mail = service.current;
      if (!mail) return 0;
      let trashed = 0;
      try {
        if (choice.unsubscribe && sender.unsubscribe) {
          patchStatus(sender.email, { busy: "Unsubscribing…", error: undefined });
          // Called before any other await so a web page can still open inside the click.
          const result = await mail.unsubscribe(sender);
          patchStatus(sender.email, { unsubscribed: result.method });
        }
        if (choice.block) {
          patchStatus(sender.email, { busy: "Blocking…" });
          await mail.blockSender(sender.email);
          patchStatus(sender.email, { blocked: true });
        }
        if (choice.trash && sender.messageIds.length > 0) {
          patchStatus(sender.email, { busy: "Moving to Trash…" });
          if (reportProgress) setProgressLabel(`Moving ${plural(sender.messageIds.length, "email")} to Trash…`);
          trashed = await mail.trashMessages(
            sender.messageIds,
            reportProgress ? setProgress : () => undefined,
          );
          setStatuses((s) => ({
            ...s,
            [sender.email]: { ...s[sender.email], trashed: (s[sender.email]?.trashed ?? 0) + trashed },
          }));
          setSenders((list) =>
            list.map((s) => (s.email === sender.email ? { ...s, messageIds: [], unreadCount: 0, promotionsCount: 0 } : s)),
          );
        }
        patchStatus(sender.email, { busy: undefined });
      } catch (error) {
        patchStatus(sender.email, { busy: undefined, error: errorText(error) });
        throw error;
      } finally {
        if (reportProgress) setProgress(null);
      }
      return trashed;
    },
    [patchStatus],
  );

  const clean = useCallback(
    async (sender: Sender, choice: CleanChoice) => {
      try {
        const trashed = await cleanOne(sender, choice, true);
        const parts = [
          choice.unsubscribe && sender.unsubscribe
            ? needsWebPage(sender)
              ? "opened the unsubscribe page"
              : "unsubscribed"
            : null,
          trashed ? `moved ${plural(trashed, "email")} to Trash` : null,
          choice.block ? "blocked future emails" : null,
        ].filter(Boolean);
        toast("success", `${sender.name}: ${parts.join(", ")}.`);
      } catch (error) {
        handleError(error);
      }
    },
    [cleanOne, handleError, toast],
  );

  const cleanMany = useCallback(
    async (list: Sender[], choice: CleanChoice) => {
      let senderCount = 0;
      let emailCount = 0;
      const manual: string[] = [];
      for (const [index, sender] of list.entries()) {
        setProgressLabel(`Cleaning ${index + 1} of ${list.length}: ${sender.name}`);
        setProgress({ done: index, total: list.length });
        const skipWebPage = needsWebPage(sender);
        if (choice.unsubscribe && skipWebPage) manual.push(sender.name);
        try {
          emailCount += await cleanOne(
            sender,
            { ...choice, unsubscribe: choice.unsubscribe && !skipWebPage },
            false,
          );
          senderCount++;
        } catch (error) {
          if (error instanceof AuthExpiredError) {
            handleError(error);
            return;
          }
        }
      }
      setProgress(null);
      toast("success", `Cleaned ${plural(senderCount, "sender")} and moved ${plural(emailCount, "email")} to Trash.`);
      if (manual.length) {
        toast("info", `${plural(manual.length, "sender")} need you to unsubscribe on their website: ${manual.join(", ")}.`);
      }
    },
    [cleanOne, handleError, toast],
  );

  const totals = useMemo(() => {
    const emails = senders.reduce((n, s) => n + s.messageIds.length, 0);
    const unsubscribable = senders.filter((s) => s.unsubscribe).length;
    const trashed = Object.values(statuses).reduce((n, s) => n + (s.trashed ?? 0), 0);
    const unsubscribed = Object.values(statuses).filter((s) => s.unsubscribed).length;
    return { emails, unsubscribable, trashed, unsubscribed };
  }, [senders, statuses]);

  return {
    phase,
    account,
    isDemo,
    senders,
    statuses,
    kept,
    progress,
    progressLabel,
    toasts,
    options,
    totals,
    setOptions,
    signIn,
    tryDemo,
    signOut,
    scan,
    clean,
    cleanMany,
    toggleKeep,
    dismissToast,
  };
}
