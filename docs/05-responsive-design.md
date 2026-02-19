# Responsive & Mobile Design

## Current Responsive Approach

The frontend uses Tailwind CSS v4 utility classes with mobile-first responsive breakpoints. The design follows a dark theme (`bg-gray-950 text-gray-100`) set on the `<body>` element.

### Layout Breakpoints

The primary responsive element is the loop grid in `LoopList.tsx`:

```
grid gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3
```

| Screen Size | Breakpoint | Columns | Typical Devices |
|------------|-----------|---------|-----------------|
| < 640px | default | 1 | Phones |
| 640–767px | `sm` | 1 | Large phones, small tablets |
| 768–1023px | `md` | 2 | Tablets, small laptops |
| 1024px+ | `lg` | 3 | Desktops, large tablets |

### Container

The main content container in `App.tsx`:

```
max-w-6xl mx-auto px-4 py-8
```

- `max-w-6xl` (1152px) prevents the layout from stretching on ultra-wide displays
- `mx-auto` centers the content
- `px-4` (16px) provides horizontal padding on all screen sizes
- `py-8` (32px) provides vertical spacing

### Component-Level Responsive Patterns

#### LoopCard (`components/LoopCard.tsx`)

Cards use a fixed layout without additional breakpoints:

```
bg-gray-900 border border-gray-800 rounded-lg p-4 space-y-3
```

- `p-4` (16px) padding works at all sizes
- `truncate` on repo name and URL prevents overflow on narrow cards
- Buttons use `text-xs px-3 py-1` for compact touch targets

#### Header (`App.tsx`)

```
flex items-center justify-between mb-8
```

The header uses flexbox with space-between alignment. The title and NewLoopForm button sit on opposite ends. On narrow screens, this naturally stacks if content wraps.

#### Modals (LiveLog, AuthPrompt)

Both modals use fixed positioning with centered flex:

```
fixed inset-0 bg-black/70 flex items-center justify-center z-50
```

LiveLog container:

```
max-w-4xl max-h-[80vh] w-full mx-4
```

- `max-w-4xl` (896px) caps width on large screens
- `max-h-[80vh]` limits height to 80% of viewport
- `w-full mx-4` fills width with 16px margins on small screens

## What Works Well on Mobile

1. **Single-column grid.** On phones, loops display in a single column that scrolls naturally.
2. **Dark theme.** High contrast ratio between `gray-950` background and `gray-100`/`white` text works well on mobile OLED displays.
3. **Compact card design.** Cards have reasonable padding and text sizes that don't require zooming.
4. **Text truncation.** Long repo URLs and names are truncated with ellipsis, preventing horizontal overflow.
5. **Modal sizing.** Modals respect viewport height (`max-h-[80vh]`) and have horizontal margins (`mx-4`).
6. **Touch targets.** Action buttons are spaced with `gap-2` and have sufficient padding for touch interaction.

## Gaps and Improvement Opportunities

### Touch Target Sizes

The action buttons (`text-xs px-3 py-1`) produce small touch targets. Apple's Human Interface Guidelines recommend at least 44x44pt. Current buttons may be undersized for comfortable thumb use.

**Recommendation:** Consider `py-2 px-4 text-sm` on mobile breakpoints, or use `min-h-[44px] min-w-[44px]` on interactive elements.

### Header Layout

The header doesn't have a responsive stack. On very narrow screens (< 360px), the title and "+ New Loop" button may collide.

**Recommendation:** Add `flex-wrap` to the header flex container, or stack vertically on small screens with `sm:flex-row flex-col`.

### Form Input Sizing

The NewLoopForm input and AuthPrompt input don't have explicit mobile sizing. They rely on the parent container width.

**Recommendation:** Add `w-full` to form containers to ensure they fill available width on small screens.

### No Swipe Gestures

There are no swipe-to-delete or pull-to-refresh gestures that mobile users might expect.

### No Bottom Navigation

The app uses a top-positioned header. On phones, bottom navigation is more thumb-friendly.

### No Viewport Meta Tag Verification

The `index.html` should contain a proper viewport meta tag. Currently it uses the Vite default which includes it, but this should be verified.

## Accessibility Considerations

### Current Strengths

- **Semantic HTML:** Uses `<button>`, `<input>`, `<label>` elements correctly
- **Color + text:** Status badges use both color and text labels (e.g., green dot + "Running" text)
- **Focus styles:** Inputs have `focus:border-emerald-500` focus indicators
- **Keyboard support:** LiveLog modal closes on Escape key
- **Error states:** Errors are displayed inline with visible text, not just color changes

### Gaps

1. **Missing ARIA labels.** The WebSocket connection indicator (colored dot) has no `aria-label` describing its meaning.

2. **No skip navigation.** There's no "skip to main content" link for keyboard users.

3. **Confirmation dialogs.** Delete uses `window.confirm()` which is accessible but provides no customization. A custom modal would allow better keyboard focus management.

4. **Color contrast.** Some text combinations may not meet WCAG AA contrast ratios:
   - `text-gray-500` on `bg-gray-900` — check contrast ratio
   - `text-gray-400` on `bg-gray-900` — borderline

5. **No reduced motion.** The progress bar animation (`transition-all duration-500`) doesn't respect `prefers-reduced-motion`.

6. **Modal focus trap.** LiveLog and AuthPrompt modals don't trap focus — pressing Tab can move focus behind the modal overlay.
