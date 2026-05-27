---
name: Obsidian Flux
colors:
  surface: '#131313'
  surface-dim: '#131313'
  surface-bright: '#3a3939'
  surface-container-lowest: '#0e0e0e'
  surface-container-low: '#1c1b1b'
  surface-container: '#201f1f'
  surface-container-high: '#2a2a2a'
  surface-container-highest: '#353534'
  on-surface: '#e5e2e1'
  on-surface-variant: '#e0c0af'
  inverse-surface: '#e5e2e1'
  inverse-on-surface: '#313030'
  outline: '#a78b7c'
  outline-variant: '#584235'
  surface-tint: '#ffb68b'
  primary: '#ffb68b'
  on-primary: '#522300'
  primary-container: '#ff7a00'
  on-primary-container: '#5c2800'
  inverse-primary: '#994700'
  secondary: '#b5c4ff'
  on-secondary: '#00297a'
  secondary-container: '#0055ea'
  on-secondary-container: '#d8dfff'
  tertiary: '#95ccff'
  on-tertiary: '#003352'
  tertiary-container: '#00a8ff'
  on-tertiary-container: '#003a5c'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#ffdbc8'
  primary-fixed-dim: '#ffb68b'
  on-primary-fixed: '#321200'
  on-primary-fixed-variant: '#753400'
  secondary-fixed: '#dbe1ff'
  secondary-fixed-dim: '#b5c4ff'
  on-secondary-fixed: '#00174d'
  on-secondary-fixed-variant: '#003cac'
  tertiary-fixed: '#cde5ff'
  tertiary-fixed-dim: '#95ccff'
  on-tertiary-fixed: '#001d32'
  on-tertiary-fixed-variant: '#004a75'
  background: '#131313'
  on-background: '#e5e2e1'
  surface-variant: '#353534'
  bg-base: '#0A0A0A'
  bg-surface: '#121212'
  bg-overlay: '#1E1E1E'
  border-subtle: rgba(255, 255, 255, 0.08)
  text-muted: '#888888'
  electric-orange: '#FF7A00'
  deep-blue: '#2F6BFF'
typography:
  display:
    fontFamily: Geist
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.02em
  headline-sm:
    fontFamily: Geist
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
  label-caps:
    fontFamily: Geist
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
  mono:
    fontFamily: Geist
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 20px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 8px
  container-padding: 24px
  gutter: 16px
  stack-sm: 8px
  stack-md: 16px
  stack-lg: 32px
---

## Brand & Style

The design system is engineered for deep focus and technical efficiency. It caters to "power learners" who require a tool that feels like a high-performance IDE rather than a casual consumer app. The brand personality is **utilitarian, precise, and sophisticated**, evoking the feeling of a professional developer environment.

The visual style is a blend of **Minimalism** and **Dark-Mode Modernism**. It prioritizes content clarity through extreme contrast and intentional negative space. By utilizing a "dark-on-dark" layering strategy, the interface minimizes eye strain during long study sessions while using vibrant accent colors to guide the user's attention toward critical generative actions.

## Colors

The palette is anchored in a monochromatic "Obsidian" scale. The background uses `#0A0A0A` to ensure pure blacks on OLED displays, while nested containers use progressively lighter charcoal tones (`#121212`, `#1E1E1E`) to create depth without shadows.

**Primary Accent (Electric Orange):** Used exclusively for high-priority generative actions like "Generate Data" and key active states.
**Secondary Accent (Deep Blue):** Reserved for utility-heavy actions such as "Export" or status indicators, providing a clear visual distinction from the primary AI workflow.
**Subtle Borders:** In place of shadows, UI elements are defined by `1px` semi-transparent white borders (8% opacity), maintaining a sharp, flat aesthetic.

## Typography

This design system utilizes a modern, technical sans-serif stack. **Geist** is used for headings and labels to provide a precise, geometric feel, while **Inter** is used for body text and descriptive content to ensure maximum readability.

- **Contrast:** High-value information uses White (`#FFFFFF`), while secondary labels and descriptions use a muted grey (`#888888`).
- **Technicality:** Small caps are used for category labels and form headers to create a distinct structural hierarchy.
- **Scaling:** On mobile, the `display` role scales down to `20px` to maintain tight margins without breaking layout flows.

## Layout & Spacing

The layout follows an **8px grid system**, ensuring all gaps and paddings are multiples of 8. This creates a dense, professional "dashboard" feel that maximizes information density without feeling cluttered.

- **Sidebar/Navigation:** Collapsible 240px sidebar on desktop, transitioning to a bottom drawer or full-screen overlay on mobile.
- **Staging Area:** Uses a fluid grid that expands to fill the viewport. Cards within the staging area should span 12 columns on mobile and 4-6 columns on desktop depending on density settings.
- **Margins:** Consistent 24px outer margins provide "breathable" space against the deep black background.

## Elevation & Depth

Depth is communicated through **Tonal Layering** and **Subtle Outlines** rather than physical shadows.

- **Level 0 (Base):** `#0A0A0A` - The application canvas.
- **Level 1 (Surface):** `#121212` - Main cards, sidebar, and secondary areas.
- **Level 2 (Overlay):** `#1E1E1E` - Modals, input fields, and dropdown menus.
- **Glassmorphism:** Navigation bars use a 20px backdrop blur with a 40% opaque background to allow content to scroll underneath while maintaining legibility.

## Shapes

The design system uses a "Soft" roundedness level (`4px` to `12px`). This provides a modern touch while maintaining the disciplined, structured look of a technical tool.

- **Buttons & Inputs:** `8px` (rounded-md) for a balanced interactive feel.
- **Cards & Containers:** `12px` (rounded-lg) to clearly define content groupings.
- **Chips/Badges:** `100px` (pill) to distinguish them from interactive buttons.

## Components

### Buttons
- **Primary:** Solid `electric-orange` with white text. No shadow, just a subtle inner glow on hover.
- **Secondary:** Transparent with `border-subtle`. Text is white.
- **Tertiary:** Pure text or Ghost buttons for low-priority actions like "Cancel."

### Input Fields
- **Default:** Background of `#1E1E1E` with a `1px` border of `rgba(255,255,255,0.08)`.
- **Focus:** Border changes to `electric-orange` or `deep-blue` with a subtle 4px outer glow of the same color.
- **Icons:** Thin `1.5px` stroke weights for search or edit icons.

### Cards (Staging Area)
- **Style:** Surface color `#121212` with a subtle top-border highlight.
- **Interactive:** Cards should have a hover state that slightly brightens the background to `#1E1E1E`.

### Progress Indicators
- **AI Processing:** A thin, animated line at the top of the "Staging Area" using a gradient from `electric-orange` to `deep-blue`.

### Sidebar
- Collapsible design with a `1px` vertical border separating it from the main content. Active navigation items use a small vertical "pill" indicator in the primary accent color.