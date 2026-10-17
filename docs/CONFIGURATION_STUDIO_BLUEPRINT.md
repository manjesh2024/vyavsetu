# Vyavsetu Configuration Studio — Product Blueprint & Engineering Handoff

**Document status:** Proposed product contract + implementation blueprint  
**Prototype status:** Isolated browser-only sandbox at `/studio/`  
**Production status:** Not implemented; no existing app consumes this configuration yet  
**Last updated:** 2026-10-17

> **Safety contract:** This initiative must not change the current working demo behaviour. The Studio preview is a separate sandbox and uses its own storage namespace. It does not modify `app.html`, root `index.html`, Customer, Store, Driver or existing POS preview logic. Do not connect it to live screens until the production configuration service and adapters are implemented and tested.

## 1. Product vision

Vyavsetu should give authorised administrators a controlled way to configure the experience each audience sees, without requiring a code release for every supported change. This is a **configuration-driven product layer**, not a promise that arbitrary new business logic can be invented without engineering.

An admin should be able to:
- change supported brand tokens and screen layouts;
- add, remove, reorder, hide and configure supported page sections;
- create dynamic forms from approved field types and validation rules;
- create catalog categories and control where they are visible;
- configure navigation/module visibility by app surface, role, plan and store;
- preview changes against realistic Customer, POS, Store, Driver and Business Admin shells;
- save a draft, validate it, publish a version, inspect history and roll back;
- control whether a configuration is global, tenant-wide, store-specific or limited to an app surface.

For new workflows, integrations, payment behaviour, hardware support or domain operations that are not supported by registered components/services, developer implementation is still required.

## 2. Existing demo protection

### Do not modify as part of the isolated Studio milestone
- `app.html`
- root `index.html`
- `apps/customer/index.html`
- `apps/store/index.html`
- `apps/driver/index.html`
- existing business logic, checkout, localStorage keys and receipt flows.

The only existing files allowed to receive documentation links are README/documentation portal/developer-handoff files. No existing app is allowed to read the Studio draft or "published" browser value.

### Sandbox storage contract
The static prototype may persist its own demo data under a namespaced key such as `vyavsetu_studio_sandbox_v1`. This is strictly a Studio-only mock. It must never reuse, enumerate, clear or overwrite existing application keys. No API requests, payment calls or production publish calls are made.

### Integration rule
Only integrate after a separately reviewed change adds the production database/API, authentication/authorization, schema validation, configuration resolver, app adapters, migration tests and feature flags. Integration must happen incrementally, on a separate branch, with a quick rollback path.

## 3. Product surfaces and configuration scope

| Surface key | Intended audience | Examples of safe configuration |
|---|---|---|
| `customer_app` | End customer | Home sections, banners, visible category groups, product-card style, supported profile/checkout fields |
| `pos` | Cashier / counter operator | Quick tiles, visible categories, allowed auxiliary fields, screen layout density, optional panels |
| `store_app` | Store / restaurant staff | Order-list columns, supported order detail fields, operational menu visibility |
| `driver_app` | Delivery driver | Task-card display fields, help/safety content, supported checklist form |
| `business_admin` | Tenant owner/manager | Dashboard widgets, menu groups, reports shortcut visibility, business forms |
| `super_admin` | Platform operator | Global starter templates, plan capabilities, platform-level navigation; never unrestricted tenant customer data by default |

Each config must declare its target surface and optional route/page. A change targeting Customer App must not bleed into POS or other tenants. Do not treat hiding a UI entry as authorization: every protected API operation still needs server-side permission checks.

## 4. Admin authority and inheritance

Use an explicit configuration resolution order:
1. **Platform baseline** — system-defined defaults and safe component registry.
2. **Platform template** — approved starting points that Super Admin publishes.
3. **Tenant override** — a business-specific copy/override within plan entitlements.
4. **Store/location override** — optional and only for configuration types approved to vary by location.
5. **Runtime capability policy** — current app version, role, subscription entitlement and feature flags can restrict what renders.

The runtime policy may remove a capability but must not grant a capability forbidden by the platform/plan. Store overrides must not mutate the tenant base. Resolve and publish immutable snapshots; do not live-merge arbitrary unvalidated JSON on every widget build.

### Role matrix

| Capability | Super Admin | Tenant Owner/Admin | Store Manager | Cashier / Store Staff | Driver |
|---|---|---|---|---|---|
| Publish global templates | Yes, audited | No | No | No | No |
| Configure tenant pages/themes | Support/limited override only | Yes, per plan | Optional delegated scope | No | No |
| Manage tenant categories | Platform defaults only | Yes | Optional store scope | No | No |
| Build forms | Platform-approved schemas | Yes, supported fields | Assigned forms only | Fill assigned forms | Fill assigned driver forms |
| Change permissions/plan | Platform policy | Assign within granted permissions | No | No | No |
| View customer PII | Explicit support workflow, audited, minimum necessary | Only operationally necessary | Assigned store scope | Minimum necessary | Assigned delivery scope only |

The production authorizer must check capability + tenant + store + surface + resource. Never rely on hidden buttons.

## 5. Studio information architecture

Recommended primary navigation:
1. **Overview** — draft/published status, validation warnings, recent versions and impacted surfaces.
2. **Design System** — brand tokens, logo variant, typography scale, spacing/radius and supported themes.
3. **Page Builder** — select app surface/page, add/reorder/configure approved components, visibility rules.
4. **Form Builder** — form fields, types, labels, required/optional, validation, options, conditions and preview.
5. **Catalog & Categories** — category hierarchy, image/icon, sort order, product association, surface visibility.
6. **Navigation & Modules** — menu ordering, roles, plan-entitlement constraints and supported module visibility.
7. **Preview & Validation** — responsive surface preview, accessibility/contrast checks and schema/business validation.
8. **Publish & History** — draft validation, publish confirmation, immutable release, diff and rollback.
9. **Audit Log** — actor, tenant, scope, action, before/after version, timestamp and correlation ID.

### Change workflow

```text
Choose tenant + surface
  -> Edit draft
  -> Autosave / Save draft
  -> Validate schema + permissions + dependencies
  -> Preview at supported viewport(s)
  -> Review diff + impacted surfaces
  -> Publish version (permission + optional approval)
  -> Notify clients / invalidate config cache
  -> Clients fetch immutable published snapshot
  -> Monitor usage/errors
  -> Roll back to previous valid snapshot if required
```

A draft must never affect a live app. Publish should be explicit and produce a versioned, auditable release. Rollback should create a new release that points to a prior known-good snapshot; never delete audit history.

## 6. Safe component registry

The Page Builder renders only components registered and versioned by engineering. Initial allowlist:

| Component type | Configurable properties | Not allowed in config |
|---|---|---|
| `hero_banner` | title, subtitle, approved asset ID, CTA label/route, theme token | arbitrary script or raw HTML |
| `category_grid` | category IDs, columns within bounds, icon style, order | direct SQL or arbitrary data query |
| `product_carousel` | approved collection ID, card variant, max item count | arbitrary endpoint URL |
| `quick_actions` | registered action IDs, order, labels | arbitrary executable action |
| `summary_cards` | approved metric IDs, density | arbitrary cross-tenant metric |
| `data_table` | registered data resource, approved columns, sorting | unrestricted filter/query expression |
| `notice_panel` | text, severity token, optional approved link | script, unsafe embedded URL |
| `form_renderer` | published form schema ID | unvalidated client-only business rules |
| `order_status_timeline` | allowed status view and density | arbitrary order-state transition |
| `image_gallery` | approved media IDs and layout | arbitrary remote file execution |

Unknown component types must fail closed, be reported to telemetry and fall back to a safe placeholder. Config controls presentation and selection of registered capabilities; domain operations remain in domain services.

## 7. Dynamic form contract

### Supported field types for MVP
- `text`, `multiline_text`, `email`, `phone`
- `integer`, `decimal`, `currency` (currency remains server-validated)
- `single_select`, `multi_select`, `checkbox`, `switch`
- `date`, `time`
- `image_upload` using an authorized upload flow
- `address_reference` using a registered address picker

Each field has a stable ID/key, type, label, hint, required flag, default (where safe), visibility condition, validation rules and option source. Keys must be unique within a form and immutable after first use unless migrated.

### Example form schema

```json
{
  "schemaVersion": 1,
  "formKey": "customer_delivery_preferences",
  "title": "Delivery preferences",
  "target": { "surface": "customer_app", "route": "checkout" },
  "fields": [
    {
      "id": "delivery_instructions",
      "key": "deliveryInstructions",
      "type": "multiline_text",
      "label": "Delivery instructions",
      "required": false,
      "maxLength": 240
    },
    {
      "id": "contactless_delivery",
      "key": "contactlessDelivery",
      "type": "switch",
      "label": "Contactless delivery",
      "required": false,
      "defaultValue": true
    }
  ],
  "submitAction": "customer.checkout.update_delivery_preferences"
}
```

`submitAction` must reference a registered, authorized server action. It is not a URL or executable string. Every submitted payload must be validated by the backend against the exact published schema version and the actor's scope. Flutter validation improves UX but is not a security boundary.

### Field schema evolution
- Draft changes may freely change fields until validation.
- Published schemas are immutable.
- Never rename/delete a field key with stored responses without a migration plan.
- Required-field additions can block old app versions; use minimum-client-version or compatibility policy.
- Unknown fields from offline/old clients should be rejected with a useful field-level error or handled via an explicit compatibility adapter. Do not silently discard business data.

## 8. Design token contract

Use semantic token names, not arbitrary per-widget CSS strings. Initial groups:
- brand: `primary`, `secondary`, `accent`
- surface: `canvas`, `surface`, `surfaceElevated`, `border`
- text: `textPrimary`, `textSecondary`, `textOnPrimary`
- status: `success`, `warning`, `danger`, `info`
- shape: approved radius scale
- spacing: approved spacing scale
- typography: named text styles mapped to registered platform styles
- themes: light/dark/high-contrast and approved variants

Validate colour formats and contrast. Keep responsive breakpoints and accessibility minimums controlled by engineering. Logo choice must be one of repository/tenant-upload-approved asset references, not arbitrary executable markup. User-supplied media must be validated, scanned and served through authorized storage.

## 9. Category and catalog contract

Category configuration covers name, stable key, parent ID, image/media reference, sort order, active status and per-surface visibility. Category visibility is not the same as product authorization or stock availability.

- Customer catalog lists only published, customer-visible categories with eligible items.
- POS may use a different category order and quick-access set.
- Store/restaurant operations may use operational categories distinct from consumer merchandising.
- A category referenced by a product/order must be deactivated or migrated safely rather than physically deleting history.
- Visibility is combined with tenant scope, store scope, product availability, subscription entitlements and user permissions.
- Category/product writes must be auditable and conflict-aware.

## 10. Navigation, modules and capabilities

A menu item should reference a registered route/capability key, not an arbitrary route string. Configuration can order/hide menu entries where policy allows; backend authorization remains authoritative.

Each module declares:
- stable module/capability key;
- required permissions;
- required plan entitlement;
- supported surfaces and minimum client version;
- data dependencies;
- offline support class: `read_cached`, `queue_writes`, or `online_required`;
- owner domain/module and acceptance tests.

If a module is disabled, existing stored records remain intact. Never delete data just because a navigation entry is hidden or a subscription lapses. Define read/export/grace-period policy separately.

## 11. Production architecture

```text
Flutter Studio (Admin Web/Desktop)
  -> HTTPS /api/v1/admin/configurations
  -> Spring Security (identity + tenant + role + entitlement)
  -> Configuration module
       -> Draft service + JSON Schema validation
       -> Component/form registry
       -> Publish/version service
       -> Rollback + diff service
       -> Audit writer
  -> PostgreSQL (immutable published snapshots + audit + scope)
  -> Outbox/event publisher (after transaction commit)
  -> WebSocket/STOMP config-change notice (foreground clients)
  -> FCM/APNs push where justified
  -> Flutter runtime configuration adapter
       -> surface/tenant/store/role/app-version resolver
       -> in-memory + secure/local cache
       -> approved component/form renderer
```

REST is authoritative for draft, validate, publish, rollback and fetching the configuration snapshot. WebSocket/STOMP is a notification channel that a newer version is available; clients should fetch the authoritative snapshot over REST. Push notification is needed only for relevant background/terminated-app scenarios. The current HTML demo is not wired to any of these services.

### Proposed Spring Boot module ownership
- `configuration.api`: controllers, request/response DTOs, OpenAPI contracts
- `configuration.application`: draft, validate, publish, rollback use cases
- `configuration.domain`: scope, version, publication and compatibility rules
- `configuration.infrastructure.persistence`: repositories/mappers
- `configuration.infrastructure.validation`: JSON Schema and registered component validators
- `configuration.infrastructure.events`: outbox + publish notifications
- `configuration.audit`: audit record writer (or shared audit module)
- `catalog`: category/product truth and eligibility
- `identity`: principal, membership and permission evaluation
- `subscription`: plan entitlements/capability limits

Do not let the configuration module own order, payments, inventory or delivery domain rules.

## 12. Proposed REST contracts (not implemented)

Prefix: `/api/v1`. These are proposals to merge with the canonical API catalogue during backend implementation; do not present them as running endpoints.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/admin/configs?surface=&scopeType=&status=` | List configs visible to current admin |
| `POST` | `/admin/configs` | Create draft from a template |
| `GET` | `/admin/configs/{configId}` | Read draft/metadata |
| `PATCH` | `/admin/configs/{configId}/draft` | Save draft, with version precondition |
| `POST` | `/admin/configs/{configId}/validate` | Validate schema, references, permissions and compatibility |
| `POST` | `/admin/configs/{configId}/preview-token` | Issue short-lived preview token, no publish |
| `POST` | `/admin/configs/{configId}/publish` | Publish immutable version, idempotent |
| `GET` | `/admin/configs/{configId}/versions` | List versions/diffs |
| `POST` | `/admin/configs/{configId}/rollback` | Publish a rollback release to a prior version |
| `GET` | `/runtime/config?surface=&storeId=&appVersion=` | Resolve published config for signed-in actor |
| `GET` | `/runtime/config/versions/{versionId}` | Fetch immutable snapshot / ETag |
| `GET` | `/admin/component-registry` | Get capabilities allowed for this admin/surface |
| `GET` | `/admin/form-schemas?surface=` | List authorized form definitions |
| `POST` | `/admin/form-schemas` | Create draft form schema |
| `PATCH` | `/admin/form-schemas/{id}/draft` | Update a form draft |
| `POST` | `/admin/form-schemas/{id}/validate` | Validate the schema |
| `POST` | `/admin/form-schemas/{id}/publish` | Publish immutable form schema |
| `GET` | `/admin/categories?surface=&storeId=` | List scoped catalog categories |
| `POST` | `/admin/categories` | Create category |
| `PATCH` | `/admin/categories/{categoryId}` | Update category |
| `POST` | `/admin/categories/{categoryId}/deactivate` | Soft-deactivate with history safeguards |

Every endpoint needs authenticated server authorization, tenant scope, validation, audit events, request correlation and stable error codes. Use `If-Match`/version for conflicting draft edits and `Idempotency-Key` for publish/retryable commands.

### Runtime response envelope example

```json
{
  "data": {
    "configId": "cfg_01J...",
    "version": 12,
    "surface": "customer_app",
    "schemaVersion": 1,
    "publishedAt": "2026-10-17T09:30:00Z",
    "theme": { "primary": "#0F2D4A", "accent": "#16C47F" },
    "pages": {
      "home": [
        { "id": "hero-main", "type": "hero_banner", "props": { "title": "Discover local favourites" } },
        { "id": "categories", "type": "category_grid", "props": { "categoryIds": ["cat-grocery", "cat-bakery"] } }
      ]
    },
    "forms": [{ "formKey": "customer_delivery_preferences", "schemaVersion": 3 }]
  },
  "meta": { "requestId": "req_01J...", "etag": "\"cfg-v12\"" }
}
```

The example is illustrative; identifiers, exact fields and envelope must match the canonical API contract when implementation begins. Do not expose internal tenant IDs or config data the current actor cannot view.

## 13. Proposed PostgreSQL model

Recommended first pass:
- `configuration_documents`: ID, owner scope type/ID, tenant ID nullable for global, surface, page key, status, current draft version, created/updated by.
- `configuration_versions`: ID, configuration ID, monotonically increasing version, schema version, JSONB snapshot, checksum, validation result, created by/time; immutable after creation.
- `configuration_publications`: ID, scope, surface, version ID, published by/time, rollout state, optional previous publication.
- `configuration_assignments`: target scope and surface mapped to a published version or approved template.
- `configuration_templates`: platform template metadata and approved starting snapshot.
- `form_schemas` / `form_schema_versions`: stable form key, target surface, immutable versioned schema.
- `form_submissions`: tenant/store/resource context, form/schema version, actor, validated payload JSONB, submission state, audit references.
- `category_visibility_rules`: category, surface, optional store scope, visibility and order.
- `component_registry_versions`: registered component key/version, supported schema, minimum app version and release status.
- `configuration_audit_events`: actor, action, scope, old/new version, request ID, timestamp, outcome.
- `outbox_events`: publication event committed in the same transaction for reliable downstream notification.

Prefer relational columns for identity, ownership, state, scope, foreign keys and query-critical fields; JSONB for validated version snapshots and extensible form payloads. Add tenant-aware indexes and enforce tenant scope in repositories/query predicates. Evaluate PostgreSQL row-level security as defence in depth, not a substitute for authorization tests.

### Tenant isolation
- Global templates contain no tenant private data.
- Every tenant-owned object carries a tenant boundary (directly or through a guaranteed parent relation).
- Store-level data carries a store boundary and tenant relationship.
- Tests must try cross-tenant ID substitution on read, update, preview, publish and rollback.
- Support access is temporary, reason-coded and audited.
- Do not allow clients to claim `tenantId`, `role` or plan entitlement as proof; derive/verify these from the authenticated principal and membership.

## 14. Draft/publish lifecycle and operational controls

Recommended states:
- `DRAFT`: editable, invisible to runtime clients.
- `VALIDATED`: schema and dependency validation passed for a precise snapshot.
- `PUBLISHED`: immutable snapshot assigned to an explicit scope.
- `SUPERSEDED`: a later version is active; old version remains fetchable for compatible clients/history.
- `ROLLED_BACK`: historical version is superseded by a new rollback publication.
- `REJECTED`: optional approval workflow rejected the requested publication.

Publish procedure: lock/check draft revision; validate one canonical snapshot; enforce actor scope and entitlement; check minimum client compatibility; persist immutable version and publication in a transaction; append audit + outbox event; commit; asynchronously notify clients. If any transactional stage fails, do not claim publish success. Notifications can retry without republishing the version.

Rollout options: immediate for low-risk copy/visual changes; staged percentage only when server identity/consistent assignment makes it deterministic; explicit tenant/store canary for critical workflows. Never A/B-test statutory invoice/legal text without compliance approval.

## 15. Flutter implementation contract

Build a shared package (suggested name `vyavsetu_config_runtime`) only after the API contract is accepted:
- Typed immutable config DTOs with `schemaVersion`, `configVersion`, `surface`, `tenant/store scope` and ETag.
- Repository: cached snapshot first, fetch latest in background, validate compatibility, persist only verified published snapshots.
- Cache key includes tenant, store where applicable, surface and config version.
- Approved widget registry maps `type + supported version` to a Flutter widget factory.
- Unsupported component/schema: safe fallback, telemetry, keep rest of page usable.
- Form renderer maps field type to registered control; local validation is UX-only; API validates again.
- Navigation maps only allowlisted capability keys to routes.
- Use semantic design tokens and respect text scaling, contrast, reduced motion where applicable, keyboard navigation and screen readers.
- Emit telemetry with config version/surface (no unnecessary personal form values).
- On app resume or version notice, fetch authoritative config via REST; if unavailable, use last known compatible published snapshot.

Offline POS policy:
- A previously published compatible config can be used offline.
- Draft configurations are never used by ordinary runtime users.
- POS sale/payment/invoice business semantics cannot be altered by a presentation config.
- Changes to required fields must have an explicit offline/version compatibility plan.
- Cache expiration does not block core billing if a compatible last-known-good config exists; display a safe stale-config notice when necessary.

## 16. Validation, security and abuse prevention

Reject:
- arbitrary HTML, JavaScript, Dart source, eval, script tags, inline event handlers or executable expressions;
- arbitrary URLs for network calls/redirects; use approved asset IDs and registered route/action keys;
- SQL, query fragments, unbounded regular expressions, recursive schema references or excessive nesting;
- unregistered components, fields, metrics, data sources, actions and permission names;
- fields or workflows that expose PII beyond actor scope;
- configs exceeding size/depth/list limits or supported component property constraints.

Validate on server using a versioned schema; normalize/escape text output; sanitize uploaded media; enforce content security policy; rate-limit preview/publish endpoints; require CSRF protection if cookie auth is used; store tokens securely; audit high-risk publication; protect against mass assignment and IDOR. JSON Schema validation does not replace authorization or domain validation.

## 17. Accessibility and responsive acceptance

- Desktop: two/three-panel Studio, editable property panel, live preview.
- Tablet: collapsible left navigation and preview panel.
- Phone: single-column navigation, builder, then preview; no clipped save/publish controls.
- Keyboard navigation and focus order for drag/reorder actions; provide move-up/down alternatives.
- Screen-reader labels for controls; error summaries and field-level errors.
- Contrast checked for text/status; do not rely only on colour.
- Browser zoom and OS text scaling work without hidden critical controls.
- Preview must visibly label itself as Preview and indicate target surface/config version.
- Destructive changes and publish/rollback require confirmation.

## 18. Acceptance criteria

### Isolated prototype
- [ ] Has a dedicated route/folder and no import/include from existing app files.
- [ ] Uses a separate Studio-only localStorage namespace.
- [ ] Design, page sections, form fields, categories and module visibility can be edited in the Studio.
- [ ] Target surface selector previews Customer, POS, Store, Driver and Business Admin independently.
- [ ] Draft can be saved/reloaded in Studio; reset affects only Studio key.
- [ ] Preview/Publish labels explicitly say sandbox/local-only.
- [ ] No existing checkout, order, receipt or current app storage keys are read/changed.
- [ ] Responsive layout works at desktop and phone widths; no new third-party dependency.

### Production release
- [ ] Tenant/store/RBAC/entitlement rules enforced server-side.
- [ ] Immutable versioning, schema validation, draft, publish, diff, audit and rollback.
- [ ] Component/form/action registry has allowlist and compatibility policy.
- [ ] Cross-tenant security and concurrency tests pass.
- [ ] Runtime adapters for every supported Flutter surface pass contract and widget tests.
- [ ] Offline POS falls back to last-known-good config without breaking billing.
- [ ] Feature-flagged rollout, telemetry, alerting and rollback drill pass.
- [ ] API/OpenAPI, database migrations, runbooks and agent instructions are current.

## 19. Suggested implementation phases

1. **Safe demo sandbox:** standalone Studio UI, independent local storage, live mock preview, no app integration.
2. **Contract review:** sign off scope inheritance, component registry, form schema, category visibility and version compatibility.
3. **Backend foundation:** auth/RBAC, schema tables/migrations, config draft/version/validate/publish API and audit/outbox.
4. **Web Admin integration:** replace mock draft repository with API repository behind a feature flag; don't connect other apps yet.
5. **Read-only runtime adapter:** one target surface (recommended Business Admin or Customer) fetches published config and renders allowlisted components.
6. **Controlled forms/categories:** add server-validated dynamic fields and scoped catalog visibility.
7. **POS last-known-good support:** offline cache and compatibility checks, with invariant billing logic untouched.
8. **Remaining surfaces:** Store, Driver, Customer and other approved pages one by one, with contract tests.
9. **Operations:** permissions review, tenant penetration tests, observability, rollout and rollback drills.

At each phase, preserve a changelog and update the developer handoff/API blueprint. Keep implementation in isolated feature branches and review the diff before merge.

## 20. Agent/developer execution brief

Give this instruction to a coding agent:

> Read `docs/CONFIGURATION_STUDIO_BLUEPRINT.md` completely, then inspect the current repository before changing anything. The current HTML demo must remain behaviourally unchanged. Work on a dedicated branch. For the sandbox milestone, only create/update files under `studio/` plus explicitly approved documentation files. Do not edit `app.html`, root `index.html`, `apps/customer/`, `apps/store/`, or `apps/driver/`. Do not integrate the Studio with current app localStorage or claim production APIs exist. Implement only registered, safe configurable components; never execute admin-authored code/HTML. Add tests/checks, update the blueprint with decisions and known limits, and report changed paths, verification performed, and anything not verified. For production milestones, do not proceed until the configuration API, ownership/scope rules, schema migrations and authorization tests are accepted.

## 21. Related docs and links

- [Developer portal](index.html)
- [API architecture and Java blueprint](API_ARCHITECTURE.md)
- [Architecture flowcharts](ARCHITECTURE_FLOWCHARTS.md)
- [Developer handoff](DEVELOPER_HANDOFF.md)
- [Brand guidelines](BRAND.md)
- [Demo test report](TEST_REPORT.md)
- Isolated sandbox source: `studio/index.html`

**Remember:** Configuration makes registered behaviour configurable. It does not automatically create new backend business capabilities. Any new product capability must be added to domain/API services, authorised, tested and documented.
