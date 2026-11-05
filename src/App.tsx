import { useCallback, useMemo, useState } from "react";
import { CleanDialog } from "./components/CleanDialog";
import { ProgressBar, Toasts } from "./components/Feedback";
import { Icon } from "./components/Icon";
import { SenderRow } from "./components/SenderRow";
import { SignIn } from "./components/SignIn";
import { plural } from "./lib/format";
import type { Sender } from "./types";
import { hasClientId, useCleaner, type CleanChoice } from "./useCleaner";

type Filter = "all" | "promotions" | "unsubscribable" | "kept";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All senders" },
  { id: "promotions", label: "Promotions" },
  { id: "unsubscribable", label: "Can unsubscribe" },
  { id: "kept", label: "Kept" },
];

export default function App() {
  const cleaner = useCleaner();
  const { phase, senders, statuses, kept, progress, totals } = cleaner;

  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dialogSenders, setDialogSenders] = useState<Sender[] | null>(null);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return senders.filter((s) => {
      if (q && !s.name.toLowerCase().includes(q) && !s.email.includes(q)) return false;
      switch (filter) {
        case "promotions":
          return s.promotionsCount > 0 && !kept.has(s.email);
        case "unsubscribable":
          return s.unsubscribe !== null && !kept.has(s.email);
        case "kept":
          return kept.has(s.email);
        default:
          return true;
      }
    });
  }, [senders, filter, query, kept]);

  const selectable = visible.filter((s) => !kept.has(s.email));
  const allSelected = selectable.length > 0 && selectable.every((s) => selected.has(s.email));

  const toggleSelect = useCallback((email: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(email)) next.delete(email);
      else next.add(email);
      return next;
    });
  }, []);

  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(selectable.map((s) => s.email)));

  const openClean = useCallback((sender: Sender) => setDialogSenders([sender]), []);

  const confirmClean = (choice: CleanChoice) => {
    const list = dialogSenders ?? [];
    setDialogSenders(null);
    if (list.length === 1) {
      void cleaner.clean(list[0], choice);
    } else {
      setSelected(new Set());
      void cleaner.cleanMany(list, choice);
    }
  };

  if (phase === "signed-out" || phase === "connecting") {
    return (
      <>
        <Header />
        <SignIn
          hasClientId={hasClientId}
          connecting={phase === "connecting"}
          onSignIn={cleaner.signIn}
          onDemo={cleaner.tryDemo}
        />
        <Toasts toasts={cleaner.toasts} onDismiss={cleaner.dismissToast} />
      </>
    );
  }

  const busy = progress !== null;
  const selectedSenders = senders.filter((s) => selected.has(s.email));

  return (
    <>
      <Header>
        <div className="account">
          {cleaner.isDemo && <span className="tag tag-demo">Demo</span>}
          <span className="account-email">{cleaner.account}</span>
          <button className="btn btn-ghost btn-sm" onClick={cleaner.signOut}>
            <Icon name="logout" size={16} /> {cleaner.isDemo ? "Exit demo" : "Sign out"}
          </button>
        </div>
      </Header>

      <main className="workspace">
        <section className="stats" aria-label="Summary">
          <Stat value={senders.length} label="senders found" />
          <Stat value={totals.emails} label="emails left" />
          <Stat value={totals.unsubscribable} label="can unsubscribe" />
          <Stat value={totals.trashed} label="emails cleaned" highlight />
        </section>

        <section className="controls">
          <div className="scan-options">
            <label className="select">
              <span>Scan the last</span>
              <select
                value={cleaner.options.limit}
                disabled={busy}
                onChange={(e) => cleaner.setOptions({ ...cleaner.options, limit: Number(e.target.value) })}
              >
                <option value={500}>500 emails</option>
                <option value={1000}>1,000 emails</option>
                <option value={2500}>2,500 emails</option>
                <option value={5000}>5,000 emails</option>
              </select>
            </label>
            <label className="switch">
              <input
                type="checkbox"
                checked={cleaner.options.promotionsOnly}
                disabled={busy}
                onChange={(e) => cleaner.setOptions({ ...cleaner.options, promotionsOnly: e.target.checked })}
              />
              <span>Promotions tab only</span>
            </label>
            <button className="btn btn-ghost btn-sm" onClick={() => void cleaner.scan()} disabled={busy}>
              <Icon name="refresh" size={16} /> Scan again
            </button>
          </div>

          {progress && <ProgressBar progress={progress} label={cleaner.progressLabel} />}

          <div className="list-controls">
            <div className="tabs" role="tablist">
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  role="tab"
                  aria-selected={filter === f.id}
                  className={`tab ${filter === f.id ? "is-active" : ""}`}
                  onClick={() => setFilter(f.id)}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <label className="search">
              <Icon name="search" size={16} />
              <input
                type="search"
                placeholder="Search senders"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
          </div>
        </section>

        {phase === "scanning" && senders.length === 0 ? (
          <div className="empty">
            <span className="spinner spinner-lg" />
            <p>Looking for newsletters and promotions…</p>
          </div>
        ) : visible.length === 0 ? (
          <div className="empty">
            <Icon name="sparkle" size={28} />
            <p>{filter === "kept" ? "Senders you star will show up here." : "Nothing here. Your inbox looks clean!"}</p>
          </div>
        ) : (
          <>
            <div className="list-header">
              <label className="sender-check">
                <input type="checkbox" checked={allSelected} onChange={toggleAll} disabled={busy} aria-label="Select all" />
              </label>
              <span>{plural(visible.length, "sender")}</span>
            </div>
            <ul className="senders">
              {visible.map((sender) => (
                <SenderRow
                  key={sender.email}
                  sender={sender}
                  status={statuses[sender.email]}
                  kept={kept.has(sender.email)}
                  selected={selected.has(sender.email)}
                  onSelect={toggleSelect}
                  onClean={openClean}
                  onKeep={cleaner.toggleKeep}
                />
              ))}
            </ul>
          </>
        )}
      </main>

      {selectedSenders.length > 0 && (
        <div className="bulk-bar">
          <span>
            <strong>{plural(selectedSenders.length, "sender")}</strong> selected ·{" "}
            {plural(selectedSenders.reduce((n, s) => n + s.messageIds.length, 0), "email")}
          </span>
          <div className="bulk-actions">
            <button className="btn btn-ghost btn-sm" onClick={() => setSelected(new Set())}>
              Clear
            </button>
            <button className="btn btn-danger btn-sm" disabled={busy} onClick={() => setDialogSenders(selectedSenders)}>
              <Icon name="sparkle" size={15} /> Clean selected
            </button>
          </div>
        </div>
      )}

      {dialogSenders && (
        <CleanDialog senders={dialogSenders} onConfirm={confirmClean} onClose={() => setDialogSenders(null)} />
      )}
      <Toasts toasts={cleaner.toasts} onDismiss={cleaner.dismissToast} />
    </>
  );
}

function Header({ children }: { children?: React.ReactNode }) {
  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand-mark"><Icon name="mail" size={18} /></span>
        Inbox Cleaner
      </div>
      {children}
    </header>
  );
}

function Stat({ value, label, highlight }: { value: number; label: string; highlight?: boolean }) {
  return (
    <div className={`stat ${highlight ? "is-highlight" : ""}`}>
      <span className="stat-value">{value.toLocaleString()}</span>
      <span className="stat-label">{label}</span>
    </div>
  );
}
