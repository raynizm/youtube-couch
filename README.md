# Bluefin

TV-first YouTube client built with React, TypeScript and Vite. Targets Android TV (WebView) and Tizen (Chrome 76 baseline), with D-pad spatial navigation, TV-client account feeds, SponsorBlock skipping, and ad/Shorts filtering.

## Layout

Bun workspace monorepo.

- `packages/app` — the web app (`@bluefin/app`)
  - `src/yt` — YouTube client, TV OAuth, home rows
  - `src/nav` — spatial navigation
  - `src/player` — player and MSE clip handling
  - `src/filters` — ad and Shorts filters
  - `src/sponsorblock` — segment skipping
  - `src/ui` — screens and components
- `docs` — design specs and plans

## Requirements

- [Bun](https://bun.sh)

## Develop

```sh
bun install
bun run dev        # Vite dev server, includes CORS proxy at /__proxy
bun run test       # vitest
bun run build:web  # typecheck + production bundle to packages/app/dist
```

Lint from `packages/app`: `bun run lint` (oxlint).

## Notes

- Browsers cannot call YouTube directly. The dev and preview servers proxy allowed hosts (`youtube.com`, `googlevideo.com`, `ytimg.com`, `sponsor.ajay.app`) through `/__proxy`. TV wrappers handle this natively (Android WebView request interception, Tizen access rules).
- Build uses a relative base so the bundle loads from `file://` (Tizen `.wgt`, Android assets).
