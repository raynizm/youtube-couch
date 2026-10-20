---
name: Bluefin
description: A dark, cinematic TV YouTube client where one video leads and the chrome recedes.
colors:
  canvas: "#0a0a0a"
  surface: "#171717"
  hairline: "#262626"
  text: "#fafafa"
  text-muted: "#a1a1a1"
  text-soft: "#d4d4d4"
  focus-ring: "#fafafa"
  signal-blue: "#3b82f6"
  button-light: "#e5e5e5"
typography:
  headline:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', 'Noto Sans', Arial, sans-serif"
    fontSize: "32px"
    fontWeight: 700
    lineHeight: 1.15
  title:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', 'Noto Sans', Arial, sans-serif"
    fontSize: "18px"
    fontWeight: 500
    lineHeight: 1.4
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', 'Noto Sans', Arial, sans-serif"
    fontSize: "20px"
    fontWeight: 400
    lineHeight: 1.4
  label:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', 'Noto Sans', Arial, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.4
rounded:
  card: "8px"
  thumb: "10px"
  menu: "14px"
  pill: "999px"
spacing:
  xs: "8px"
  sm: "16px"
  md: "24px"
  gutter: "48px"
components:
  button-primary:
    backgroundColor: "{colors.button-light}"
    textColor: "{colors.canvas}"
    rounded: "{rounded.pill}"
    height: "44px"
    padding: "0 22px"
  button-default:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.pill}"
    height: "44px"
    padding: "0 22px"
  nav-pill:
    backgroundColor: "{colors.canvas}"
    rounded: "{rounded.pill}"
    height: "64px"
    padding: "6px"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.card}"
    width: "240px"
  search-bar:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-muted}"
    rounded: "{rounded.pill}"
    height: "44px"
---

# Design System: Bluefin

## Overview

**Creative North Star: "The Quiet Marquee"**

Bluefin is a dark room with one lit screen. A cinematic hero previews the focused video; everything else stays dim, rounded, and out of the way. Rows of cards sit below the marquee and scroll on their own, so the cover never moves while the user browses.

The system is near-black neutrals with a single blue signal color. Controls are soft translucent glass pills at rest. Focus is the only loud moment: a white ring or white fill that is visible from across the room. Motion is slow and cinematic: two-second preview fades, text that slides across the hero.

**Key Characteristics:**
- Near-black canvas; content imagery supplies all the color.
- Pill-shaped, blurred-glass controls.
- Decisive white focus state on every focusable element.
- One cover that stays put, with lists scrolling beneath it.
- No shadows for hierarchy; gradients and blur carry depth.

## Colors

Neutral black and gray, with blue as the single signal.

### Primary
- **Signal Blue** (#3b82f6): Progress on cards, the player seek track, and the selected player-menu item (35% tint). Never used for buttons or text.

### Neutral
- **Screening Black** (#0a0a0a): The page canvas and the base of every gradient shade.
- **Graphite Surface** (#171717): Cards, the search bar, the segmented control, secondary buttons.
- **Hairline Gray** (#262626): 1px borders on pills and controls; selected segment fill.
- **Projection White** (#fafafa): Primary text and the focus ring.
- **Dim Gray** (#a1a1a1): Secondary text, messages, subtitles.
- **Soft White** (#d4d4d4): Inactive nav labels and channel subtext.
- **Lit Button** (#e5e5e5): The one filled primary button.

### Named Rules
**The One Signal Rule.** Blue marks progress and selection only. Interactive affordances are white, never blue.

**The Imagery Owns Color Rule.** Chrome stays neutral so thumbnails and the hero image provide the color. Do not add decorative hues.

## Typography

**Font:** The system sans stack (-apple-system, Segoe UI, Roboto, Noto Sans, Arial). No webfont is loaded, which suits old TV hardware.

**Character:** Plain, native, quiet. Weight (500 to 700) does the hierarchy work, not family changes.

### Hierarchy
- **Headline** (700, 32px, 1.15): Row titles and hero titles (36px on Details). Balanced wrap.
- **Title** (500, 18px, 1.4): Card titles (two-line clamp), buttons, channel name, player time and menus.
- **Body** (400, 20px, 1.4 to 1.55): Messages, Details description.
- **Nav** (500, 20px): Nav pill labels.
- **Label** (400, 16px): Card subtitles, hero meta, channel subscriber count. The floor for any text.

### Named Rules
**The Weight Over Size Rule.** Separate levels with weight and color (white vs. gray), keeping one family.

## Layout

Full-bleed screens with a 48px horizontal gutter. Home's cover is a full-width 16:9 picture anchored to the top edge and filling the screen, with the rows scrolling over its lower 30vh. Details splits vertically: a 70vh fixed cover on top, an independently scrolling list below. A floating nav pill sits fixed at top center over a dark fade. Rows use horizontal scrolling flex lists with a 16px gap; grids use auto-fill columns (280px minimum) with a 24px/16px gap. Spacing runs on 8, 16, 24, 48. The page itself never scrolls (`overflow: hidden`); inner regions do. All sizes are in rem with 1rem = 1/120 of the screen width, so the UI scales with resolution; every pixel value in this file is the size at 1920 wide.

## Elevation & Depth

Flat. Surfaces are not shadowed at rest. Depth comes from gradient shades over imagery, backdrop blur (12px) on glass controls, and a scrim fading from the top under the nav. The only shadow is a heavy drop on the Details thumbnail (`0 8px 28px rgba(0,0,0,.6)`). Focus rings are box-shadows, not elevation.

### Named Rules
**The Flat Until Focused Rule.** Nothing lifts at rest. Focus is the only state change that adds a ring, fill, or scale.

## Shapes

Fully round for controls (999px pills, circular icon buttons). Gently rounded for imagery: cards 8px, details thumbnail 10px, menus 14px. Borders are 1px hairlines. Circular avatars. No sharp corners.

## Components

### Buttons
- **Shape:** Pill (999px), 44px tall, 22px side padding.
- **Primary:** Lit Button fill (#e5e5e5) with black text.
- **Default:** Graphite at 80% opacity with a hairline border.
- **Icon:** 44px circle.
- **Over imagery:** translucent white fill (14 to 16%) with blur and a thin white border.
- **Focus:** 3px white ring (`box-shadow: 0 0 0 3px var(--ring)`); primary brightens to white. On glass buttons the focus fill goes darker translucent, never white.

### Navigation
- Floating pill, 64px tall, blurred black at 75%, hairline border. Labels 20px, 500 weight, with icons.
- **Active:** soft white tint behind white text.
- **Focus:** solid white fill with black text.
- Account control sits at the end behind a divider.

### Cards
- 240px wide, 16:9 image with 8px radius, title (two lines) and one-line subtitle below.
- Hover/focus reveals a centered glass play circle (56px).
- Optional 4px blue progress bar at the bottom edge.
- **Focus:** 3px white ring plus 1.03 scale.

### Inputs / Fields
- Search bar is a 44px pill on Graphite with a hairline border. Border turns white on focus-within.

### Player
- Black stage; glass back button; bottom gradient control bar with a 6px seek track (blue fill), 44px circular icon buttons, and a 14px-radius glass menu. Controls fade out via `.hidden`.

### Segmented control
- Library switcher: pill track on Graphite; active segment filled Hairline Gray; 2px white focus ring.

## Do's and Don'ts

### Do:
- **Do** make focus unmistakable from ten feet: white ring or white fill on every `data-focusable` element.
- **Do** keep chrome neutral and let imagery carry color.
- **Do** use pills for controls and 8px for imagery.
- **Do** keep the cover fixed and scroll only the lists beneath it.
- **Do** use backdrop blur plus translucent fill for controls over imagery.
- **Do** keep every text role at 16px or larger; the four roles live as `--t-label`, `--t-title`, `--t-body`, `--t-head` in `index.css`.

### Don't:
- **Don't** use blue for buttons, links, or focus. It marks progress and selection only.
- **Don't** add drop shadows to cards or buttons for hierarchy.
- **Don't** turn glass buttons white on focus; they darken instead.
- **Don't** add decorative accent colors or gradients to chrome.
- **Don't** load webfonts; stay on the system stack for old TV hardware.
