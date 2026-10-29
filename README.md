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
- `packages/tizenbrew` — TizenBrew module: manifest, CORS proxy service, build script
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

## Install on a Samsung TV with TizenBrew

[TizenBrew](https://github.com/reisxd/TizenBrew) runs web apps on Tizen TVs without Tizen Studio. Bluefin is an application module (`packages/tizenbrew`): TizenBrew serves the built app from the TV and runs `service.js`, a small CORS proxy on `127.0.0.1:8082`, in the background.

Publish (needs an npm account; rename the package in `packages/tizenbrew/package.json` if the name is taken):

```sh
bun run build:tizenbrew        # builds the app against the TV proxy and copies it to packages/tizenbrew/dist
cd packages/tizenbrew
npm publish
```

On the TV, open TizenBrew, choose Add Module, enter `npm/bluefin-tizenbrew`, then launch Bluefin from the module list. TizenBrew loads modules from jsDelivr, so a new version can take a few minutes to appear (or purge the cache at `purge.jsdelivr.net`). Bump `version` for each publish.

## Notes

- Browsers cannot call YouTube directly. The dev and preview servers proxy allowed hosts (`youtube.com`, `googlevideo.com`, `ytimg.com`, `sponsor.ajay.app`) through `/__proxy`. TV wrappers handle this natively (Android WebView request interception, Tizen access rules).
- Build uses a relative base so the bundle loads from `file://` (Tizen `.wgt`, Android assets).
