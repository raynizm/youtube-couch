# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Personal living-room use: the owner and household watching YouTube on Android TV (WebView) and Tizen (Chrome 76 baseline). Input is a TV remote D-pad; no keyboard or mouse. Viewing distance is roughly ten feet.

## Product Purpose

Bluefin is a TV-first YouTube client. It signs in with the user's own YouTube account (TV OAuth) and shows their real account feeds. Success is intentional, focused watching: the user finds what they came to watch and is not pulled into mindless scrolling or wasted time.

## Positioning

Unlike the stock YouTube TV app, Bluefin removes ads and Shorts, skips sponsor segments via SponsorBlock, and is designed to make watching more intentional and focused rather than maximizing engagement.

## Operating Context

- Browsers cannot call YouTube directly; dev and preview servers proxy allowed hosts through `/__proxy`. TV wrappers handle this natively.
- Bundle uses a relative base so it loads from `file://` (Tizen `.wgt`, Android assets).
- Navigation is spatial, driven by D-pad (`src/nav`).

## Capabilities and Constraints

- Stack: React, TypeScript, Vite, Bun workspace monorepo (`packages/app`).
- Chrome 76 is the minimum browser baseline (Tizen).
- TV-client account feeds, home rows, player with MSE clip handling, ad and Shorts filters, SponsorBlock segment skipping, sign-out with confirmation.

## Brand Commitments

Name: Bluefin. No logo, voice guide, or other brand assets confirmed.

## Evidence on Hand

Working app and design specs/plans in `/docs`. No testimonials, customer data, or benchmarks exist; do not fabricate them.

## Product Principles

1. Intentional over engaging: surface what the user chose to watch, not endless suggestions.
2. Remove noise: ads, Shorts, and sponsor segments stay out of the way.
3. Remote-first: every action is reachable and visible with a D-pad.
4. Works on old TV hardware: respect the Chrome 76 baseline.

## Accessibility & Inclusion

Distance-viewing legibility is required: large readable text and an always-visible, high-contrast focus indicator for ten-foot UI.
