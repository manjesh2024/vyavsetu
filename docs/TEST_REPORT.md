# Vyavsetu Demo Verification

## Automated checks
GitHub Actions runs JavaScript/feature-hook validation and a Chromium end-to-end test against the local static demo. Latest successful browser E2E run: https://github.com/manjesh2024/vyavsetu/actions/runs/38854401771. Latest successful Pages deploy: https://github.com/manjesh2024/vyavsetu/actions/runs/38854401855. Latest source commit covered by those runs: `5f2871742a38a358152c5651aec085d2e1f73e36`.

## Interactions covered by the prototype
- POS: product add/quantity controls, stock guard, illustrative total calculation, Cash/Dummy UPI/Dummy Card, provisional bill save/resume, clear cart.
- Dummy payment: Approved, Declined and Timeout/Unknown results; decline preserves basket, timeout remains pending reconciliation, approved demo checkout creates a receipt.
- Orders & receipts: local history, details, receipt printing, JSON orders export and CSV sales export.
- Product catalogue: create/edit/search/delete with active-cart guard.
- Purchase orders: create draft, mark ordered and receive; receiving increments the POS product and inventory SKU.
- Inventory: receive/adjust stock and save local stock history.
- Suppliers and customers: create/edit/delete local records; checkout also saves marketplace customer contact details.
- Restaurant KDS: create tickets; move New → Preparing → Ready → Served.
- Customer marketplace: browse three sample stores, manage quantities, one-store-per-order rule, validate customer name/phone/address and checkout using COD or dummy UPI/card.
- Driver: online/offline toggle, accept job, pickup, start route, OTP-confirmed delivery and status history. Marketplace checkout creates driver jobs and restaurant-style kitchen tickets.
- Returns/refunds: create request against a paid POS demo sale; approve/reject; optional restock and demo refund reference.
- Reports: sales summary, best-selling items, CSV/JSON export.
- Staff/roles, business settings, SaaS plans/subscriptions, tenants, support tickets and feature flags: browser-local create/update/toggle workflows.
- Developer Access: a six-card visual documentation library linking the hosted HTML developer handoff, brand guidelines, architecture flowcharts, responsive QA matrix, test report and Hinglish quick start. Original Markdown sources remain in `docs/`; the HTML pages link back to them.
- Responsive shell: no outer launcher/header banner; theme and Desktop/Laptop/Store POS/Tablet/Android/iPhone preview controls are inside the app workspace. The shell remains full-screen in Auto mode and resizes for the selected preview. The sidebar switches to a high-contrast white-wordmark logo in Dark theme and back to the navy-wordmark asset in Light theme; Chromium E2E asserts both sources load.

## Dummy payment semantics
- POS Cash records a demo paid sale only after confirmation.
- Dummy UPI/Card writes a local demo status and DUMMY reference; no gateway is called and no money moves.
- Marketplace COD creates a confirmed order but does not mark it paid.
- Decline creates no order and preserves the cart.
- Timeout/unknown creates a pending-reconciliation record, not a paid order. A real payment integration must reconcile uncertain outcomes before retry.
- Receipts are labelled demo-only and are not statutory tax invoices.

## Confirmed limitations
- Data persists in the current browser's localStorage only; separate devices and browsers do not share changes.
- No server/API/database, actual authentication/authorization, payment gateway/webhook, statutory tax engine/invoice numbering, physical printer, or cross-device offline sync is connected.
- Tax, delivery, demo OTP and subscription data are illustrative.
- Automated Chromium E2E passes for POS product-card taps and quantity controls, approved checkout and exact stock deduction, decline preserving the basket with no order created, timeout recorded as pending without stock deduction, marketplace checkout and customer capture, driver OTP delivery completion with exact order-ID status synchronization and duplicate-customer isolation, customer and supplier creation, simulated return/refund, staff record and business-settings persistence, purchase receiving, product creation, restaurant KDS New → Preparing → Ready → Served transitions, inventory adjustment plus stock history, receipt print-layout rendering for 58 mm, 80 mm and A4, all module navigation, Developer Access documentation-card visibility, theme-aware sidebar logo switching with successful image loading in Light and Dark modes, in-app device preview switching, and phone viewport/overflow checks. This validates generated layouts and browser behavior, not physical printer output or actual iOS/Android/iPad/Windows hardware. Never use this prototype for live sales or real customer data.
