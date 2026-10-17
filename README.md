# Vyavsetu

**One Ecosystem. Every Business.**

Vyavsetu is a responsive product prototype for a connected business platform spanning retail POS, restaurant operations, inventory, customer marketplace, delivery, and SaaS administration.

## Demo

Open `index.html` locally, or enable GitHub Pages in **Settings → Pages → Build and deployment → Source → GitHub Actions**. Then rerun the workflow in the Actions tab.

## Prototype features

- Responsive layouts for desktop, laptop, store POS, tablet/iPad, Android and iPhone viewport previews.
- Light, Dark, Ocean, Forest and High Contrast themes.
- Demo surfaces: Overview, POS, Orders & Receipts, Products, Purchase Orders, Inventory, Suppliers, Customers, Returns/Refunds, Reports, Staff/Roles, Business Settings, Restaurant/KDS, Customer Marketplace, Driver App, SaaS Super Admin, Plans, Subscriptions, Support, Feature Flags and Developer Access.
- Functional browser-local demo interactions: product/supplier/customer/staff/tenant/plan/support CRUD; purchase receiving; stock adjustments; POS/marketplace checkout; dummy payment outcomes; provisional bills; receipt print/export; KDS transitions; driver pickup/route/OTP delivery; return/refund simulation; and CSV/JSON reports. No live gateway, backend sync, statutory invoices or production authentication.

## Visual developer documentation

**[Open the branded HTML Developer Documentation Portal](docs/index.html)**

This portal includes visual pages for architecture and business flowcharts, the Configuration Studio product blueprint, developer handoff, brand guidelines, responsive/device QA, test verification and Hinglish quick start. Each HTML page links to its source Markdown so the source documents remain editable in the repository.

- [Visual architecture & flowcharts](docs/architecture-flowcharts.html)
- [API architecture & Java blueprint — HTML view](docs/api-architecture.html)
- [API architecture & Java blueprint — Markdown source](docs/API_ARCHITECTURE.md)\n- [Configuration Studio — interactive isolated sandbox](studio/index.html)\n- [Configuration Studio — visual developer blueprint](docs/configuration-studio.html)\n- [Configuration Studio — full product/engineering spec](docs/CONFIGURATION_STUDIO_BLUEPRINT.md)
- [Visual developer handoff](docs/developer-handoff.html)
- [Visual brand guidelines](docs/brand-guidelines.html)
- [Visual responsive/device matrix](docs/responsive-device-matrix.html)
- [Visual test report](docs/test-report.html)
- [Visual quick start (Hinglish)](docs/quick-start-hinglish.html)

Logo assets: [light lockup](assets/vyavsetu-lockup-light.svg) · [dark lockup](assets/vyavsetu-lockup-dark.svg) · [horizontal logo](assets/vyavsetu-horizontal.svg) · [dark-theme horizontal logo](assets/vyavsetu-horizontal-dark.svg) · [primary mark](assets/vyavsetu-mark.svg) · [asset usage README](assets/README.md).

You can also open **Developer Access** from the in-demo navigation for the visual documentation library.

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
## Checkout demo

- POS: add items, change quantities, save a provisional bill, or check out using Cash, Dummy UPI or Dummy Card.
- Marketplace: choose a single shop, add items, enter a name/phone/address, then choose Cash on delivery or a dummy online method.
- Dummy payment results can be set to approved, declined or timeout/unknown to demonstrate the respective state transitions.
- Orders and receipts remain in this browser's localStorage. Dummy payments do not move money and receipts are not statutory tax invoices.
- [Demo verification checklist](docs/TEST_REPORT.md)

## Production boundary

The current checkout is client-side simulation only. Never use it for live commerce. Production requires server-authoritative pricing/tax, authentication/authorization, durable database transactions, idempotency, payment provider/webhooks, legal invoice numbering, stock concurrency policy, printing integration and offline sync.


## POSPro-style module coverage

The [POSPro documentation](https://doc.pospro.app/) groups the product into Super Admin workflows (businesses, categories, plans, subscriptions, staff, reports, roles/permissions and settings) and business workflows (sales, purchases, products, stock, customers, suppliers, tax, accounts and reports). Vyavsetu's demo models comparable module flows while retaining the restaurant, customer marketplace and driver surfaces.

### Try the core flows

1. POS: Products → add items → POS → adjust quantities → Continue to payment → choose Cash, Dummy UPI or Dummy Card.
2. Payment tests: choose Approved, Declined, or Timeout/Unknown. Declined preserves the basket; timeout becomes pending reconciliation; approved creates a demo receipt.
3. Purchasing: Purchase Orders → create draft → mark ordered → receive goods. Check Products and Inventory to see the stock change.
4. Marketplace: Customer App → add items → checkout. The order appears in Orders, creates a driver job and (for restaurant-style stores) a kitchen ticket. Driver status transitions update the order status.
5. Admin: Customers, Suppliers, Returns, Staff, Plans, Subscriptions, Support and Feature Flags have working local demo actions.

## Data and safety boundary

This is a functional local demo, not a production commerce platform. Records persist in this browser's localStorage; other devices and browsers do not share state. Dummy card/UPI never calls a gateway or moves funds. Tax and delivery values are configurable examples, not legal tax advice. Production still requires a server/database, authentication and tenant authorization, payment webhooks/idempotency, legal invoice numbering, printer drivers, offline sync, concurrency controls and real-device end-to-end testing.
