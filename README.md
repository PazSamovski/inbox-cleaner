# Inbox Cleaner

Find every newsletter and promotion in your Gmail, see who sends you the most, and unsubscribe and clean them out in one click.

**Runs entirely in your browser.** Your emails go straight from Google's API to the browser tab. There is no backend, no database, and nothing is stored on a server.

## Features

- **Sender report:** scans your latest emails and groups them by sender, sorted by volume, with unread rate and the latest subject.
- **Real unsubscribe:** uses the sender's `List-Unsubscribe` header. It supports RFC 8058 one-click (a POST request), mailto (sends the unsubscribe email for you) and web pages (opens them in a new tab).
- **Bulk clean-up:** moves all of a sender's emails to Trash. They can be restored for 30 days.
- **Block future mail:** creates a Gmail filter that sends new mail from that sender to Trash.
- **Keep list:** star senders you want to keep so they are never selected by mistake.
- **Demo mode:** try the full flow with sample data, no Google account needed.
- Responsive, dark mode, RTL-friendly (Hebrew sender names and subjects).

## Tech

- React 19 + TypeScript + Vite
- Google Identity Services (OAuth 2.0 token flow) + Gmail REST API
- Vitest for unit tests

### Architecture

The UI talks to a `MailService` interface (`src/types.ts`) with two implementations:

| Implementation | File | Purpose |
|---|---|---|
| `GmailService` | `src/lib/gmail.ts` | Real Gmail API calls: concurrency limit, retries with exponential backoff on 429/5xx, typed errors |
| `DemoService` | `src/lib/demo.ts` | Fake data and delays for the demo |

The rest of the code:

- `useCleaner.ts` holds the app state.
- `aggregate.ts` groups messages by sender.
- `headers.ts` parses `From` and `List-Unsubscribe` and builds RFC 2822 emails.
- `pool.ts` runs async work with a concurrency limit.

## Running locally

```bash
npm install
cp .env.example .env    # then paste your Google OAuth client ID
npm run dev
```

```bash
npm test         # unit tests
npm run build    # production build
```

### Getting a Google OAuth client ID

1. Go to [Google Cloud Console](https://console.cloud.google.com/), create a project, and enable the **Gmail API**.
2. Open **Google Auth Platform**, choose **External**, and add your own Google account as a **test user**.
3. Add these scopes:
   - `https://www.googleapis.com/auth/gmail.modify`
   - `https://www.googleapis.com/auth/gmail.settings.basic`
4. Create an **OAuth client ID** of type **Web application** and add these **Authorized JavaScript origins**:
   - `http://localhost:5173`
   - your deployed URL
5. Put the client ID in `.env` as `VITE_GOOGLE_CLIENT_ID`.

While the app is in Google's *Testing* mode it works for up to 100 test users that you add by hand. Publishing it for everyone requires Google's verification for restricted Gmail scopes.

## Privacy

- The access token is kept in memory only and revoked on sign-out.
- The only thing saved locally is your list of kept senders, in `localStorage`.
- The app reads message **headers only** (From, Subject, List-Unsubscribe). It never reads email bodies.
