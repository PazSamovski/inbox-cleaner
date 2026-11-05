// Per-account list of senders the user chose to keep. Browser-only, best effort.

const key = (account: string) => `inbox-cleaner:kept:${account}`;

export function loadKept(account: string): Set<string> {
  try {
    const raw = localStorage.getItem(key(account));
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

export function saveKept(account: string, kept: Set<string>): void {
  try {
    localStorage.setItem(key(account), JSON.stringify([...kept]));
  } catch {
    // Storage blocked (private mode): the choice just won't persist.
  }
}
