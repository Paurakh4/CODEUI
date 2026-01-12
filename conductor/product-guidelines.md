# CodeUI – Design & Visual Guidelines

## 🎨 Visual Identity
CodeUI follows a **"Sophisticated Tool"** aesthetic—balancing the raw utility of an IDE with the refined elegance of a modern design platform. It is designed to be **Dark Mode First**, optimizing for long coding sessions, while maintaining a **Minimalist & Clean** interface that focuses on content. The design is strictly **Developer-Centric**, leveraging high-legibility typefaces and high-contrast accents.

## 🌗 Color System
- **Primary Mode:** Dark Mode (Default).
- **Background:** `#0a0a0a` (Deep Charcoal) for the main editor workspace.
- **Accents:** `#737373` (Neutral Gray) for primary actions, providing a professional, non-distracting interface.
- **Gradients:** Subtle mesh gradients are used in the Dashboard and "Thinking" panels to add depth without clutter.

## 🔡 Typography
- **Interface:** `Geist Sans` – A modern, high-legibility font for all UI elements.
- **Code:** `Geist Mono` or `Monaco` – Consistent spacing for technical accuracy.
- **Headings:** Bold, tight tracking for a "brutalist" yet refined feel in the dashboard.

## 🧱 Component Principles
1. **Unobtrusive UI:** Sidebars and panels should use thin borders (`border-neutral-800`) rather than heavy shadows to maintain a flat, modern look.
2. **Micro-interactions:** Every button and toggle must have a subtle transition (150ms) and scale-down effect on click.
3. **Glassmorphism:** The "Thinking" panel and floating menus use a slight background blur (`backdrop-blur-md`) to separate layers.
4. **Consistency:** All input fields must follow the same radius (`var(--radius)`) and focus ring behavior (`ring-neutral-700`).

## 📱 Responsiveness
- The editor layout is **Desktop-First** for maximum productivity but must remain functional on tablets.
- The **Preview Mode** must support one-click toggling between Desktop, Tablet, and Mobile viewports.
