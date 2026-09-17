# Architecture

## Runtime

- Standards-based HTML/CSS/TypeScript.
- No React/Vue/Tailwind/component framework.
- No analytics, ads, tracking, or UI icon dependency.
- Firebase modules load only in cloud mode.
- PWA service worker provides an application-shell cache.

## Layers

- `src/core/`: domain types, schema, exercise catalog, calculations, local persistence.
- `src/services/`: external systems such as Firebase. Keep vendor code isolated here.
- `src/main.ts`: current UI composition/event wiring. As screens grow, views will be split into `src/ui/` modules without changing the data model.
- `firestore.rules`: authoritative cloud authorization.
- `tests/unit/`: dependency-free deterministic tests.
- `tests/security/`: Firebase Emulator authorization tests.

## Why no framework in V1

This app has a small number of screens and does not need SSR, a public SEO surface, or complex routing. Reducing runtime dependencies lowers bundle size and upgrade risk. If UI complexity later justifies a framework, the core/domain and Firebase layers are already isolated so the UI can be replaced without migrating stored data.
