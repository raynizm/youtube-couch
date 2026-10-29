# YouTube Couch

TV-first YouTube client built with React, TypeScript and Vite. Targets Android TV (WebView) and Tizen (Chrome 76 baseline), with D-pad spatial navigation, TV-client account feeds, SponsorBlock skipping, and ad/Shorts filtering.

## Layout

Bun workspace monorepo.

- `packages/app` — the web app (`@youtube-couch/app`)
  - `src/yt` — YouTube client, TV OAuth, home rows
  - `src/nav` — spatial navigation
  - `src/player` — player and MSE clip handling
  - `src/filters` — ad and Shorts filters
  - `src/sponsorblock` — segment skipping
  - `src/ui` — screens and components
- `packages/tizen` — TizenBrew module: manifest, CORS proxy service, build script
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

[TizenBrew](https://github.com/reisxd/TizenBrew) runs web apps on Tizen TVs without Tizen Studio. YouTube Couch is an application module (`packages/tizen`): TizenBrew serves the built app from the TV and runs `service.js`, a small CORS proxy on `127.0.0.1:8082`, in the background.

Publish (needs an npm account; rename the package in `packages/tizen/package.json` if the name is taken):

```sh
bun run build:tizen           # builds the app against the TV proxy and copies it to packages/tizen/dist
cd packages/tizen
npm publish
```

On the TV, open TizenBrew, choose Add Module, enter `npm/youtube-couch-tizen`, then launch YouTube Couch from the module list. TizenBrew loads modules from jsDelivr, so a new version can take a few minutes to appear (or purge the cache at `purge.jsdelivr.net`). Bump `version` for each publish.

## Notes

- Browsers cannot call YouTube directly. The dev and preview servers proxy allowed hosts (`youtube.com`, `googlevideo.com`, `ytimg.com`, `sponsor.ajay.app`) through `/__proxy`. TV wrappers handle this natively (Android WebView request interception, Tizen access rules).
- Build uses a relative base so the bundle loads from `file://` (Tizen `.wgt`, Android assets).
