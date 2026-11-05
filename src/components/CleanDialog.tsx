import { useEffect, useRef, useState } from "react";
import type { Sender } from "../types";
import type { CleanChoice } from "../useCleaner";
import { needsWebPage } from "../useCleaner";
import { plural } from "../lib/format";
import { Icon } from "./Icon";

interface Props {
  senders: Sender[];
  onConfirm: (choice: CleanChoice) => void;
  onClose: () => void;
}

export function CleanDialog({ senders, onConfirm, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const single = senders.length === 1 ? senders[0] : null;
  const emails = senders.reduce((n, s) => n + s.messageIds.length, 0);
  const canUnsubscribe = senders.filter((s) => s.unsubscribe).length;
  const webOnly = senders.filter(needsWebPage).length;

  const [choice, setChoice] = useState<CleanChoice>({
    unsubscribe: canUnsubscribe > 0,
    trash: emails > 0,
    block: false,
  });

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  const toggle = (key: keyof CleanChoice) => setChoice((c) => ({ ...c, [key]: !c[key] }));
  const nothing = !choice.unsubscribe && !choice.trash && !choice.block;

  return (
    <dialog ref={ref} className="dialog" onClose={onClose}>
      <form
        method="dialog"
        onSubmit={(e) => {
          e.preventDefault();
          onConfirm(choice);
        }}
      >
        <h2 dir="auto">{single ? `Clean up ${single.name}` : `Clean up ${plural(senders.length, "sender")}`}</h2>
        <p className="dialog-sub">{single ? single.email : `${plural(emails, "email")} in total`}</p>

        <label className={`option ${canUnsubscribe ? "" : "is-disabled"}`}>
          <input type="checkbox" checked={choice.unsubscribe} disabled={!canUnsubscribe} onChange={() => toggle("unsubscribe")} />
          <span className="option-icon"><Icon name="bell" /></span>
          <span>
            <strong>Unsubscribe</strong>
            <small>
              {!canUnsubscribe
                ? "This sender has no unsubscribe link. Use Block instead."
                : single && needsWebPage(single)
                  ? "Opens the sender's unsubscribe page in a new tab."
                  : !single && webOnly
                    ? `${plural(webOnly, "sender")} need a web page; we'll list them for you.`
                    : "Uses the sender's official unsubscribe link."}
            </small>
          </span>
        </label>

        <label className={`option ${emails ? "" : "is-disabled"}`}>
          <input type="checkbox" checked={choice.trash} disabled={!emails} onChange={() => toggle("trash")} />
          <span className="option-icon"><Icon name="trash" /></span>
          <span>
            <strong>Move {plural(emails, "email")} to Trash</strong>
            <small>You can restore them from Trash for 30 days.</small>
          </span>
        </label>

        <label className="option">
          <input type="checkbox" checked={choice.block} onChange={() => toggle("block")} />
          <span className="option-icon"><Icon name="ban" /></span>
          <span>
            <strong>Block future emails</strong>
            <small>Adds a Gmail filter that sends new mail from {single ? "this sender" : "these senders"} to Trash.</small>
          </span>
        </label>

        <div className="dialog-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-danger" disabled={nothing}>
            Clean up
          </button>
        </div>
      </form>
    </dialog>
  );
}
