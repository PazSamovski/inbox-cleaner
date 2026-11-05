import { memo } from "react";
import type { Sender } from "../types";
import type { SenderStatus } from "../useCleaner";
import { colorFor, initialOf, plural, timeAgo } from "../lib/format";
import { Icon } from "./Icon";

interface Props {
  sender: Sender;
  status: SenderStatus | undefined;
  kept: boolean;
  selected: boolean;
  onSelect: (email: string) => void;
  onClean: (sender: Sender) => void;
  onKeep: (email: string) => void;
}

const METHOD_LABEL = { "one-click": "Unsubscribed", email: "Unsubscribed by email", "web-page": "Unsubscribe page opened" };

export const SenderRow = memo(function SenderRow({ sender, status, kept, selected, onSelect, onClean, onKeep }: Props) {
  const count = sender.messageIds.length;
  const done = Boolean(status?.unsubscribed || status?.trashed || status?.blocked);
  const unreadShare = count ? Math.round((sender.unreadCount / count) * 100) : 0;

  return (
    <li className={`sender ${done ? "is-done" : ""} ${kept ? "is-kept" : ""} ${selected ? "is-selected" : ""}`}>
      <label className="sender-check">
        <input
          type="checkbox"
          checked={selected}
          disabled={kept || Boolean(status?.busy)}
          onChange={() => onSelect(sender.email)}
          aria-label={`Select ${sender.name}`}
        />
      </label>

      <div className="avatar" style={{ background: colorFor(sender.domain) }} aria-hidden="true">
        {initialOf(sender.name)}
      </div>

      <div className="sender-main">
        <div className="sender-title">
          <span className="sender-name" dir="auto">{sender.name}</span>
          {sender.promotionsCount > 0 && <span className="tag tag-promo">Promotion</span>}
          {sender.unsubscribe?.oneClickUrl && <span className="tag tag-oneclick">One-click</span>}
          {kept && <span className="tag tag-kept">Kept</span>}
        </div>
        <div className="sender-email">{sender.email}</div>
        <div className="sender-subject" dir="auto" title={sender.latestSubject}>
          {sender.latestSubject}
        </div>
        {(done || status?.error || status?.busy) && (
          <div className="sender-status">
            {status?.busy && <span className="pill pill-busy"><span className="spinner" />{status.busy}</span>}
            {status?.unsubscribed && <span className="pill pill-ok"><Icon name="check" size={13} />{METHOD_LABEL[status.unsubscribed]}</span>}
            {status?.trashed ? <span className="pill pill-ok"><Icon name="trash" size={13} />{plural(status.trashed, "email")} trashed</span> : null}
            {status?.blocked && <span className="pill pill-ok"><Icon name="ban" size={13} />Blocked</span>}
            {status?.error && <span className="pill pill-err">{status.error}</span>}
          </div>
        )}
      </div>

      <div className="sender-stats">
        <span className="count">{count.toLocaleString()}</span>
        <span className="count-label">{count === 1 ? "email" : "emails"}</span>
        <span className="meta">{unreadShare}% unread · {timeAgo(sender.latestDate)}</span>
      </div>

      <div className="sender-actions">
        <button
          className="btn btn-danger btn-sm"
          onClick={() => onClean(sender)}
          disabled={kept || Boolean(status?.busy) || (count === 0 && !sender.unsubscribe)}
        >
          <Icon name="sparkle" size={15} /> Clean
        </button>
        <button
          className={`btn btn-icon ${kept ? "is-on" : ""}`}
          onClick={() => onKeep(sender.email)}
          title={kept ? "Stop keeping" : "Keep this sender"}
          aria-label={kept ? `Stop keeping ${sender.name}` : `Keep ${sender.name}`}
          aria-pressed={kept}
        >
          <Icon name="star" size={16} />
        </button>
      </div>
    </li>
  );
});
