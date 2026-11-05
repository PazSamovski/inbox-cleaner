import type { Progress } from "../types";
import type { Toast } from "../useCleaner";
import { Icon } from "./Icon";

export function ProgressBar({ progress, label }: { progress: Progress; label: string }) {
  const percent = progress.total ? Math.round((progress.done / progress.total) * 100) : 0;
  return (
    <div className="progress" role="status" aria-live="polite">
      <div className="progress-text">
        <span dir="auto">{label}</span>
        {progress.total > 0 && (
          <span className="progress-count">
            {progress.done.toLocaleString()} / {progress.total.toLocaleString()}
          </span>
        )}
      </div>
      <div className="progress-track">
        <div
          className={`progress-fill ${progress.total ? "" : "is-indeterminate"}`}
          style={{ width: progress.total ? `${percent}%` : undefined }}
        />
      </div>
    </div>
  );
}

export function Toasts({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.kind}`} dir="auto">
          <span>{t.text}</span>
          <button className="toast-close" onClick={() => onDismiss(t.id)} aria-label="Dismiss">
            <Icon name="x" size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
