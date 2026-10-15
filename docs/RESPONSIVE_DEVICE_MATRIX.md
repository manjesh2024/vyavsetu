# Responsive Device & QA Matrix

## Layout breakpoints

| Class | Width guide | Layout | Primary validation |
|---|---:|---|---|
| Wide desktop | ≥1440 px | Full sidebar, multi-column dashboard, dense tables | No overflow; keyboard/mouse; readable tables |
| Desktop/laptop | 1200–1439 px | Full sidebar, responsive cards | Long business names; table filters; browser zoom |
| Store POS | 900–1199 px | Touch/scanner-first checkout | Search/scan, cart always visible, keyboard focus, totals readable |
| Tablet / iPad | 620–899 px | Compact nav, two-column/stacked panels | Portrait + landscape; split screen; touch targets |
| Mobile Android/iPhone | ≤619 px | Single-column, compact/scrollable nav | Safe areas, long labels, accessible focus, no horizontal overflow |

Treat these as initial web-demo breakpoints. Production Flutter layouts must use available constraints, orientation and text scaling rather than model-name checks.

## Theme validation

- Light: background/surface/text and borders stay distinct.
- Dark: all cards, menus, fields, disabled states and charts remain readable.
- Ocean and Forest: semantic meanings remain stable despite palette changes.
- High contrast: borders, focus rings and status states are distinguishable without colour alone.
- Persist user preference where expected; don't persist a one-time device-preview width as actual production layout.

## Critical application flows to test

- Login success, expired session, revoked membership, no permission, no tenant selected.
- POS: empty cart, out-of-stock, changed price, discount denied, cash, gateway success, decline, unknown timeout, duplicate click, invoice issue, print failure.
- Offline: mutate while offline, kill/restart, reconnect, duplicate push, server validation error, conflict, session expiry, pull while the user is already using a screen.
- Restaurant: duplicate/stale KDS transition, cancellation from each permitted state, kitchen/driver race for ready orders.
- Inventory: concurrent terminals, receiving, transfer, stock count correction, reorder threshold.
- Marketplace: closed store, out-of-zone delivery, item becomes unavailable, merchant rejects, driver declines, partial failure during notification.
- SaaS admin: trial expiry, downgrade, entitlement removal, tenant suspended, operator audit.
- Hardware: printer unavailable, out of paper, wrong width, drawer kick allowed/disallowed, reprint duplicate warning.

## Accessibility checklist

- Semantic labels for icons/buttons and clear focus order.
- Keyboard navigation for desktop POS/admin.
- Touch targets ideally ≥44×44 CSS px.
- 200% browser zoom and OS font scaling without clipping.
- Sufficient contrast in every theme; status not communicated by colour alone.
- Reduced-motion respect and no critical state conveyed by animation alone.
