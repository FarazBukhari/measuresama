# Measure Sama: Design System (Master)

Source of truth for visual and interaction decisions. Page-specific overrides go in `pages/<page>.md`.
Tokens live in `src/styles/index.css`; components must use the semantic tokens, never raw hex values.

Audience: regular people (home projects, shopping, moving), not developers. Words stay plain, controls are
big, and nothing needs a manual.

## Product reasoning

| Aspect | Decision |
| --- | --- |
| Pattern | Home screen with big mode cards, then one focused measuring screen at a time |
| Style | Flat design with a tape-measure feel: deep indigo, amber "tape", tick-mark details |
| Must have | Works offline, works without AR (on-screen ruler), clear unit switch (cm / in), large readouts |
| Avoid | Jargon (no "ARCore", "tracking", "plane"; say "move your phone slowly"), emoji icons, dense screens |
| Dark mode | First-class, follows the system setting |

## Color tokens

Palette: indigo primary (a tape-measure case) + amber accent (the tape itself).
Contrast ratios are WCAG 2.x relative-luminance ratios. Normal text needs 4.5:1, large text and UI outlines 3:1.

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `background` | `#F5F7FF` | `#0B1020` | App background |
| `foreground` | `#1E1B4B` | `#E8EBFA` | Body text (14.9:1 / 15.9:1 on background) |
| `card` | `#FFFFFF` | `#121936` | Surfaces (text 16.0:1 / 14.5:1) |
| `muted` / `muted-foreground` | `#E9ECF8` / `#475569` | `#1A2248` / `#A9B3D9` | Secondary surfaces / text (7.1:1 / 9.1:1 on background, 6.4:1 / 7.4:1 on muted) |
| `border` / `input` | `#D3D9F0` / `#8791B8` | `#2A3466` / `#5C6AA5` | Dividers / control outlines (input 3.1:1 / 3.3:1 on card) |
| `primary` | `#3730A3` | `#A5B4FC` | Buttons, links, active nav (9.3:1 / 9.5:1 on background) |
| `primary-foreground` | `#FFFFFF` | `#1E1B4B` | Text on primary (9.9:1 / 8.0:1) |
| `primary-soft` / `-foreground` | `#E0E7FF` / `#312E81` | `#1F2A5E` / `#C7D2FE` | Selected states, highlighted results (9.3:1 / 9.1:1) |
| `accent` | `#F59E0B` | `#FBBF24` | Tape-strip highlights and badges. Never used as text colour: 2.0:1 on the light background |
| `accent-soft` / `-foreground` | `#FEF3C7` / `#78350F` | `#3A2A0A` / `#FCD34D` | Badge text on amber tint (8.2:1 / 9.6:1) |
| `destructive` | `#DC2626` | `#F87171` | Errors, delete (4.5:1 / 6.8:1 on background; white on red 4.8:1) |
| `success` / `warning` / `info` | soft backgrounds + dark text | same idea | Alerts, badges (all text pairs at least 6.3:1; success and warning on background 4.7:1) |
| `ring` | `#4F46E5` | `#A5B4FC` | Focus outlines, 2px with 2px offset (5.9:1 / 9.5:1) |

Text on the amber accent uses `#1E1B4B` (7.4:1 light, 9.6:1 dark). Color is never the only signal: every state
also has an icon or text.

## Typography

- UI: **Plus Jakarta Sans Variable**: friendly and crisp at small sizes.
- Numbers (measurements, ruler labels): **JetBrains Mono Variable** with `tabular-nums`, so digits do not jump.
- Self-hosted via `@fontsource-variable/*` (works offline, `font-display: swap`).
- Base 16px, line-height 1.5; scale 12 / 14 / 16 / 18 / 24 / 30 / 36. The main measurement readout uses 36px or larger.

## Shape, depth, spacing

- Radius: 6 (small), 8 (controls), 12 (cards), 16 (dialogs). Flat surfaces: 1px border + `shadow-xs`; `shadow-lg` only for overlays.
- 4/8px spacing rhythm; cards `p-4` (phone) / `p-5` (640px and up); sections `gap-6` to `gap-10`.
- Layout: single column, max content width 48rem; bottom navigation on phones; top bar with logo and theme toggle.

## Interaction and motion

- Press feedback: `active:scale-[0.98]` (transform only, no layout shift); hover color shifts 150ms.
- Overlays 150 to 200ms ease-out; `prefers-reduced-motion` collapses all animation.
- Touch targets at least 44x44px (buttons `h-11`, icon buttons `size-11`), 8px gaps.
- The AR screen is full-screen camera with a big Close button and one-line hints in plain words.

## Components

All in `src/components/ui`: Button / IconButton, Card / Grid / Stack / Row, Field + TextInput / NumberInput /
TextArea / Select / SegmentedControl / Switch / Checkbox / Slider / ColorInput / FileDrop, OutputField / CodeBlock /
KeyValueList, Stat / StatGrid, Alert, Badge, Tabs, EmptyState, CopyButton. Native elements first
(`<select>`, `<dialog>`, checkbox) for accessibility and mobile pickers.

## Accessibility checklist

- Visible labels for every control; errors next to the field with `role="alert"` and an icon.
- Icon-only buttons have `aria-label`; decorative icons `aria-hidden`.
- Skip link, landmark regions, single `h1` per page, sequential headings.
- Radio groups and tabs support arrow keys; drag interactions (ruler calibration) have numeric alternatives.
- Safe areas: `viewport-fit=cover` + `env(safe-area-inset-*)` padding on fixed bars.
- Smoke test runs axe WCAG 2.2 AA on desktop (light) and mobile (dark).
