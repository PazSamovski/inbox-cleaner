// Sign-in with Google Identity Services (token model).
// The access token lives only in memory, in this browser tab.

// Read headers, move messages to Trash, send unsubscribe emails.
const MODIFY_SCOPE = "https://www.googleapis.com/auth/gmail.modify";
// Create filters that send future mail from a sender to Trash.
const SETTINGS_SCOPE = "https://www.googleapis.com/auth/gmail.settings.basic";

export const GMAIL_SCOPES = `${MODIFY_SCOPE} ${SETTINGS_SCOPE}`;

const GIS_SRC = "https://accounts.google.com/gsi/client";

let scriptPromise: Promise<void> | null = null;

function loadScript(): Promise<void> {
  scriptPromise ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = GIS_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      scriptPromise = null;
      reject(new Error("Could not load Google sign-in. Check your connection."));
    };
    document.head.appendChild(script);
  });
  return scriptPromise;
}

export interface AccessToken {
  value: string;
  expiresAt: number;
}

/** Opens the Google consent popup and resolves with an access token. */
export async function requestAccessToken(clientId: string): Promise<AccessToken> {
  await loadScript();
  return new Promise((resolve, reject) => {
    const client = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: GMAIL_SCOPES,
      callback: (response) => {
        if (response.error) {
          reject(new Error(response.error_description || response.error));
          return;
        }
        if (!google.accounts.oauth2.hasGrantedAllScopes(response, MODIFY_SCOPE, SETTINGS_SCOPE)) {
          reject(new Error("Please allow all the requested permissions so the app can clean your inbox."));
          return;
        }
        resolve({
          value: response.access_token,
          expiresAt: Date.now() + Number(response.expires_in) * 1000,
        });
      },
      error_callback: (error) => {
        reject(new Error(error.type === "popup_closed" ? "Sign-in was cancelled." : error.message));
      },
    });
    client.requestAccessToken();
  });
}

export async function revokeAccessToken(token: string): Promise<void> {
  await loadScript();
  await new Promise<void>((resolve) => google.accounts.oauth2.revoke(token, () => resolve()));
}
