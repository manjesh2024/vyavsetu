# Vyavsetu Architecture & Business Flowcharts

These are proposed production workflows, not implemented backend behaviour. Mermaid diagrams display in GitHub Markdown.

## 1. High-level platform architecture

```mermaid
flowchart TB
  subgraph Clients["Client surfaces"]
    POS["Flutter POS / Offline Local DB"]
    ADMIN["Business Admin"]
    SUPER["SaaS Super Admin"]
    CUSTOMER["Customer Marketplace"]
    DRIVER["Driver App"]
  end
  POS --> API["Authenticated API boundary"]
  ADMIN --> API
  SUPER --> API
  CUSTOMER --> API
  DRIVER --> API
  API --> AUTH["Identity, Session, Tenant & RBAC"]
  API --> MODS["Spring Boot Modular Monolith"]
  MODS --> ORDERS["Orders / Checkout / Billing"]
  MODS --> STOCK["Catalog / Pricing / Inventory"]
  MODS --> FOOD["Restaurant / Kitchen"]
  MODS --> DELIVERY["Marketplace / Delivery"]
  MODS --> SAAS["Plans / Subscriptions / Entitlements"]
  MODS --> AUDIT["Audit / Notifications / Feature Flags"]
  ORDERS --> PG[("PostgreSQL")]
  STOCK --> PG
  FOOD --> PG
  DELIVERY --> PG
  SAAS --> PG
  AUDIT --> PG
  POS <--> OUTBOX["Drift / SQLite Outbox + Delta Cache"]
  OUTBOX -->|"Authenticated idempotent sync"| API
```

## 2. Login, tenant selection and authorization

```mermaid
flowchart TD
  A["Launch / login"] --> B{"Valid session?"}
  B -- No --> C["Authenticate / recover session"]
  C --> D{"Identity valid?"}
  D -- No --> E["Show safe error; remain signed out"]
  D -- Yes --> F["Load memberships, tenant and location"]
  B -- Yes --> F
  F --> G{"Active tenant/location selected?"}
  G -- No --> H["Choose permitted workspace"]
  G -- Yes --> I["Open authorized landing screen"]
  H --> I
  I --> J["Protected action request"]
  J --> K["Server checks session + tenant + permission"]
  K --> L{"Allowed?"}
  L -- Yes --> M["Execute and audit outcome"]
  L -- No --> N["Return 401/403; do not mutate data"]
```

**Conditions:** client UI guards are for usability only; every server mutation must enforce the same rules. Expired session or revoked membership must stop protected sync and queue drains.

## 3. POS checkout and invoice finalization

```mermaid
flowchart TD
  A["Scan/select item"] --> B["Local draft cart"]
  B --> C["Server validates item, price, discount rights, stock and tax context"]
  C --> D{"Valid?"}
  D -- No --> E["Show item-specific error; preserve draft"]
  D -- Yes --> F["Server calculates amounts and rounding"]
  F --> G["Choose payment method"]
  G --> H["Submit using idempotency key"]
  H --> I{"Payment outcome"}
  I -- Declined --> J["Keep unpaid; allow retry/change method"]
  I -- Unknown timeout --> K["Reconcile gateway/status; don't blindly charge again"]
  I -- Approved/cash recorded --> L["Atomically commit order + payment + stock ledger"]
  L --> M["Allocate final invoice number per legal/offline policy"]
  M --> N["Persist immutable invoice and audit event"]
  N --> O["Create PDF/thermal print job"]
  O --> P{"Print success?"}
  P -- Yes --> Q["Mark print job complete"]
  P -- No --> R["Show retry; sale remains committed"]
```

**Invariants:** payment, inventory movement and order commit must not be duplicated by retries. Printing failure must not roll back a successful sale. Provisional bill and final invoice must remain distinct.

## 4. Offline outbox / sync lifecycle

```mermaid
flowchart TD
  A["User writes locally"] --> B["Local DB transaction: entity + outbox"]
  B --> C["UI emits local state immediately"]
  C --> D{"Authenticated and online?"}
  D -- No --> E["Keep pending; schedule/wake later"]
  D -- Yes --> F["Push bounded batch with idempotency keys"]
  F --> G["Server authenticates, scopes tenant and validates payload"]
  G --> H{"Result"}
  H -- ACK --> I["Mark acknowledged; store server version"]
  H -- Conflict --> J["Persist conflict; expose resolution UI"]
  H -- Rejected --> K["Keep diagnostic and actionable failed state"]
  I --> L["Pull delta since cursor"]
  L --> M["Upsert remote changes and reconcile local cache"]
  J --> N["Apply explicit conflict policy"]
  N --> B
  E --> D
  K --> O["User/system corrects and retries safely"]
  O --> F
```

**Required states:** pending, syncing, synced, retryable failure, permanent failure and conflict. Never block the first local render on bootstrap/pull completion.

## 5. Marketplace order to kitchen and delivery

```mermaid
flowchart TD
  A["Customer chooses store and cart"] --> B["Check store hours, service area and catalog"]
  B --> C["Submit order; backend revalidates stock, price and tax"]
  C --> D{"Accepted by merchant?"}
  D -- No --> E["Cancel/refund path and notify customer"]
  D -- Yes --> F{"Fulfilment"}
  F -- Dine-in/takeaway --> G["Kitchen ticket: New"]
  F -- Delivery --> G
  G --> H["Preparing"]
  H --> I["Ready"]
  I --> J{"Delivery needed?"}
  J -- No --> K["Serve / customer pickup"]
  J -- Yes --> L["Dispatch eligible driver"]
  L --> M{"Driver accepts?"}
  M -- No --> L
  M -- Yes --> N["Pickup acknowledged"]
  N --> O["En route"]
  O --> P["Delivered + proof of delivery"]
  K --> Q["Complete timeline and notify"]
  P --> Q
  E --> Q
```

**Conditions:** cancel/refund depends on fulfilment/payment state; do not permit arbitrary state jumps. Store transitions should carry actor, timestamps and idempotency keys.

## 6. Restaurant KDS state machine

```mermaid
stateDiagram-v2
  [*] --> New
  New --> Preparing: kitchen claims ticket
  Preparing --> Ready: all required items ready
  Ready --> Served: staff confirms service
  Ready --> PickedUp: takeaway/driver handoff
  New --> Cancelled: authorized cancellation
  Preparing --> Cancelled: policy allows + audit
  Ready --> Cancelled: policy allows + audit
  Served --> [*]
  PickedUp --> [*]
  Cancelled --> [*]
```

Reject stale/duplicate transitions with a conflict response instead of silently overwriting a newer state.

## 7. Inventory ledger and purchasing

```mermaid
flowchart TD
  A["Sale / receiving / transfer / count"] --> B["Validate tenant, location, actor, quantity and reason"]
  B --> C{"Allowed?"}
  C -- No --> D["Reject and audit"]
  C -- Yes --> E["Append stock movement with source reference"]
  E --> F["Update balance transactionally"]
  F --> G{"Below reorder threshold?"}
  G -- No --> H["Continue normal operations"]
  G -- Yes --> I["Create alert / purchase draft"]
  I --> J{"Approval required?"}
  J -- Yes --> K["Role-authorized approval"]
  J -- No --> L["Submit PO"]
  K --> L
  L --> M["Receive goods and append receiving movements"]
```

**Conditions:** choose and document whether reservation or sale commit decrements available stock. Multi-terminal and offline sales need explicit oversell/conflict policy; do not silently replace counts.

## 8. Tenant plans and entitlements

```mermaid
flowchart TD
  A["Create tenant"] --> B["Verify/onboard business"]
  B --> C["Choose plan and billing cadence"]
  C --> D["Create subscription"]
  D --> E{"Payment / trial / manual approval valid?"}
  E -- No --> F["Pending or restricted state"]
  E -- Yes --> G["Activate entitlements"]
  G --> H["Check entitlements at API and UI"]
  H --> I{"Renewal/payment or plan change"}
  I --> J["Recalculate entitlements with effective date"]
  J --> H
```

Entitlements must be checked server-side and cached client-side only for navigation/experience. Keep historical subscription events and audit changes.

## 9. Failure classification and recovery

```mermaid
flowchart TD
  A["API / payment / printer / sync failure"] --> B["Classify"]
  B --> C{"Transient and safe to retry?"}
  C -- Yes --> D["Bounded exponential backoff + idempotency"]
  D --> E{"Retry limit reached?"}
  E -- No --> A
  E -- Yes --> F["Expose actionable failure; keep draft/context"]
  C -- No --> G{"Outcome unknown (e.g. payment timeout)?"}
  G -- Yes --> H["Reconcile by provider reference / status query"]
  G -- No --> F
  H --> I{"Resolved?"}
  I -- Yes --> J["Update durable state and audit"]
  I -- No --> F
  F --> K["Operator/user correction"]
  K --> A
```

## 10. Demo versus production

| Capability | Current prototype | Production requirement |
|---|---|---|
| Screens/theme/device preview | Included, sample UI | Real adaptive Flutter UI, accessibility QA |
| Developer handoff | Brand tokens and flow descriptions | Versioned source-of-truth design/docs tied to API contracts |
| Identity/RBAC | Illustrative only | Server-side authZ and tenant isolation tests |
| Payment/tax/invoice | Illustrative totals only | Gateway, legal tax rules, immutable invoice lifecycle |
| Offline sync | Not implemented | Drift, outbox, idempotent API, conflicts and migrations |
| Inventory/orders | Sample data only | PostgreSQL transactions and ledger invariants |
| Printing/drawer | Not implemented | Tested ESC/POS/platform drivers and job state |
| CI/deployment | GitHub Pages workflow configured | Confirm Pages settings and passing workflow; separate build/test pipelines |
