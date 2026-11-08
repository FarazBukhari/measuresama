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

## Screens

Each screen answers one question with its biggest element.

| Screen | Question | Biggest thing | What it shows (and nothing more) |
| --- | --- | --- | --- |
| Home `/` | "What do I want to measure?" | The first available mode as a full-width yellow hero tile | Brand row as the `h1` (logo mark + "Measure Sama"). Hero tile: big pictogram + mode name + chevron. Other available modes as card tiles (2 columns; an odd last tile spans both). "Coming soon" as one small heading, then compact muted chips (small pictogram + name), not links. No descriptions. |
| AR entry `/ar` | "How do I start?" | A big **Start measuring** button under an illustration of the gesture | Back + `h1` "Measure a distance". One picture of the gesture (phone, floor, two points, tape). If tips are on: three pictogram steps with 2–3 words each ("Scan the floor", "Tap one end", "Tap the other end"), a real `<ol>`. A small cm / in switch instead of the "Lengths show in…" sentence. Notices as a one-line Alert. |
| AR fallback | "What now?" | The way forward (Install it, or the on-screen ruler) | Pictogram, one short heading, at most one muted line, buttons. Needs install: heading "One free app needed", line "Google Play Services for AR". Needs update: "Update one free app". Unknown: "Couldn’t check this phone" + reason or "Check your internet and try again." + Try again. Unsupported: "This phone can’t measure with the camera" + the platform reason as a small muted line. The ruler button is always there. |
| On-screen ruler `/ruler` | "How long is it?" | TapeReadout with A→B distance | Back + `h1` "On-screen ruler". Card-check prompt (if not checked): one compact card with a card pictogram, heading "Check the size with a bank card", button "Start card check", and an info button for the why. Then the readout (main unit, other unit + mm on the second line, chip "Estimate" or "Checked"), then the ruler, then "Full-screen ruler". Everything about pixels, screen size entry, model picker, "Start over" lives in one **Screen details** disclosure. Calibration warnings stay visible. |
| Card check (overlay) | "Does the outline match my card?" | The card outline | Inside the outline: a card pictogram and "Put a card in this corner. Resize until it fits." Bottom bar: "Any bank or ID card" (muted), − slider +, Cancel / Save. |
| Full-screen ruler (overlay) | "How long is it?" | The ruler + centred readout | Close button, "Estimate" chip when unchecked. |
| History `/history` | "What did I measure?" | The figures in the list | `h1` "History". One List card: each row = photo or mode pictogram, figure at 20/700, then note (or mode name) · short date in 14px muted, chevron. Export: one compact row at the end ("Export all" label + CSV and JSON buttons). Empty: pictogram, "No measurements yet", "Measure something". |
| Measurement `/history/:id` | "How long was it?" | TapeReadout with the saved length | Back + `h1` "Measurement". Photo (app only), readout (main + other unit), date and mode as one muted line, Note field (label "Note", placeholder "What did you measure?", no hint), Share and Delete. Delete asks once, inline: "Delete this measurement?" + Yes, delete / Cancel. |
| Settings `/settings` | "How do I change X?" | The controls | `h1` "Settings". Grouped Lists with small section labels: Units (cm / in), Look (theme with sun/moon/phone icons; Show tips switch), On-screen ruler (Recalibrate row), History (Clear history row with count; inline confirm), About (version; "Stays on your phone" with a lock icon). No helper sentences. |
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

## AR screen (native, for Android and iOS to follow)

The camera screen is native code (`ArMeasurePlugin.kt`, `ArMeasurePlugin.swift`). It should look like
the rest of the app: the camera picture is the ground, ink and tape yellow are the only colours, and
words are almost gone.

**Colours** (ARGB): tape `#FFFFC629`, ink `#FF141414`, white `#FFFFFFFF`, scrim `#99000000` (60%
black) behind any text over the camera. No other hues; red only for a real error.

**Layout** (portrait, safe areas respected):

| Where | What |
| --- | --- |
| Top left | Close: 48dp round button, scrim fill, white X. Content description "Close". |
| Top centre | Hint chip: one line, at most 4 words, 14sp/600 white on scrim, pill, 36dp tall. |
| Centre | Reticle. |
| Above the shutter | Live length on a **tape strip**: yellow pill, ink figure 28sp/800, tabular figures, tick marks along the top edge (same drawing as the web TapeReadout). Hidden until the first point is placed. |
| Bottom centre | The **+ button**: 72dp circle. |
| Bottom left / right | Undo (48dp, scrim, white undo arrow) · Done/Save (48dp, scrim, white check). Hidden until there is something to undo or save. |

**Reticle states** (this is what Faraz could not read on the phone; every state must look different
and move):

1. **Searching for a surface**: a white dashed ring (64dp, 2dp stroke) that slowly rotates, plus a small
   phone pictogram that sweeps left-right under it (1.2s loop). Hint: "Move phone slowly". The + button is
   **visibly disabled**: grey fill `#66FFFFFF`, ink + at 40%.
2. **Surface found**: the ring snaps to a solid white circle lying flat on the surface (perspective), with
   a 6dp yellow centre dot. A short scale pop (1.0 → 1.15 → 1.0, 200ms) and a light haptic tick the moment
   it is found. The + button turns **tape yellow** with an ink +. Hint: "Tap + to start".
3. **First point placed**: a yellow dot (10dp, white 2dp outline) stays on the surface; a 3dp yellow line
   (white 1dp edge) runs from it to the reticle; the tape strip shows the live length. Hint: "Tap + to end".
4. **Measured**: the line stays, the length label sits on the line's middle as a small tape pill. Hint
   disappears. Done/Save appears.
5. **Lost / too dark**: the ring returns to dashed and pulses; hint "More light, move slowly". + disabled.

**The + button must always answer a tap**: when disabled, a tap shakes the button (3 × 4dp, 250ms),
gives a light haptic, and the hint briefly reads "Point at the floor". Never a silent no-op.

**Motion**: 150–250ms, ease-out; the searching loops stop when the system "reduce motion" / "remove
animations" setting is on (show the static dashed ring and the hint instead).

**Accessibility**: every button has a content description; the hint chip is announced as a live region
(polite); the length is announced when a point is placed.
