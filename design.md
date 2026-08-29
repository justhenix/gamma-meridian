# Meridian Design System (`design.md`)

> **Source of Truth for Visual Design, Typography, Theming, and UI Architecture**  
> Tailored for **Meridian Tax Consulting Agency**: Authoritative, Precise, High-Trust, and Modern.

---

## 1. Brand Essence & Visual Identity

Meridian is an elite tax consulting and advisory firm. The visual language conveys:
- **Institutional Authority & Trust**: Crisp geometric structure, high-contrast typography, and restrained elegance.
- **Precision & Discretion**: Clean data presentation, deliberate alignments, and absence of visual clutter.
- **Modern Corporate Polish**: Premium slate foundations punctuated by refined warm gold accents.

---

## 2. Color Palette & Theme Tokens

The design system operates on strict semantic CSS variables for both `light` and `dark` themes.

### Light Theme (`data-theme="light"`)
```css
:root[data-theme="light"],
:root {
  --text: #0f172a;               /* Deep Slate 900 */
  --text-muted: #64748b;         /* Slate 500 */
  --background: #f8fafc;         /* Slate 50 */
  --primary: #1e293b;            /* Slate 800 */
  --primary-foreground: #f8fafc; /* Slate 50 */
  --secondary: #e2e8f0;          /* Slate 200 */
  --secondary-foreground: #0f172a; /* Slate 900 */
  --border: #cbd5e1;             /* Slate 300 */
  --accent: #ffd642;             /* Warm Gold */
  --accent-foreground: #0f172a;  /* Slate 900 */
  --card: #ffffff;               /* Pure White */
  --card-foreground: #0f172a;
  --popover: #ffffff;
  --popover-foreground: #0f172a;
  --muted: #f1f5f9;
  --muted-foreground: #64748b;
  --destructive: #ef4444;
  --destructive-foreground: #ffffff;
  --ring: #1e293b;
  --radius: 0.375rem;            /* 6px - Sharp, authoritative */
}
```

### Dark Theme (`data-theme="dark"`)
```css
:root[data-theme="dark"],
.dark {
  --text: #f1f5f9;               /* Slate 100 */
  --text-muted: #94a3b8;         /* Slate 400 */
  --background: #0b0f17;         /* Deep Obsidian Navy */
  --primary: #ffd642;            /* Warm Gold */
  --primary-foreground: #0b0f17; /* Deep Obsidian */
  --secondary: #243044;          /* Muted Navy Slate */
  --secondary-foreground: #f1f5f9; /* Slate 100 */
  --border: #334155;             /* Slate 700 */
  --accent: #fbbf24;             /* Amber Gold */
  --accent-foreground: #0b0f17;  /* Deep Obsidian */
  --card: #111827;               /* Slate 900 */
  --card-foreground: #f1f5f9;
  --popover: #111827;
  --popover-foreground: #f1f5f9;
  --muted: #1e293b;
  --muted-foreground: #94a3b8;
  --destructive: #f87171;
  --destructive-foreground: #0b0f17;
  --ring: #ffd642;
  --radius: 0.375rem;            /* 6px */
}
```

---

## 3. Typography System

The typography uses a dual-font pairing optimized for institutional clarity, readability, and authority.

### Font Pairing
- **Headings & Display**: `Plus Jakarta Sans` (`font-heading`)  
  - Weights: `600` (SemiBold), `700` (Bold), `800` (ExtraBold)
  - Characteristics: Geometric, crisp, authoritative modern executive aesthetic.
- **Body & UI Elements**: `Inter` (`font-sans`)  
  - Weights: `400` (Regular), `500` (Medium), `600` (SemiBold)
  - Characteristics: Balanced optical density, optimized for dense technical tax explanations and clean number rendering.

### Type Scale & Hierarchy
| Level | Font Family | Size | Weight | Line Height | Tracking |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Hero Display** | Plus Jakarta Sans | `2.75rem` - `3.75rem` (`44px - 60px`) | `700` / `800` | `1.1` | `-0.025em` |
| **H1 Section** | Plus Jakarta Sans | `2.25rem` - `2.75rem` (`36px - 44px`) | `700` | `1.15` | `-0.02em` |
| **H2 Subsection**| Plus Jakarta Sans | `1.75rem` - `2.00rem` (`28px - 32px`) | `600` | `1.25` | `-0.015em` |
| **H3 Group** | Plus Jakarta Sans | `1.25rem` - `1.50rem` (`20px - 24px`) | `600` | `1.3` | `-0.01em` |
| **Lead Paragraph**| Inter | `1.125rem` (`18px`) | `400` / `500` | `1.6` | `normal` |
| **Body (Default)**| Inter | `1.00rem` (`16px`) | `400` / `500` | `1.6` | `normal` |
| **Body (Dense/UI)**| Inter | `0.875rem` (`14px`) | `400` / `500` | `1.5` | `normal` |
| **Caption/Metadata**| Inter | `0.8125rem` (`13px`) | `500` | `1.4` | `+0.01em` |

### Typography Rules & Prohibitions
- ❌ **NO MONOSPACE FONTS** across marketing copy, general UI, badges, statistics, numbers, headings, or body text.
- ❌ **NO VERY SMALL FONTS**: Strict minimum font size is `13px` (`0.8125rem`). Never use illegible 10px–11px micro-text.
- ❌ **NO ALL-CAPS TRACKED HEADINGS**: Avoid faux-tech uppercase headline styling.

---

## 4. Anti-Slop Design Guardrails (Zero-Tolerance Rules)

To protect brand credibility and prevent generic AI-generated aesthetic drift, the following patterns are strictly prohibited:

1. **NO LED Indicators / Glowing Dots**:
   - 🚫 No green/amber/blue blinking dots, pulsing status indicators, or "live radar" badges.
2. **NO Eyebrow Badges**:
   - 🚫 No floating uppercase micro-chips or tracked-out labels above headlines (e.g., `/// ABOUT US ///` or `[ 01 // OVERVIEW ]`).
3. **NO Random Decorative Cards**:
   - 🚫 No aimless floating cards with artificial borders, fake shadow layers, or gratuitous widgets. Use clean semantic layout grids or structured tables.
4. **NO Buggy / Sluggish Transitions**:
   - 🚫 No complex spring physics, delayed fade-in cascades, or sticky scroll hijacks.
   - ✅ Keep transitions crisp, subtle, and deterministic: `150ms`–`200ms` with standard `ease-out`.
5. **NO Neon Glows, Green AI Gradients, or Heavy Glassmorphism**:
   - 🚫 No saturated gradient meshes, blurred neon backdrop glow filters, or frosted glass surfaces with high opacity overlays.
6. **NO Oversized Rounded Corners**:
   - 🚫 Avoid rounded pill containers (`rounded-3xl`, `rounded-full` for cards).
   - ✅ Stick to sharp, structured corner radiuses (`rounded-md` / `6px` to `rounded-lg` / `8px`).

---

## 5. Component Architecture (`shadcn/ui` First)

Always leverage official `shadcn/ui` primitives as the foundation:

- **Buttons**:
  - `default`: Solid primary background (`--primary`), sharp contrast foreground (`--primary-foreground`), subtle hover brightness shift.
  - `secondary`: Slate surface (`--secondary`) with `--secondary-foreground`.
  - `outline`: Border (`--border`) with clean background hover (`hover:bg-muted`).
  - `accent`: Warm Gold (`--accent`) for critical conversion actions.
- **Forms & Inputs**:
  - Structured borders (`--border`), subtle focus ring (`focus-visible:ring-1 focus-visible:ring-ring`), clear readable placeholder text (`--text-muted`).
- **Tables & Data Display**:
  - Clean horizontal dividers, alternating subtle row hover (`hover:bg-muted/40`), clear header weights (`font-semibold text-text`).
- **Dialogs & Drawers**:
  - Restrained backdrop dimming (`bg-black/60`), structured card border (`border-border`), clear typography hierarchy.

---

## 6. Layout & Spacing Rhythm

- **Container Widths**:
  - Maximum content width: `max-w-7xl` (`1280px`) or `max-w-6xl` (`1152px`).
  - Compact article/form width: `max-w-2xl` (`672px`) to `max-w-3xl` (`768px`).
- **Vertical Spacing Rhythm**:
  - Major sections: `py-16` to `py-24` on desktop (`py-12` on mobile).
  - Component element gaps: `gap-4` (`16px`), `gap-6` (`24px`), `gap-8` (`32px`).
- **Grid Layouts**:
  - 12-column grid system with clean responsive breakpoints (`sm: 640px`, `md: 768px`, `lg: 1024px`, `xl: 1280px`).

---

## 7. Internationalization (i18n) Layout Considerations

- **Language Flexibility (EN & ID)**:
  - Indonesian text is typically 15% to 25% longer than English equivalents.
  - All text containers must use flexible height and fluid flex/grid layouts.
  - Never hardcode fixed width/height on buttons or containers that contain translatable copy.
- **Numerical & Currency Standards**:
  - Indonesian Rupiah: `Rp 10.000.000` (period thousands separator).
  - USD: `$10,000.00` (comma thousands separator).
