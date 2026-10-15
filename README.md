# Vyavsetu

**One Ecosystem. Every Business.**

Vyavsetu is a responsive product prototype for a connected business platform spanning retail POS, restaurant operations, inventory, customer marketplace, delivery, and SaaS administration.

## Demo

Open `index.html` locally, or enable GitHub Pages from **Settings → Pages → Deploy from a branch → main / (root)**.

## Prototype features

- Responsive layouts for desktop, laptop, store POS, tablet/iPad, Android and iPhone viewport previews.
- Light, Dark, Ocean, Forest and High Contrast themes.
- Demo surfaces for Business Admin, POS Terminal, Restaurant/KDS, Customer Marketplace, Driver App and SaaS Super Admin.
- Sample data only; no live payments, backend synchronization, statutory invoicing, or production authentication.

## Brand assets and developer handoff

- [Light logo lockup](assets/vyavsetu-lockup-light.svg)
- [Dark logo lockup](assets/vyavsetu-lockup-dark.svg)
- [Horizontal logo](assets/vyavsetu-horizontal.svg)
- [Primary mark](assets/vyavsetu-mark.svg)
- [Logo asset usage guide](assets/README.md)
- [Developer handoff specification](docs/DEVELOPER_HANDOFF.md)
- [Architecture and business flowcharts](docs/ARCHITECTURE_FLOWCHARTS.md)
- [Responsive device QA matrix](docs/RESPONSIVE_DEVICE_MATRIX.md)

Open **Developer Access** from the in-demo navigation for a visual brand and flowchart reference.

## Brand direction

- Name: Vyavsetu
- Tagline: One Ecosystem. Every Business.
- Navy: `#0F2D4A`
- Green: `#16C47F`
- Cyan: `#0EA5E9`
- Orange: `#F59E0B`
- Typography: system sans-serif with Poppins-style geometric direction

## Run locally

No build step is required. Open `index.html` in a modern browser. For a local server, run `python3 -m http.server 8000` and visit `http://localhost:8000`.

## Project status

This repository contains a presentation/demo prototype, not the production application. Production work will need the agreed Flutter clients, Spring Boot backend, PostgreSQL, offline POS storage, authentication/authorization, tenant isolation, audit logs, idempotent synchronization and payment/invoice integrations.

See `BRAND.md` and `docs/` for brand notes and implementation phases.