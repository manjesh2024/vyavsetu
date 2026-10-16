# Vyavsetu — Developer Handoff

**Tagline:** One Ecosystem. Every Business.  
**Status:** Interactive demo prototype; not a production billing system.

## 1. Product scope

Vyavsetu is a connected commerce platform for restaurant and retail businesses. The intended product family includes:

- Business Admin: stores/locations, catalog, staff, reports and settings.
- POS Terminal: offline-capable counter billing, provisional bill, payment and final invoice.
- Restaurant / KDS: order routing, kitchen ticket lifecycle and service status.
- Inventory & Purchasing: stock ledger, receiving, transfers, reorder alerts and purchase approvals.
- Customer Marketplace: discovery, catalog, cart, checkout, customer order timeline.
- Driver App: assigned deliveries, pickup, proof of delivery and delivery completion.
- SaaS Super Admin: tenants, plans, subscriptions, entitlements, support, platform audit and feature flags.
- Developer Access: brand assets, design tokens, responsive rules, diagrams, business invariants and developer checklist.

The current HTML demo presents sample data and illustrative interactions. It does not implement real identity, payment, tax, statutory invoices, database persistence, hardware, or server synchronization.

## 2. Brand guidelines

### Official direction
- Brand: **Vyavsetu**
- Tagline: **One Ecosystem. Every Business.**
- Concept: three-petal V-inspired mark; a bridge between merchants, customers, operations and delivery.
- Logo files:
  - [Light-background lockup](../assets/vyavsetu-lockup-light.svg)
  - [Dark-background lockup](../assets/vyavsetu-lockup-dark.svg)
  - [Horizontal lockup](../assets/vyavsetu-horizontal.svg)
  - [Primary mark](../assets/vyavsetu-mark.svg)
  - [Navy monochrome mark](../assets/vyavsetu-mark-navy.svg)
  - [White monochrome mark](../assets/vyavsetu-mark-white.svg)
  - [Light app icon](../assets/vyavsetu-app-icon-light.svg)
  - [Dark app icon](../assets/vyavsetu-app-icon-dark.svg)

The SVG lockups use vector paths for scalable rendering. Before external print production or legal brand registration, compare these vector files against the approved visual reference and complete trademark clearance.

### Colour tokens

| Token | HEX | Intended use |
|---|---|---|
| Navy | `#0F2D4A` | Brand text, dark surfaces, stability |
| Growth Green | `#16C47F` | Primary actions, growth |
| Technology Cyan | `#0EA5E9` | Information, technology |
| Energy Orange | `#F59E0B` | Highlights, energy |
| Light Canvas | `#F4F7F9` | Page background |
| Surface | `#FFFFFF` | Cards and panels |
| Main Text | `#10283B` | Main copy |
| Muted Text | `#657D8D` | Secondary copy |

Theme variants in the demo: Light, Dark, Ocean, Forest, High Contrast. Production themes must share semantic token names (surface, on-surface, primary, border, success, warning, danger), not hardcode component-specific colours.

### Logo usage
1. Preserve proportions, artwork and colour assignments. Never stretch, rotate or add unapproved effects.
2. Keep clear space around the mark.
3. Use the full lockup where the audience needs to learn the brand; use mark-only for app icons and very compact controls.
4. Select a background-compatible variant. Verify contrast in light, dark and high-contrast modes.
5. Treat the SVG as the source of truth for digital display; raster exports should be regenerated from that source for any required pixel dimensions.

### Typography
Use a geometric sans-serif style consistent with Poppins for headings/brand presentation, with a system sans-serif fallback for performance and portability. Honour OS text scaling and browser zoom. Do not embed a font without reviewing its license.

## 3. Responsive design contract

The HTML preview includes viewport presets; final behaviour must be content-driven and adapt to the available width. These widths are starting breakpoints, not device-model detection rules.

| Layout | Starting width | Key expectations |
|---|---:|---|
| Desktop / laptop | ≥ 1200 px | Full navigation, multi-column analytics, dense tables |
| Business-store POS | 900–1199 px | Large touch targets, keyboard/scanner support, visible cart |
| Tablet / iPad | 620–899 px | Compact navigation, responsive panels, portrait/landscape |
| Android / iPhone | ≤ 619 px | Single column, safe-area insets, reachable actions, readable scaling |

Production acceptance must additionally test: split screen, landscape, keyboard visible, 200% zoom/text scaling, slow network, offline, long translations, empty/loading/error states and accessibility semantics. Touch targets should generally be at least 44 × 44 CSS px where practical.

## 4. Proposed production architecture

- Clients: Flutter apps/adaptive UI for Android, iOS, Web, Windows/macOS/Linux as agreed.
- Backend: Java Spring Boot modular monolith with explicit module boundaries and versioned APIs.
- Database: PostgreSQL.
- Local POS: Drift/SQLite with schema migrations and a transactional outbox.
- Auth: session/token validation, membership, tenant/location context and server-side RBAC.
- Modules: identity/session, organizations/tenants, roles/permissions, catalog, pricing/tax, orders, payments, invoices, inventory, purchasing, restaurant/KDS, marketplace, delivery, notifications, subscriptions/entitlements, audit and feature flags.
- Sync: local outbox → authenticated idempotent push → server validation/commit → acknowledgement → delta pull/reconciliation.
- Observability: structured logs, correlation IDs, redacted diagnostics, metrics and auditable operator actions.

## 5. Non-negotiable business rules

- All protected data reads/writes must be scoped by tenant and location on the server. Client-selected tenant IDs cannot be trusted by themselves.
- Server revalidates product, price, discounts, tax and stock at checkout.
- Use idempotency keys for order creation, payment submission, sync events and retryable mutations.
- Do not mark an order paid from a client-only callback. Verify gateway webhooks and reconcile uncertain payment results.
- Final invoices are immutable. Use explicit credit notes, refunds, void/reversal records according to jurisdictional rules.
- Separate provisional bills from legally final invoice identifiers.
- Store stock changes as auditable ledger movements with source references and defined conflict policy.
- Every significant status transition records actor, timestamp, source and outcome.
- Offline writes remain locally durable until acknowledgement; expose pending, syncing, synced, failed and conflict states.
- Failed requests must not erase drafts or silently indicate success.
- Cash-drawer opening is restricted to the configured payment/role policy; don't trigger it for online payment.
- Printer delivery is not the same as order/payment success; track print jobs separately.
- Server and database time remain authoritative for audit timestamps.

## 6. Decisions to close before implementation

1. Tax/legal jurisdiction, rounding, invoice fields and retention policy.
2. Offline invoice-number strategy: provisional references or server-reserved ranges.
3. Payment provider, webhooks, refunds, split and partial payments.
4. Exact receipt printer, drawer model, paper widths and supported connections.
5. Stock reservation and offline oversell policy across multiple terminals.
6. Marketplace checkout policy (recommended MVP: one merchant/store per order).
7. Authentication provider, account recovery and user/tenant onboarding.
8. Retention, backup, export and deletion policies for customer and audit data.

## 7. Test matrix

- Domain tests: pricing, taxes, rounding, discounts, permissions, order state machine, invoice immutability.
- API tests: tenant isolation, forbidden cross-tenant reads, request validation, idempotency and concurrency.
- Database tests: migrations from prior versions, transaction rollback, stock ledger consistency.
- Offline tests: kill/restart while pending, duplicate request, interrupted upload, auth expiry, conflict resolution and delta reconciliation.
- UI tests: responsive breakpoints, keyboard, scanner, touch, accessibility, loading/empty/error states and theme switching.
- Payments: success, failure, timeout/unknown result, webhook duplication, refund and reconciliation.
- Hardware: print success/failure/retry, 58/80 mm layouts, Windows printer setup, cash drawer open only under allowed conditions.
- Release: secrets review, dev/staging/prod config, migration plan, observability, backups and rollback.

## 8. Repository entry points

- `index.html`: device/theme preview launcher.
- `app.html`: interactive demo surfaces and Developer Access hub.
- `assets/`: logo assets.
- `docs/ARCHITECTURE_FLOWCHARTS.md`: Mermaid source for the target workflows.
- `docs/API_ARCHITECTURE.md` and `docs/api-architecture.html`: proposed REST endpoints, JSON contracts, current localStorage inventory, Drift/SQLite tables, PostgreSQL model and Spring Boot package design.
- `docs/RESPONSIVE_DEVICE_MATRIX.md`: viewport and QA matrix.
- `docs/QUICK_START_HINGLISH.md`: local demo startup.
