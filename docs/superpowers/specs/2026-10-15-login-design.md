# Login (YouTube account sign-in) design

Date: 2026-10-15

## Goal

Let a user sign in to their YouTube account from Bluefin using the TV-style device-code flow, and use the signed-in session to show their real home feed, subscriptions, playlists and history.

## Understanding

- Said by the user: login means YouTube account sign-in via device code. The first version unlocks the personal home feed, the Subscriptions tab, and account playlists plus history.
- Assumptions: the main device is a TV or remote-driven browser (the app uses `@vitejs/plugin-legacy` and MSE playback). The session persists in `localStorage`. All network calls keep going through `/__proxy`.

## Approach

Use the `youtubei.js` OAuth support (`signIn`, the `auth-pending`, `auth`, `update-credentials` and `auth-error` events, and credential refresh) rather than a hand-rolled OAuth flow. Cookie import and a Bluefin-owned account system are out of scope.

## Components

### `src/yt/auth.ts` (new)

- Stores credentials under one `localStorage` key, `bluefin.auth`. Reads and writes are wrapped in try/catch, like `store.ts`.
- `startSignIn()` begins the device-code flow and reports the user code and verification URL to the caller, then resolves when the user approves or rejects when the flow fails or is cancelled.
- `signOut()` revokes the credentials where the library allows it, clears storage, and resets the cached session.
- `useAuth()` is a hook returning `{ signedIn, name?, avatar? }`. It follows the `useSyncExternalStore` pattern used in `store.ts`.
- Persists refreshed credentials on `update-credentials`.

### `src/yt/client.ts` (changed)

- `getSession` creates `Innertube` and signs in with stored credentials when present. Signing in or out resets the cached session promise.
- New calls: account home feed, subscriptions feed, account playlists, watch history. Each returns the existing `Row` or `Item` shapes and goes through `stripAds` and `stripShorts`.
- `homeRows` keeps the topic-row fallback when signed out and uses the account home feed when signed in.

### `/__proxy` (changed, in `vite.config.ts` or its server code)

- Forwards the `Authorization` header and any other headers `youtubei.js` needs for signed-in requests.
- Does not log header values.

### UI

- A sign-in screen shows the code and verification URL and waits for approval. It has a cancel action and a retry on failure.
- `Nav` shows an account entry: sign in when signed out, name and sign out when signed in.
- `SignInNotice` stays for signed-out users. When signed in, the Subscriptions tab shows the feed.
- `Library` shows account playlists and history alongside the local watchlist.

## Data flow

1. The user opens the sign-in screen. `startSignIn()` returns a code and URL.
2. The user enters the code at the URL on another device.
3. The library emits `auth`. Credentials are saved, the session is reset, and `useAuth()` updates.
4. Feeds re-fetch with the signed-in session.
5. On sign-out, credentials are cleared, the session is reset, and feeds fall back to the signed-out versions.

## Error handling

- Expired or revoked credentials: on `auth-error` or a failed refresh, sign the user out cleanly and show the sign-in notice.
- Sign-in failure or timeout: show the error and offer retry.
- Storage unavailable: sign-in works for the current page session only.
- Feed fetch failure while signed in: show the existing error message and keep the rest of the app usable.

## Testing

Vitest with a mocked `Innertube`, matching `client.test.ts`:

- `auth.ts`: credential persistence, sign-out clearing, refresh persistence, handling of corrupt stored data.
- `client.ts`: signed-in versus signed-out `homeRows`, mapping of the new feeds into `Item` and `Row`, ad and shorts filtering of the new feeds.

## Risks

- Device-code OAuth on `youtubei.js` depends on client IDs that the library fetches at sign-in time. Google can change them, which would break sign-in until the library updates.
- Account feed response shapes may differ from the signed-out search results. The mapping must tolerate unknown node types, as `toItem` already does.

## Out of scope

- Cookie import, Bluefin-owned accounts, multiple accounts.
- Writing back to the account (subscribe, add to playlist, like).
- Syncing the local watchlist and subs in `store.ts` with the account.
