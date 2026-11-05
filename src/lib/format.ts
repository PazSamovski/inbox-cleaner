const relative = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

export function timeAgo(timestamp: number): string {
  const days = Math.round((timestamp - Date.now()) / 86_400_000);
  if (days > -1) return "today";
  if (days > -30) return relative.format(days, "day");
  const months = Math.round(days / 30);
  if (months > -12) return relative.format(months, "month");
  return relative.format(Math.round(days / 365), "year");
}

export const plural = (n: number, word: string) => `${n.toLocaleString()} ${word}${n === 1 ? "" : "s"}`;

/** Stable pastel colour per sender, for the avatar. */
export function colorFor(text: string): string {
  let hash = 0;
  for (const ch of text) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  return `hsl(${Math.abs(hash) % 360} 55% 52%)`;
}

export function initialOf(name: string): string {
  const letter = [...name.replace(/^["'\s]+/, "")].find((ch) => /\p{L}|\p{N}/u.test(ch));
  return (letter ?? "?").toUpperCase();
}
