# Measure Sama: Design System (Master)

Source of truth for how Measure Sama looks, reads and behaves. Tokens live in `src/styles/index.css`;
components use the semantic tokens, never raw hex values. Page-specific overrides go in `pages/<page>.md`.

Audience: regular people measuring a shelf, a sofa or a doorway. They glance, they don't read.

## Direction: "Tape"

The look comes from the thing itself: a tape measure. Yellow blade, black ink ticks, nothing else.

| Aspect | Decision |
| --- | --- |
| Idea | The **tape blade becomes the readout**: every measured number sits on a yellow strip with tick marks along its top edge, in big black figures. |
| Text budget | One short line where there used to be a paragraph. Most screens have **no sentences at all**: a title, pictures, a number, buttons. |
| Hierarchy | Numbers big, labels small. The answer (the length) is always the largest thing on the screen. |
| Pictures | Each mode has its own drawn pictogram (ink lines + one yellow tape stroke). Pictures replace explanations. |
| Disclosure | Details (screen pixel density, how it works, export formats) sit behind a **More** disclosure or an **info** button. Defaults are visible; nerd facts are one tap away. |
| Words | Plain, short, no jargon. Say "camera", "screen", "card". Never "AR", "ARCore", "plane", "tracking", "calibrate" in visible copy (the one exception is the Play Store app's real name, Google Play Services for AR, shown small on the install screen). |
| Avoid | Paragraphs, hint text under every field, repeated badges ("Coming soon" ×7), icon-in-tinted-square cards, gradients, glass/blur, shadows on resting cards, indigo/violet, emoji, monospace. |

## Colour

One ground, one ink, one accent (tape yellow). Yellow appears on: the main action, the tape readout,
the measured span on the ruler, the hero mode tile, and the logo. Nothing else is yellow. Yellow is a
**fill**, never a text colour on a light ground (1.4:1).

Contrast is WCAG 2.x. Normal text needs 4.5:1; large text, icons and control outlines 3:1.

| Token | Light | Dark | Use and contrast |
| --- | --- | --- | --- |
| `background` | `#F4F4F1` | `#0F0F0F` | App ground (neutral, faintly warm in light; true neutral black in dark, never navy) |
| `foreground` | `#141414` | `#F3F3F0` | Ink: all text and figures (16.7:1 / 17.2:1 on background) |
| `card` / `card-foreground` | `#FFFFFF` / `#141414` | `#1B1B1B` / `#F3F3F0` | Surfaces: one tone step off the ground, no border, no shadow (18.4:1 / 15.5:1) |
| `muted` | `#EAEAE6` | `#262626` | Pressed rows, segmented-control track, placeholders |
| `muted-foreground` | `#5E5E5A` | `#A9A9A4` | Secondary text (5.9:1 bg, 6.5:1 card, 5.4:1 muted / 8.1:1, 7.3:1, 6.4:1) |
| `subtle` | `#FAFAF8` | `#151515` | Inset areas inside a card |
| `border` | `#E2E2DD` | `#2E2E2E` | Dividers between list rows only |
| `input` | `#8C8C86` | `#6E6E69` | Control outlines: text fields, outline buttons (3.4:1 card / 3.4:1 card) |
| `primary` | `#FFC629` | `#FFC629` | Tape yellow: main action fill, tape readout, logo |
| `primary-hover` | `#F2B600` | `#FFD457` | Pressed/hover yellow |
| `primary-foreground` | `#141414` | `#141414` | Ink on yellow (11.7:1 both themes) |
| `primary-soft` / `-foreground` | `#FFF1C7` / `#5A4500` | `#2E2408` / `#FFD666` | Measured span band, selected tile tint (7.0:1 / 11.0:1) |
| `tape-ink-2` | `#4A3B00` | `#4A3B00` | Secondary figures on the yellow tape (7.0:1) |
| `accent` | alias of `primary` | alias of `primary` | Kept for old call sites; prefer `primary` |
| `destructive` | `#C42B1C` | `#FF7A6B` | Delete, errors (5.7:1 card / 6.8:1 card); text on it `#FFFFFF` / `#0F0F0F` (5.7:1 / 7.5:1) |
| `destructive-soft` / `-foreground` | `#FDE8E5` / `#8A1C12` | `#2E1411` / `#FFB3A8` | Confirm boxes |
| `success` | `#1E7A46` | `#5BD08A` | Icons, "Checked" (5.4:1 / 8.9:1) |
| `success-soft` / `-foreground` | `#DDF5E5` / `#0F4D2A` | `#10291A` / `#7DE0A3` | Chips (8.6:1 / 9.7:1) |
| `warning-soft` / `-foreground` | `#FFF1C7` / `#7A4A00` | `#2E2408` / `#FFD666` | "Estimate" chip, warnings (6.7:1 / 11.0:1) |
| `info-soft` / `-foreground` | `#E6EEF8` / `#1D4E89` | `#132131` / `#9CC3F0` | Neutral notices |
| `ring` | `#141414` | `#FFC629` | Focus outline 2px, offset 2px |
| `scrim` | `rgb(0 0 0 / 0.45)` | `rgb(0 0 0 / 0.65)` | Behind dialogs |

Colour is never the only signal: every state also has a word or an icon.

## Type

- One family: **Plus Jakarta Sans Variable** (self-hosted with `@fontsource-variable`, works offline).
  JetBrains Mono is no longer used anywhere: figures use Jakarta with `tabular-nums`.
- Scale (px): **12** meta · **14** labels, secondary · **16** body, buttons · **20** list figures, card titles ·
  **28** page titles · **48–56** the measurement readout. Nothing else.
- Weights: 500 body, 600 labels and buttons, 700 titles, 800 the readout. Titles tracking -0.02em;
  the readout -0.03em, line-height 1.
- Sentence case everywhere. No uppercase letter-spaced labels.
- Every number that can change uses `tabular-nums`.

## Shape, depth, spacing

- Radius: cards and tiles **20px**, inner blocks **12px**, buttons, chips and segmented controls **fully
  round** (pill). Decided once; no 6–10px "soft" corners on new work.
- Depth: tone steps only. Resting cards have no border and no shadow. Shadows only on what floats
  (toasts, menus, the marker handles on the ruler).
- Spacing on a 4px base. Page gutter 16px (20px from 400px wide, 24px from 640px). Gap between
  blocks 16px; between sections 32px. Card padding 16px (20px from 640px).
- Content column max 40rem (640px) on desktop, centred. The phone layout is the design; desktop is
  the same column with more air.

## Components

All in `src/components/ui` (plus layout pieces in `src/components/layout`).

- **Button** — pill. `primary`: yellow fill, ink label. `secondary`: card fill (on the ground) or muted
  fill (on a card), ink label. `outline`: 1px `input` border. `ghost`: no fill. `danger`: destructive fill.
  Heights: `sm` 36, `md` 44, `lg` 56 (the one main action per screen). Press: `active:scale-[0.98]`.
- **IconButton** — 44×44 round, always with `aria-label` (and `title`).
- **PageHeader** — replaces the old top bar. Optional back chevron (44px) on sub-pages, the page's `h1`
  at 28/700, optional trailing icon actions. Back goes to the previous screen when there is one in this
  app session, otherwise to a given parent path.
- **TapeReadout** — the signature element. Yellow `primary` block, radius 20, a row of tick marks along
  the top edge drawn in SVG (ink at about 55% opacity: a long tick every 10, medium every 5, short
  between), the main figure at 48–56/800 in `primary-foreground`, an optional second line at 16/600 in
  `tape-ink-2` (the same length in the other unit), and optional trailing slots (a status chip, a copy
  button). The figure has `aria-live="polite"` where it updates.
- **ModeArt** — one drawn pictogram per mode id (distance, screen-ruler, height, angle, path, area,
  volume, room-plan, photo), 48–96px, 2px ink strokes with round caps, one yellow tape element, drawn on a
  48×48 viewBox. Unknown ids fall back to the catalog's lucide icon. Decorative (`aria-hidden`): the mode
  name is always visible next to it.
- **Disclosure** ("More") — native `<details>`/`<summary>`: summary is a 48px row with a label and a
  chevron that rotates; content below. Use for anything a regular person doesn't need on first look.
- **InfoButton** — a 44px "i" IconButton that toggles a short explanation (one or two lines) below its
  row. `aria-expanded` + `aria-controls`.
- **Chip** (Badge) — pill, 24px tall, 12/600, a soft tint with its own ink. Beside values only, never
  above a heading.
- **List / ListRow** — a card holding rows split by 1px `border` dividers (inset 16px). Row: optional
  leading picture or icon (20px, muted), label, optional value or control on the right, optional chevron.
  Min height 56px. Settings and History use it.
- **ChoiceGroup** (segmented, real radios) — pill track in `muted`, selected segment in `card` with ink
  text; 48px tall. Optional icon per choice. No hint text by default.
- **Switch** — on colour is ink (`foreground`), not yellow.
- **Alert** — kept for real problems only (warnings, errors). One line; title optional.
- **EmptyState** — a pictogram, one title line, one action. No description paragraph.
- **Toaster** — ink pill (`foreground` fill, `background` text), shadow allowed (it floats).
- **BottomNav** — three destinations (Home, History, Settings), 64px + safe area, opaque `background`
  with a top `border` line, no blur. Active item: ink label, icon on a `muted` pill. Inactive:
  `muted-foreground`. Yellow never appears in navigation.

## App icon, splash and browser colours

- **Icon**: the `LogoMark` (`src/components/layout/Logo.tsx`): tape yellow with five ink ticks (long, short,
  long, short, long) hanging from the top edge. App icons are full bleed (the OS rounds the corners); the
  favicon and the splash use the tile with 25% rounded corners. Sources: `assets/icon.svg`, `public/favicon.svg`.
- **Splash**: the tile at 28% of the screen on `background` (`#F4F4F1` light, `#0F0F0F` dark).
- **theme-color**: follows the theme (`#F4F4F1` / `#0F0F0F`), set in `index.html` before first paint and by
  `applyTheme()` in `src/state/preferences.ts`. Manifest `theme_color` and `background_color`: `#F4F4F1`.
- Regenerate after changing the art: `node scripts/render-icons.mjs`, then
  `npx capacitor-assets generate --android --ios` (revert its whitespace-only edit to `AndroidManifest.xml`),
  then `npx pwa-assets-generator`.

## Screens

Each screen answers one question with its biggest element.

| Screen | Question | Biggest thing | What it shows (and nothing more) |
| --- | --- | --- | --- |
| Home `/` | "What do I want to measure?" | The first available mode as a full-width yellow hero tile | Brand row as the `h1` (logo mark + "Measure Sama"). Hero tile: big pictogram + mode name + chevron. Other available modes as card tiles (2 columns; an odd last tile spans both). Only if a mode is not built yet: "Coming soon" as one small heading, then compact muted chips (small pictogram + name), not links (today all nine are built, so none show). No descriptions. |
| AR entry `/ar`, `/ar/:mode` | "How do I start?" | A big **Start measuring** button under an illustration | Back + `h1` from `src/modes/ar/modeCopy.ts` ("Measure a distance", "Measure height", …). Distance: one picture of the gesture (phone, floor, two points, tape) and three pictogram steps ("Scan the floor", "Tap one end", "Tap the other end"). Other modes: the mode's pictogram and its tips as numbered yellow circles. Steps only when tips are on, as a real `<ol>`. The mode's one-line intro is not shown. A small cm / in switch instead of the "Lengths show in…" sentence. Notices as a one-line Alert. |
| AR fallback | "What now?" | The way forward (Install it, or the on-screen ruler) | Pictogram, one short heading, at most one muted line, buttons. Needs install: heading "One free app needed", line "Google Play Services for AR". Needs update: "Update one free app". Unknown: "Couldn’t check this phone" + reason or "Check your internet and try again." + Try again. Unsupported: "This phone can’t measure with the camera" and no extra line (the platform reason is technical). Camera works but this build can't do the mode (iOS today): "Coming soon on this phone". The ruler and "Use photo measure" buttons are always there. |
| On-screen ruler `/ruler` | "How long is it?" | TapeReadout with A→B distance | Back + `h1` "On-screen ruler". Card-check prompt (if not checked): one compact card with a card pictogram, heading "Check the size with a bank card", button "Start card check", and an info button for the why. Then the readout (main unit, other unit + mm on the second line, chip "Estimate" or "Checked"), then the ruler, then "Full-screen ruler". Everything about pixels, screen size entry, model picker, "Start over" lives in one **Screen details** disclosure. Calibration warnings stay visible. |
| Card check (overlay) | "Does the outline match my card?" | The card outline | Inside the outline: a card pictogram and "Put a card in this corner. Resize until it fits." Bottom bar: "Any bank or ID card" (muted), − slider +, Cancel / Save. |
| Full-screen ruler (overlay) | "How long is it?" | The ruler + centred readout | Close button, "Estimate" chip when unchecked. |
| Photo measure `/photo` | "How long is it in this photo?" | The photo with the card outline | Back + `h1` "Photo measure". Start: one card with the photo pictogram and "Card + object, flat on a table", then Take photo (primary) and Choose photo (tonal), full width. On the photo: a one-line prompt, white card outline on a dark edge (red dashed while it isn't a card), tape-yellow lines, each length on a yellow pill with ink figures; icon buttons; Save. The saved photo draws the same. |
| History `/history` | "What did I measure?" | The figures in the list | `h1` "History". One List card: each row = photo or mode pictogram, the mode's main value (`resultSummary`) at 20/700, then note (or mode name) · short date in 14px muted, chevron. Export: one compact row at the end ("Export all" label + CSV and JSON buttons). Empty: pictogram, "No measurements yet", "Measure something". |
| Measurement `/history/:id` | "What was it?" | TapeReadout with the saved main value | Back + `h1` "Measurement". Photo (app only); room plan drawing (ink walls on a pale yellow floor, yellow numbered badges, lengths outside the walls). Distance: readout with the main and other unit. Other modes: a small label ("Area", "Volume", …) over the readout, then the extras in one plain card (label left, figure right). Room plan: "Save PDF" (tonal). Date and mode as one muted line, Note field (label "Note", placeholder "What did you measure?", no hint), Share and Delete. Delete asks once, inline: "Delete this measurement?" + Yes, delete / Cancel. |
| Settings `/settings` | "How do I change X?" | The controls | `h1` "Settings". Grouped Lists with small section labels: Units (cm / in), Look (theme with sun/moon/phone icons; Show tips switch), Ruler and history (Recalibrate row; Clear history row with count and an inline confirm), About (version; "Stays on your phone" with a lock icon). No helper sentences. |
| Not found | "Where am I?" | The way home | Pictogram, `h1` "We can’t find that page", "Go home" button. |

## Motion

Feedback only: press scale (transform), colour changes 150ms, disclosure chevron rotation 150ms,
overlays fade 150–200ms. No entrance animations. `prefers-reduced-motion` collapses everything.

## Accessibility checklist

- WCAG 2.2 AA in both themes (axe runs desktop light and mobile dark).
- Touch targets ≥ 44×44 (primary actions 56). 8px between targets.
- One `h1` per screen; sections have headings (visible or `sr-only`).
- Icon-only buttons have `aria-label`; pictograms beside visible text are `aria-hidden`.
- Disclosures use native `<details>`; info toggles use `aria-expanded`.
- Ruler markers are keyboard sliders; dragging always has a button or key alternative.
- Safe areas: `env(safe-area-inset-*)` on the page top, the bottom nav and overlays.
- Text can grow to 200% without clipping: no fixed heights on text containers.

## AR screen (native, Android and iOS)

Built in `android/.../ar/` (layout `activity_ar_measure.xml`, drawables `bg_ar_*`, `MeasureOverlayView`,
`ScanAnimationView`) and `ios/App/App/ArMeasureViewController.swift` (NOT BUILT OR TESTED). The camera
picture is the ground; tape yellow and ink are the only colours; words are almost gone.

**Colours**: tape `#FFC629`, ink `#141414`, white, scrim `#99000000` (60% black) behind any text over
the camera, black at 55% as a shadow under every line and mark. No other hues; red only for a real error.

**Layout** (portrait, safe areas respected):

| Where | What |
| --- | --- |
| Top left | Close: 48dp round scrim button, white X. |
| Top centre | Hint chip: centred pill, 15sp/600 white on scrim, at most 4 words, live region (polite). |
| Under it | Mode chip (scrim), the distance warning (ink on a yellow pill), Clear / Reset (scrim pill). |
| Centre | Reticle. While no surface has been found yet: the scan animation (phone sweeping over a surface, yellow dots, on a scrim disc). |
| Above the bottom bar | The live main number on a **tape pill**: yellow, ink 26sp/800 tabular figures, tick marks along the top edge. Lengths on sides are small yellow pills. |
| Bottom | Undo (scrim pill) · the **+ button** (72dp circle, white ring) · Save (yellow pill, ink bold text). Undo, Clear and Save fade to 45% while they can't be used. |

**Marks**: lines are 3dp tape yellow on a 5dp white edge on a dark shadow (dashed for a shape's closing
side); points are yellow dots with a white ring; shape fill is yellow at 25%; the angle arc is yellow.

**Reticle and +**:

1. **Searching**: a white dashed ring (48dp) that slowly turns. + is see-through grey (`#66FFFFFF`) with a
   faint ink +.
2. **On a surface**: a solid white ring (52dp) with a yellow centre dot. It pops (1.0 → 1.15 → 1.0, 200ms)
   and the phone ticks when the surface is found. + turns tape yellow with an ink +.
3. **Room plan snap**: a second white ring around it means "tap to close the room".

**+ always answers a tap**: off a surface, a tap shakes it, gives a reject haptic, and the hint reads what
to do ("Aim at a surface", "Aim at the floor", "Raise to the top") for 1.5s.

**Motion**: 150–250ms, ease-out. With system animations off (Android "Remove animations", iOS "Reduce
motion"): the ring stays still, no pop, no shake, the scan animation shows one still frame.

**WebView background**: Android `MainActivity` and iOS `MainViewController` follow the phone's light/dark
setting (`#F4F4F1` / `#0F0F0F`), so the app never flashes the wrong ground before the page paints.
