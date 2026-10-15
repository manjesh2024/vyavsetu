# Vyavsetu Demo Verification

## Validated by local/static checks
- Current `app.html` embedded JavaScript parses successfully.
- POS: per-item add/quantity controls, stock ceiling, subtotal/tax/total, empty-cart guards and provisional-bill creation/resume.
- POS payment modes: Cash, Dummy UPI and Dummy Card.
- Marketplace: shop browsing, per-item basket, one-shop-per-order rule, delivery name/phone/address validation and Cash on delivery / Dummy UPI / Dummy Card.
- Payment simulation: approval, decline, and timeout/unknown reconciliation state.
- Orders & receipts: browser-local order history, receipt detail, receipt print, JSON export.

## Dummy payment behaviour
- POS Cash records a demo cash payment after the operator confirms the sale.
- Dummy UPI/Card approval records a demo-only paid status with a `DUMMY-*` reference. No gateway is contacted and no money moves.
- Marketplace Cash on delivery records a confirmed order which is not marked paid.
- Decline creates no new order and leaves the basket unchanged.
- Timeout/unknown creates a pending-reconciliation record and is not marked paid.
- Receipt output is labelled demo-only, not a statutory tax invoice.

## Not production-ready
- Cart/orders live only in this browser's localStorage.
- No real API/database, authentication, server-side authorization, authoritative tax, legal invoice numbering, gateway/webhook, stock-sync, cross-device persistence or real printer driver is integrated.
- Tax and delivery values are illustrative demo rules.
- Physical-device end-to-end testing has not yet been performed.

## CI
GitHub Actions workflow `.github/workflows/test-demo.yml` runs embedded JavaScript syntax and static capability checks on pushes and pull requests.
