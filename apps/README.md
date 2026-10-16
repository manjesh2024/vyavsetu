# Vyavsetu Standalone App Prototypes

This folder introduces isolated web prototypes alongside the existing Vyavsetu root experience. The existing `index.html` and root demo are not replaced.

## App entry points

- `index.html` — prototype launcher
- `customer/index.html` — premium customer shopping experience
- `driver/index.html` — delivery partner workflow
- `store/index.html` — merchant/store workflow

## Current prototype scope

**Customer:** category browsing, product search/filtering, quantity-based persistent cart, checkout form, dummy payment-method selection, browser-local order history, profile, order confirmation.

**Driver:** go online/offline, accept/decline a demo assignment, confirm pickup, start delivery, OTP verification (demo OTP: `2468`), earnings and partner profile.

**Store:** demo order queue, accept/reject, preparing → ready → handover, browser-local stock management, add product, sales overview, store profile.

## Deliberate integration boundary

All three prototypes use independent browser-local demo state. They are **not connected to one another yet** and do not dispatch real orders, charge payments, track live routes, send push notifications, or authenticate users. This is intentional: review each product surface and workflow first, then implement an explicit shared order adapter for existing Vyavsetu marketplace demo data.

## Branding and reference

The user-supplied grocery-shopping screenshot is a UX reference for category density and shopping flow only. Vyavsetu’s existing logo assets, green/navy palette, original copy, layout and components are used for an independent design; the reference app’s name or artwork is not copied.

## Run locally

From the repository root:

```sh
python3 -m http.server 8000
```

Then open `http://localhost:8000/apps/` and select an app. No build step is required.
