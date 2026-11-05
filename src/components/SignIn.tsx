import { Icon } from "./Icon";

interface Props {
  hasClientId: boolean;
  connecting: boolean;
  onSignIn: () => void;
  onDemo: () => void;
}

export function SignIn({ hasClientId, connecting, onSignIn, onDemo }: Props) {
  return (
    <main className="hero">
      <div className="hero-badge">
        <Icon name="sparkle" size={14} /> Open source · Runs in your browser
      </div>
      <h1>
        Unsubscribe from the noise.
        <br />
        <span className="accent">Keep what matters.</span>
      </h1>
      <p className="hero-sub">
        Inbox Cleaner finds every newsletter and promotion in your Gmail, shows who sends you the most,
        and lets you unsubscribe and clear them out in one click.
      </p>

      <div className="hero-actions">
        <button className="btn btn-primary btn-lg" onClick={onSignIn} disabled={!hasClientId || connecting}>
          <GoogleLogo />
          {connecting ? "Connecting…" : "Sign in with Google"}
        </button>
        <button className="btn btn-ghost btn-lg" onClick={onDemo} disabled={connecting}>
          Try the demo
        </button>
      </div>
      {!hasClientId && (
        <p className="hero-note">
          Google sign-in is not configured yet. Add <code>VITE_GOOGLE_CLIENT_ID</code> to <code>.env</code>, or
          try the demo with sample data.
        </p>
      )}

      <ul className="features">
        <li>
          <span className="feature-icon"><Icon name="lock" /></span>
          <strong>Private by design</strong>
          <span>Your emails go straight from Google to this tab. There is no server and nothing is stored.</span>
        </li>
        <li>
          <span className="feature-icon"><Icon name="bell" /></span>
          <strong>Real unsubscribes</strong>
          <span>Uses the sender's official unsubscribe link, including one-click unsubscribe.</span>
        </li>
        <li>
          <span className="feature-icon"><Icon name="ban" /></span>
          <strong>Never again</strong>
          <span>Optionally adds a Gmail filter so anything new from that sender skips your inbox.</span>
        </li>
      </ul>
    </main>
  );
}

function GoogleLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}
