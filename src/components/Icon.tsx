const PATHS = {
  mail: "M4 6h16v12H4z M4 7l8 6 8-6",
  trash: "M5 7h14 M10 11v6 M14 11v6 M6 7l1 12h10l1-12 M9 7V4h6v3",
  bell: "M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z M10 20a2 2 0 0 0 4 0 M3 3l18 18",
  shield: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z M9 12l2 2 4-4",
  ban: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M5.6 5.6l12.8 12.8",
  star: "M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z",
  refresh: "M20 11a8 8 0 1 0-2.3 5.7 M20 4v7h-7",
  search: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14z M21 21l-5-5",
  check: "M5 12l5 5 9-10",
  x: "M6 6l12 12 M18 6L6 18",
  external: "M14 4h6v6 M20 4l-9 9 M18 14v6H4V6h6",
  sparkle: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z",
  lock: "M6 11h12v9H6z M8 11V8a4 4 0 0 1 8 0v3",
  logout: "M15 4h4v16h-4 M10 8l-4 4 4 4 M6 12h10",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
