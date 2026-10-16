# Vyavsetu API Architecture, JSON Contracts & Java Blueprint

**Status:** Proposed production contract, API v1 · **Reviewed against repo:** 2026-10-16

> **Scope protection:** This is a documentation-only addition. It does not change the current app screens, business logic, demo data or localStorage keys. The existing HTML prototype remains as-is. The endpoints and schemas below are proposals, not connected APIs.

## 1. Executive summary

- **137 proposed business REST operations** under /api/v1.
- **30 proposed Drift/SQLite relational tables** for the offline-first Flutter clients.
- **36 current browser localStorage keys** inventoried from app.html and the separate app previews.
- Target backend: **Java Spring Boot modular monolith + PostgreSQL**, with server-side tenant/RBAC enforcement, idempotency and sync outbox.

| API group | Endpoint operations |
|---|---:|
| Identity & sessions | 8 |
| Tenant, store & RBAC | 13 |
| Customer profile & notifications | 12 |
| Store discovery, catalogue & coupons | 10 |
| Checkout, orders, payments & tracking | 14 |
| Chat & safety | 5 |
| Merchant orders, earnings & payouts | 9 |
| Driver, route & proof of delivery | 13 |
| POS, bills, invoices & printing | 13 |
| Inventory, suppliers, purchasing & reports | 13 |
| SaaS & Web Admin | 24 |
| Offline sync | 3 |
| **Total** | **137** |

The count includes the business REST routes below. Health/OpenAPI endpoints, static content, a future media-upload-intent route and optional WebSocket/SSE destinations are infrastructure additions outside that count.

## 2. Target architecture

~~~mermaid
flowchart LR
  subgraph Clients
    C[Customer App]
    S[Store App]
    D[Driver App]
    P[POS + Business Admin]
    A[Super Admin / Web Admin]
  end
  C --> API[HTTPS JSON /api/v1]
  S --> API
  D --> API
  P --> API
  A --> API
  API --> SEC[Spring Security + tenant + RBAC]
  SEC --> MOD[Spring Boot modular monolith]
  MOD --> PG[(PostgreSQL source of truth)]
  P <--> LDB[Drift / SQLite local DB]
  LDB --> OUT[Transactional local outbox]
  OUT --> API
  MOD --> EVT[Server outbox / worker]
  EVT --> PUSH[Push / SSE or WebSocket]
~~~

- Client apps: Flutter Android/iOS for Customer, Driver and Store; Flutter Web/Desktop for POS, Business Admin and Super Admin as agreed. Current HTML pages remain preview surfaces.
- API: HTTPS JSON, versioned /api/v1. Start as one modular monolith, not a premature microservice fleet.
- PostgreSQL is the shared source of truth. Browser localStorage is not a multi-device database.
- Offline POS: Drift/SQLite writes the business row plus outbox event in one local transaction; render local state immediately, then push idempotently.
- Product images, chat media and delivery proof belong in authorized object storage/media flows, not localStorage.

## 3. API conventions

- Authentication: Authorization: Bearer <short-lived access token>; refresh token rotation/revocation in secure storage.
- Tenant scope: derive actor from authentication. X-Tenant-Id / X-Store-Id can select context but are never proof of permission.
- Use Idempotency-Key for order creation, payment-intent creation, sale commit, inventory receipt/adjustment and retryable mutations.
- Include X-Request-Id/correlation ID for tracing. Use version/ETag + If-Match for concurrent edits.
- Pagination: ?cursor=<opaque>&limit=50; response includes page.nextCursor, with a server maximum limit.
- Money is integer amountMinor plus currency. INR ₹149 = 14900 paise. The server recalculates price, tax, discount and delivery costs.
- Successful responses use { data, meta: { requestId } }; paged responses also include page. Errors use stable codes and fieldErrors.
- Status policy: 200 success, 201 created, 202 async accepted, 204 no body, 400 malformed, 401 unauthenticated, 403 unauthorized, 404 missing/hidden, 409 conflict, 422 business validation, 429 rate limited, 5xx unexpected/retryable.

## 4. Endpoint catalogue — 137 proposed operations

Paths are relative to /api/v1. “—” means no JSON body. Query parameters are shown in the request column. Implement typed DTOs and validation for all mutations.

| # | Module | Method | Endpoint | Access | Request body / query | Success data |
|---:|---|---|---|---|---|---|
| 001 | Identity & sessions | `POST` | `/auth/register` | Public | displayName, email or phone, password | AuthSession |
| 002 | Identity & sessions | `POST` | `/auth/login` | Public | identifier, password | AuthSession |
| 003 | Identity & sessions | `POST` | `/auth/otp/request` | Public | phone, purpose | challengeId, expiry, resendAfter |
| 004 | Identity & sessions | `POST` | `/auth/otp/verify` | Public | challengeId, otp | AuthSession |
| 005 | Identity & sessions | `POST` | `/auth/token/refresh` | Refresh token | refreshToken | AuthSession; rotated refresh token |
| 006 | Identity & sessions | `POST` | `/auth/logout` | Authenticated | refreshToken? | 204 |
| 007 | Identity & sessions | `GET` | `/auth/me` | Authenticated | — | UserProfile |
| 008 | Identity & sessions | `GET` | `/auth/memberships` | Authenticated | — | Membership[] |
| 009 | Tenant, store & RBAC | `GET` | `/tenants/current` | Authenticated | — | TenantContext |
| 010 | Tenant, store & RBAC | `GET` | `/tenants/{tenantId}/stores` | Tenant member | status?, cursor, limit | Page<Store> |
| 011 | Tenant, store & RBAC | `POST` | `/tenants/{tenantId}/stores` | Tenant admin | name, type, currency, timezone, address | Store |
| 012 | Tenant, store & RBAC | `GET` | `/stores/{storeId}` | Public-safe fields or store member | — | Store |
| 013 | Tenant, store & RBAC | `PATCH` | `/stores/{storeId}` | Store admin | name?, address?, status?, contact? | Store |
| 014 | Tenant, store & RBAC | `GET` | `/stores/{storeId}/hours` | Public | — | WeeklyHours[] |
| 015 | Tenant, store & RBAC | `PUT` | `/stores/{storeId}/hours` | Store admin | weeklyHours[] | WeeklyHours[] |
| 016 | Tenant, store & RBAC | `GET` | `/tenants/{tenantId}/members` | Tenant admin | status?, cursor, limit | Page<Member> |
| 017 | Tenant, store & RBAC | `POST` | `/tenants/{tenantId}/members` | Tenant admin | userId or invitation, roleIds[], storeIds[] | Member |
| 018 | Tenant, store & RBAC | `PATCH` | `/tenants/{tenantId}/members/{memberId}` | Tenant admin | status?, storeIds?, displayName? | Member |
| 019 | Tenant, store & RBAC | `GET` | `/roles` | Authenticated | scope? | Role[] |
| 020 | Tenant, store & RBAC | `GET` | `/permissions` | Authenticated | — | Permission[] |
| 021 | Tenant, store & RBAC | `PUT` | `/members/{memberId}/roles` | Tenant admin | roleIds[] | MemberRoles |
| 022 | Customer profile & notifications | `GET` | `/customer/profile` | Customer | — | CustomerProfile |
| 023 | Customer profile & notifications | `PATCH` | `/customer/profile` | Customer | displayName?, email?, phone?, photoAssetId? | CustomerProfile |
| 024 | Customer profile & notifications | `GET` | `/customer/addresses` | Customer | — | Address[] |
| 025 | Customer profile & notifications | `POST` | `/customer/addresses` | Customer | label, recipient, phone, address, lat?, lng? | Address |
| 026 | Customer profile & notifications | `PATCH` | `/customer/addresses/{addressId}` | Customer | address fields? | Address |
| 027 | Customer profile & notifications | `DELETE` | `/customer/addresses/{addressId}` | Customer | — | 204 |
| 028 | Customer profile & notifications | `GET` | `/customer/payment-methods` | Customer | — | PaymentMethod[]; masked only |
| 029 | Customer profile & notifications | `POST` | `/customer/payment-methods/setup-intents` | Customer | provider, returnUrl? | SetupIntent |
| 030 | Customer profile & notifications | `DELETE` | `/customer/payment-methods/{paymentMethodId}` | Customer | — | 204 |
| 031 | Customer profile & notifications | `PUT` | `/devices/{deviceId}/push-token` | Authenticated | platform, pushToken, appVersion, locale | DeviceRegistration |
| 032 | Customer profile & notifications | `GET` | `/notifications` | Authenticated | unreadOnly?, cursor, limit | Page<Notification> |
| 033 | Customer profile & notifications | `POST` | `/notifications/{notificationId}/read` | Authenticated | — | Notification |
| 034 | Store discovery, catalogue & coupons | `GET` | `/stores` | Public | q?, categoryId?, lat?, lng?, radiusKm?, openNow?, cursor, limit | Page<StoreCard> |
| 035 | Store discovery, catalogue & coupons | `GET` | `/stores/{storeId}/products` | Public | q?, categoryId?, availableOnly?, cursor, limit | Page<ProductCard> |
| 036 | Store discovery, catalogue & coupons | `GET` | `/catalog/categories` | Public | storeId?, parentId? | Category[] |
| 037 | Store discovery, catalogue & coupons | `GET` | `/products/{productId}` | Public | — | ProductDetail |
| 038 | Store discovery, catalogue & coupons | `POST` | `/merchant/products` | Store product permission | name, sku?, categoryId, unit, priceMinor, currency, taxCode? | Product |
| 039 | Store discovery, catalogue & coupons | `PATCH` | `/merchant/products/{productId}` | Store product permission | name?, categoryId?, unit?, priceMinor?, taxCode? | Product |
| 040 | Store discovery, catalogue & coupons | `DELETE` | `/merchant/products/{productId}` | Store admin | — | 204 |
| 041 | Store discovery, catalogue & coupons | `PUT` | `/merchant/products/{productId}/availability` | Store staff | available, stockPolicy? | StoreProductAvailability |
| 042 | Store discovery, catalogue & coupons | `GET` | `/coupons` | Public or Customer | storeId?, activeOnly? | CouponCard[] |
| 043 | Store discovery, catalogue & coupons | `POST` | `/coupons/validate` | Customer | code, storeId, items[] | CouponQuote |
| 044 | Checkout, orders, payments & tracking | `POST` | `/checkout/quote` | Customer | storeId, fulfilmentType, addressId?, items[], couponCode? | CheckoutQuote |
| 045 | Checkout, orders, payments & tracking | `POST` | `/orders` | Customer | quoteId, clientOrderId, fulfilmentType, addressId?, paymentMethod, customerNote? | Order |
| 046 | Checkout, orders, payments & tracking | `GET` | `/orders` | Customer or authorized staff | status?, storeId?, from?, to?, cursor, limit | Page<OrderSummary> |
| 047 | Checkout, orders, payments & tracking | `GET` | `/orders/{orderId}` | Order participant or authorized staff | — | OrderDetail |
| 048 | Checkout, orders, payments & tracking | `GET` | `/orders/{orderId}/timeline` | Order participant | — | OrderTimelineEvent[] |
| 049 | Checkout, orders, payments & tracking | `POST` | `/orders/{orderId}/cancel` | Customer or authorized staff | reasonCode, note? | Order + cancellation/refund state |
| 050 | Checkout, orders, payments & tracking | `POST` | `/orders/{orderId}/reorder` | Customer | addressId?, substitutionsAllowed? | CartDraft |
| 051 | Checkout, orders, payments & tracking | `POST` | `/orders/{orderId}/payment-intents` | Customer | provider, paymentMethodId? | PaymentIntent |
| 052 | Checkout, orders, payments & tracking | `GET` | `/payments/{paymentId}` | Payment owner or authorized staff | — | PaymentStatus |
| 053 | Checkout, orders, payments & tracking | `POST` | `/payments/{paymentId}/reconcile` | Payment owner or authorized staff | clientObservedStatus? | PaymentStatus |
| 054 | Checkout, orders, payments & tracking | `POST` | `/webhooks/payments/{provider}` | Signed provider webhook | Provider event JSON | 200 acknowledgement |
| 055 | Checkout, orders, payments & tracking | `POST` | `/orders/{orderId}/reviews` | Customer with completed order | rating, comment?, productRatings? | Review |
| 056 | Checkout, orders, payments & tracking | `GET` | `/orders/{orderId}/tracking` | Order participant or assigned driver | — | OrderTracking |
| 057 | Checkout, orders, payments & tracking | `POST` | `/orders/{orderId}/chat-conversations` | Order participant | participantId | Conversation |
| 058 | Chat & safety | `GET` | `/conversations` | Authenticated participant | orderId?, cursor, limit | Page<Conversation> |
| 059 | Chat & safety | `GET` | `/conversations/{conversationId}/messages` | Conversation participant | before?, limit | Page<Message> |
| 060 | Chat & safety | `POST` | `/conversations/{conversationId}/messages` | Conversation participant | clientMessageId, text?, attachmentIds[], replyToMessageId? | Message |
| 061 | Chat & safety | `POST` | `/messages/{messageId}/reports` | Conversation participant | reasonCode, details? | SafetyReport |
| 062 | Chat & safety | `POST` | `/conversations/{conversationId}/blocks` | Conversation participant | blockedUserId, reason? | BlockRecord |
| 063 | Merchant orders, earnings & payouts | `GET` | `/merchant/orders` | Store staff | status?, from?, to?, cursor, limit | Page<MerchantOrder> |
| 064 | Merchant orders, earnings & payouts | `GET` | `/merchant/orders/{orderId}` | Store staff | — | MerchantOrderDetail |
| 065 | Merchant orders, earnings & payouts | `POST` | `/merchant/orders/{orderId}/accept` | Store staff | estimatedPrepMinutes?, note? | OrderStatusResult |
| 066 | Merchant orders, earnings & payouts | `POST` | `/merchant/orders/{orderId}/reject` | Store staff | reasonCode, note? | OrderCancellationResult |
| 067 | Merchant orders, earnings & payouts | `POST` | `/merchant/orders/{orderId}/preparing` | Store staff | expectedReadyAt? | OrderStatusResult |
| 068 | Merchant orders, earnings & payouts | `POST` | `/merchant/orders/{orderId}/ready` | Store staff | readyItems? | OrderStatusResult + DispatchSummary |
| 069 | Merchant orders, earnings & payouts | `POST` | `/merchant/orders/{orderId}/handover` | Store staff | driverJobId, handoverCode? | OrderStatusResult |
| 070 | Merchant orders, earnings & payouts | `GET` | `/merchant/earnings` | Store owner/accounting | from, to, currency? | EarningsReport |
| 071 | Merchant orders, earnings & payouts | `GET` | `/merchant/payouts` | Store owner/accounting | status?, cursor, limit | Page<Payout> |
| 072 | Driver, route & proof of delivery | `GET` | `/driver/profile` | Driver | — | DriverProfile |
| 073 | Driver, route & proof of delivery | `PATCH` | `/driver/profile` | Driver | displayName?, photoAssetId?, locale?, emergencyContact? | DriverProfile |
| 074 | Driver, route & proof of delivery | `PATCH` | `/driver/availability` | Driver | availability, location? | DriverAvailability |
| 075 | Driver, route & proof of delivery | `GET` | `/driver/jobs` | Driver | status?, cursor, limit | Page<DriverJob> |
| 076 | Driver, route & proof of delivery | `POST` | `/driver/jobs/{jobId}/accept` | Driver | acceptedAtClient? | DriverJob |
| 077 | Driver, route & proof of delivery | `POST` | `/driver/jobs/{jobId}/reject` | Driver | reasonCode | DriverJob |
| 078 | Driver, route & proof of delivery | `POST` | `/driver/jobs/{jobId}/pickup` | Assigned driver | pickupCode?, itemsVerified? | DriverJob |
| 079 | Driver, route & proof of delivery | `POST` | `/driver/jobs/{jobId}/start` | Assigned driver | startedAtClient? | DriverJob |
| 080 | Driver, route & proof of delivery | `POST` | `/driver/jobs/{jobId}/location` | Assigned driver | lat, lng, accuracyM?, heading?, speedMps?, capturedAt | LocationAcknowledgement |
| 081 | Driver, route & proof of delivery | `POST` | `/driver/jobs/{jobId}/complete` | Assigned driver | otp, proofAssetIds[], note? | DriverJob + OrderStatus |
| 082 | Driver, route & proof of delivery | `GET` | `/driver/jobs/{jobId}/route` | Assigned driver | destination=STORE or CUSTOMER | RouteSummary |
| 083 | Driver, route & proof of delivery | `GET` | `/driver/deliveries` | Driver | from?, to?, cursor, limit | Page<DeliveryHistoryItem> |
| 084 | Driver, route & proof of delivery | `POST` | `/driver/deliveries/{deliveryId}/proof` | Assigned driver | multipart file, type, note? | ProofAsset |
| 085 | POS, bills, invoices & printing | `GET` | `/pos/catalog` | Authenticated store staff | q?, categoryId?, updatedSince? | CatalogDelta/Page<Product> |
| 086 | POS, bills, invoices & printing | `POST` | `/pos/quotes` | Store staff | storeId, lines[], customerId?, discountCode? | POSQuote |
| 087 | POS, bills, invoices & printing | `POST` | `/pos/sales` | Store staff or offline sync | clientSaleId, lines[], customerId?, paymentLines[], occurredAt, deviceId | Sale |
| 088 | POS, bills, invoices & printing | `GET` | `/pos/sales` | Store staff/accounting | from, to, status?, cursor, limit | Page<SaleSummary> |
| 089 | POS, bills, invoices & printing | `GET` | `/pos/sales/{saleId}` | Store staff/accounting | — | SaleDetail |
| 090 | POS, bills, invoices & printing | `POST` | `/pos/sales/{saleId}/payments` | Store staff | method, amountMinor, currency, providerReference? | PaymentRecord |
| 091 | POS, bills, invoices & printing | `POST` | `/pos/sales/{saleId}/finalize` | Store staff/accounting | finalizationRequestId, taxContextVersion? | Invoice |
| 092 | POS, bills, invoices & printing | `GET` | `/invoices/{invoiceId}` | Invoice owner or authorized staff | — | InvoiceDocument |
| 093 | POS, bills, invoices & printing | `POST` | `/invoices/{invoiceId}/print-jobs` | Authorized staff/device | printerId?, format, copies? | PrintJob |
| 094 | POS, bills, invoices & printing | `GET` | `/print-jobs/{printJobId}` | Authorized staff/device | — | PrintJob |
| 095 | POS, bills, invoices & printing | `POST` | `/pos/provisional-bills` | Store staff/device | clientBillId, lines[], customerId?, note? | ProvisionalBill |
| 096 | POS, bills, invoices & printing | `GET` | `/pos/provisional-bills` | Store staff/device | status?, cursor, limit | Page<ProvisionalBill> |
| 097 | POS, bills, invoices & printing | `POST` | `/pos/provisional-bills/{billId}/resume` | Store staff/device | deviceId | ProvisionalBill |
| 098 | Inventory, suppliers, purchasing & reports | `GET` | `/inventory/items` | Store staff | q?, lowStock?, cursor, limit | Page<InventoryItem> |
| 099 | Inventory, suppliers, purchasing & reports | `GET` | `/inventory/movements` | Store staff/auditor | itemId?, from?, to?, cursor, limit | Page<InventoryMovement> |
| 100 | Inventory, suppliers, purchasing & reports | `POST` | `/inventory/movements` | Authorized stock operator | itemId, locationId, movementType, quantity, sourceType, sourceId, reason | InventoryMovement |
| 101 | Inventory, suppliers, purchasing & reports | `POST` | `/inventory/adjustments` | Stock manager | itemId, countedQuantity, reason, expectedVersion | InventoryAdjustmentResult |
| 102 | Inventory, suppliers, purchasing & reports | `GET` | `/suppliers` | Store staff | q?, active?, cursor, limit | Page<Supplier> |
| 103 | Inventory, suppliers, purchasing & reports | `POST` | `/suppliers` | Store admin | name, contactName?, email?, phone?, address? | Supplier |
| 104 | Inventory, suppliers, purchasing & reports | `PATCH` | `/suppliers/{supplierId}` | Store admin | name?, contactName?, email?, phone?, address?, status? | Supplier |
| 105 | Inventory, suppliers, purchasing & reports | `GET` | `/purchase-orders` | Store staff | status?, supplierId?, cursor, limit | Page<PurchaseOrder> |
| 106 | Inventory, suppliers, purchasing & reports | `POST` | `/purchase-orders` | Store staff | supplierId, storeId, lines[], expectedAt?, notes? | PurchaseOrder |
| 107 | Inventory, suppliers, purchasing & reports | `POST` | `/purchase-orders/{purchaseOrderId}/submit` | Purchasing permission | expectedVersion | PurchaseOrder |
| 108 | Inventory, suppliers, purchasing & reports | `POST` | `/purchase-orders/{purchaseOrderId}/receive` | Store staff | receiptId, lines[{lineId, receivedQuantity}], receivedAt | PurchaseReceipt |
| 109 | Inventory, suppliers, purchasing & reports | `GET` | `/reports/sales` | Owner/accounting | from, to, storeId?, groupBy? | SalesReport |
| 110 | Inventory, suppliers, purchasing & reports | `GET` | `/reports/profit-loss` | Owner/accounting | from, to, storeId?, basis? | ProfitLossReport |
| 111 | SaaS & Web Admin | `GET` | `/admin/overview` | Platform admin | from?, to? | AdminOverview |
| 112 | SaaS & Web Admin | `GET` | `/admin/businesses` | Platform admin | q?, status?, categoryId?, cursor, limit | Page<TenantSummary> |
| 113 | SaaS & Web Admin | `POST` | `/admin/businesses` | Platform admin | name, legalName?, categoryId, owner, planId, timezone, currency | TenantOnboardingResult |
| 114 | SaaS & Web Admin | `GET` | `/admin/business-categories` | Platform admin | active? | BusinessCategory[] |
| 115 | SaaS & Web Admin | `POST` | `/admin/business-categories` | Platform admin | name, slug, description?, status | BusinessCategory |
| 116 | SaaS & Web Admin | `GET` | `/admin/plans` | Platform admin | status? | SubscriptionPlan[] |
| 117 | SaaS & Web Admin | `POST` | `/admin/plans` | Platform admin | name, priceMinor, currency, billingPeriod, entitlements[] | SubscriptionPlan |
| 118 | SaaS & Web Admin | `PATCH` | `/admin/plans/{planId}` | Platform admin | name?, priceMinor?, status?, entitlements? | SubscriptionPlan |
| 119 | SaaS & Web Admin | `GET` | `/admin/subscriptions` | Platform admin/billing admin | tenantId?, status?, cursor, limit | Page<Subscription> |
| 120 | SaaS & Web Admin | `POST` | `/admin/subscriptions` | Platform admin/billing admin | tenantId, planId, startsAt, trialEndsAt? | Subscription |
| 121 | SaaS & Web Admin | `PATCH` | `/admin/subscriptions/{subscriptionId}` | Platform admin/billing admin | status?, planId?, endsAt?, reason | Subscription |
| 122 | SaaS & Web Admin | `GET` | `/admin/staff` | Platform admin | tenantId?, cursor, limit | Page<PlatformStaff> |
| 123 | SaaS & Web Admin | `POST` | `/admin/staff` | Platform admin | userId or invitation, platformRoleIds[] | PlatformStaff |
| 124 | SaaS & Web Admin | `PUT` | `/admin/staff/{memberId}/roles` | Platform admin | roleIds[] | PlatformStaffRoles |
| 125 | SaaS & Web Admin | `GET` | `/admin/advertising/campaigns` | Platform admin/marketing | status?, cursor, limit | Page<AdCampaign> |
| 126 | SaaS & Web Admin | `POST` | `/admin/advertising/campaigns` | Platform admin/marketing | name, audience, placement, startsAt, endsAt, budgetMinor? | AdCampaign |
| 127 | SaaS & Web Admin | `GET` | `/admin/messages` | Platform support | status?, cursor, limit | Page<ContactMessage> |
| 128 | SaaS & Web Admin | `GET` | `/admin/cms/pages` | Platform content admin | status?, locale? | Page<CmsPage> |
| 129 | SaaS & Web Admin | `PUT` | `/admin/cms/pages/{pageId}` | Platform content admin | title, slug, locale, content, status, version | CmsPage |
| 130 | SaaS & Web Admin | `GET` | `/admin/settings` | Platform admin | group? | AdminSettings |
| 131 | SaaS & Web Admin | `PATCH` | `/admin/settings` | Platform admin | settingsPatch, expectedVersion | AdminSettings |
| 132 | SaaS & Web Admin | `GET` | `/admin/audit-logs` | Platform auditor | actorId?, action?, from?, to?, cursor, limit | Page<AuditEvent> |
| 133 | SaaS & Web Admin | `GET` | `/admin/feature-flags` | Platform admin | — | FeatureFlag[] |
| 134 | SaaS & Web Admin | `PATCH` | `/admin/feature-flags/{flagId}` | Platform admin | enabled, rolloutPercent?, reason | FeatureFlag |
| 135 | Offline sync | `POST` | `/sync/push` | Authenticated device + tenant membership | deviceId, batchId, events[] | SyncPushResult[]: ACK/CONFLICT/REJECTED |
| 136 | Offline sync | `GET` | `/sync/pull` | Authenticated device + tenant membership | cursor?, limit, modules[]? | SyncDelta + nextCursor |
| 137 | Offline sync | `GET` | `/sync/operations/{idempotencyKey}` | Mutation owner / tenant member | — | OperationStatus |

## 5. JSON contracts

These are representative canonical DTO shapes to implement and publish in OpenAPI. IDs are illustrative. Clients must not override authoritative totals or workflow states.

~~~json
{
  "amountMinor": 14900,
  "currency": "INR"
}
~~~

### Checkout quote request

POST /api/v1/checkout/quote; server recalculates price, stock, discount, tax, fee and serviceability.

~~~json
{
  "storeId": "str_01J9STORE",
  "fulfilmentType": "DELIVERY",
  "addressId": "adr_01J9HOME",
  "items": [
    {
      "productId": "prd_mango_01",
      "quantity": 2
    },
    {
      "productId": "prd_milk_01",
      "quantity": 1
    }
  ],
  "couponCode": "WELCOME10"
}
~~~

### Checkout quote response

Quote expires and order creation revalidates it. INR ₹149 = 14900 paise.

~~~json
{
  "data": {
    "quoteId": "qte_01J9XYZ",
    "storeId": "str_01J9STORE",
    "currency": "INR",
    "items": [
      {
        "productId": "prd_mango_01",
        "name": "Alphonso Mango",
        "quantity": 2,
        "unitPriceMinor": 14900,
        "lineTotalMinor": 29800,
        "available": true
      }
    ],
    "subtotalMinor": 29800,
    "discountMinor": 1000,
    "taxMinor": 1440,
    "deliveryFeeMinor": 2500,
    "totalMinor": 32740,
    "expiresAt": "2026-10-16T08:45:00Z"
  },
  "meta": {
    "requestId": "req_01J9"
  }
}
~~~

### Create order request

POST /api/v1/orders with Idempotency-Key: device-7:order-00042.

~~~json
{
  "quoteId": "qte_01J9XYZ",
  "clientOrderId": "device-7:order-00042",
  "fulfilmentType": "DELIVERY",
  "addressId": "adr_01J9HOME",
  "paymentMethod": "CASH_ON_DELIVERY",
  "customerNote": "Call on arrival"
}
~~~

### Create order response

Return 201 on first create; idempotent replay returns original canonical result.

~~~json
{
  "data": {
    "orderId": "ord_01J9ABC",
    "orderNumber": "VY-104208",
    "status": "PENDING_STORE_ACCEPTANCE",
    "paymentStatus": "COD_DUE",
    "fulfilmentType": "DELIVERY",
    "storeId": "str_01J9STORE",
    "total": {
      "amountMinor": 32740,
      "currency": "INR"
    },
    "version": 1,
    "createdAt": "2026-10-16T08:40:12Z",
    "timeline": [
      {
        "status": "PENDING_STORE_ACCEPTANCE",
        "at": "2026-10-16T08:40:12Z"
      }
    ]
  },
  "meta": {
    "requestId": "req_01J9"
  }
}
~~~

### Store accepts order

POST /api/v1/merchant/orders/{orderId}/accept; only valid state transition is allowed.

~~~json
{
  "estimatedPrepMinutes": 15,
  "note": "Preparing your order"
}
~~~

### Driver completes delivery

POST /api/v1/driver/jobs/{jobId}/complete; server checks assignment, OTP and proof policy.

~~~json
{
  "otp": "654321",
  "proofAssetIds": [
    "ast_proof_01"
  ],
  "note": "Handed to recipient"
}
~~~

### Sync push request

POST /api/v1/sync/push; every event gets ACK, CONFLICT or REJECTED.

~~~json
{
  "deviceId": "dev_01J9POS",
  "batchId": "bat_01J9A",
  "events": [
    {
      "eventId": "evt_01J9SALE",
      "aggregateType": "POS_SALE",
      "aggregateId": "client-sale-00087",
      "operation": "CREATE",
      "schemaVersion": 1,
      "idempotencyKey": "tenant-9:device-1:client-sale-00087",
      "occurredAt": "2026-10-16T08:44:00Z",
      "payload": {
        "storeId": "str_01J9STORE",
        "lines": [
          {
            "productId": "prd_milk_01",
            "quantity": 2
          }
        ],
        "payments": [
          {
            "method": "CASH",
            "amountMinor": 6800,
            "currency": "INR"
          }
        ]
      }
    }
  ]
}
~~~

### Sync push response

Do not drop rejected/conflicting events; persist actionable diagnostics locally.

~~~json
{
  "data": {
    "batchId": "bat_01J9A",
    "results": [
      {
        "eventId": "evt_01J9SALE",
        "outcome": "ACK",
        "serverEntityId": "sal_01J9SALE",
        "serverVersion": 1,
        "acknowledgedAt": "2026-10-16T08:44:03Z"
      }
    ]
  },
  "meta": {
    "nextCursor": "cur_0015"
  }
}
~~~

### Sync delta pull response

GET /api/v1/sync/pull?cursor=cur_0015&limit=200; cursor is tenant/device/contract scoped.

~~~json
{
  "data": {
    "changes": [
      {
        "entityType": "ORDER",
        "entityId": "ord_01J9ABC",
        "operation": "UPSERT",
        "serverVersion": 4,
        "changedAt": "2026-10-16T08:45:00Z",
        "payload": {
          "status": "READY_FOR_PICKUP"
        }
      }
    ],
    "tombstones": [],
    "nextCursor": "cur_0016",
    "hasMore": false
  }
}
~~~

### Standard API error

Use stable error codes and request IDs; do not expose stack traces or secrets.

~~~json
{
  "type": "https://api.vyavsetu.example/problems/validation",
  "title": "Validation failed",
  "status": 422,
  "code": "ORDER_ITEM_UNAVAILABLE",
  "detail": "One item is no longer available.",
  "requestId": "req_01J9",
  "fieldErrors": [
    {
      "field": "items[0].productId",
      "code": "OUT_OF_STOCK",
      "message": "Please remove or reduce this item."
    }
  ]
}
~~~

## 6. Order, payment and delivery state rules

- **Marketplace order:** PENDING_STORE_ACCEPTANCE → ACCEPTED → PREPARING → READY_FOR_PICKUP → DRIVER_ASSIGNED → PICKED_UP → OUT_FOR_DELIVERY → DELIVERED. Rejection, cancellation, delivery failure and refund states are policy-controlled terminal/alternate branches.
- Every transition checks current state/version and appends an order_status_events row with actor, timestamp and reason. Client code cannot directly set status to DELIVERED.
- **Payment:** CREATED → REQUIRES_ACTION → AUTHORIZED/CAPTURED, or FAILED/DECLINED/UNKNOWN → RECONCILING → provider-confirmed outcome. COD uses COD_DUE → COLLECTED.
- Timeout is an unknown payment outcome, not a failed charge. Reconcile gateway status/webhook before retrying.
- **POS:** LOCAL_DRAFT → PENDING_SYNC → SERVER_ACKNOWLEDGED → PAYMENT_RECORDED → FINAL_INVOICE_ISSUED. Provisional bills stay separate from finalized invoices; print failure cannot roll back a committed sale.
- **Driver:** AVAILABLE → ASSIGNED → PICKED_UP → OUT_FOR_DELIVERY → DELIVERED, with policy-controlled rejection/cancel/failure branches.

## 7. Current browser localStorage inventory — preserve

These **36 existing keys** were found in app.html and the standalone Customer/Store/Driver prototypes. They are browser key/value data, not normalized relational tables, and do not imply that an API/database is connected. This list is an inventory only—do not rename, migrate or delete these keys in this documentation task.

| Area | Current key | Current purpose |
|---|---|---|
| Workspace | `vyavsetu_pos_products` | Demo POS product catalogue |
| Workspace | `vyavsetu_market_products` | Demo marketplace product catalogue |
| Workspace | `vyavsetu_pos_cart` | POS cart |
| Workspace | `vyavsetu_market_cart` | Marketplace cart |
| Workspace | `vyavsetu_market_shop` | Selected demo marketplace store |
| Shared orders | `vyavsetu_demo_orders` | Shared demo order array |
| Workspace | `vyavsetu_current_receipt` | Most recent demo receipt |
| Shared delivery | `vyavsetu_delivery_statuses` | Order ID to demo delivery status |
| Workspace | `vyavsetu_kitchen_tickets` | Demo restaurant/KDS tickets |
| Workspace | `vyavsetu_driver_online` | Demo driver availability flag |
| Shared delivery | `vyavsetu_driver_jobs` | Demo driver jobs |
| Workspace | `vyavsetu_inventory_items` | Demo inventory balances |
| Workspace | `vyavsetu_tenants` | Demo tenant records |
| Workspace | `vyavsetu_suppliers` | Demo supplier records |
| Workspace | `vyavsetu_purchase_orders` | Demo purchase orders |
| Workspace | `vyavsetu_customers` | Demo customer CRM records |
| Workspace | `vyavsetu_returns` | Demo return/refund requests |
| Workspace | `vyavsetu_staff` | Demo staff records |
| Workspace | `vyavsetu_plans` | Demo SaaS plans |
| Workspace | `vyavsetu_support_tickets` | Demo support tickets |
| Workspace | `vyavsetu_feature_flags` | Browser-local feature flags |
| Workspace | `vyavsetu_business_settings` | Demo business settings |
| Workspace | `vyavsetu_stock_history` | Demo stock movement history |
| Workspace | `vyavsetu_admin_audit` | Demo audit entries |
| Workspace | `vyavsetu_subscription_history` | Demo subscription changes |
| Preferences | `vyavsetu_theme` | Selected theme preference |
| Customer profile | `vyavsetu_customer_name` | Demo checkout name |
| Customer profile | `vyavsetu_customer_phone` | Demo checkout phone |
| Customer profile | `vyavsetu_customer_address` | Demo checkout address |
| Customer App | `vyavsetu-customer-prototype-cart` | Standalone Customer App cart snapshot |
| Customer App | `vyavsetu-customer-prototype-orders` | Standalone Customer App order-history copy/cache |
| Store App legacy | `vyavsetu-store-demo-orders` | Standalone Store App legacy sample queue |
| Store App legacy | `vyavsetu-store-demo-products` | Standalone Store App sample product list |
| Driver App | `vyavsetu-driver-demo-task` | Standalone Driver selected task |
| Driver App | `vyavsetu-driver-demo-completed` | Standalone Driver sample completed trips counter |
| Driver App | `vyavsetu-driver-demo-extra` | Standalone Driver sample extra earnings counter |

**Production guardrails:** do not store access/refresh tokens, passwords, OTP values, card PAN/CVV or provider secrets in localStorage. Keep localStorage for small web preferences and limited prototype state only. A production browser cache should prefer IndexedDB for structured offline data; Flutter uses Drift/SQLite. PostgreSQL becomes canonical. Logout/account switch clears user-scoped sensitive cache per retention policy.

## 8. Proposed Drift / SQLite tables — 30

These are proposed relational tables for offline-capable Flutter clients, not tables already present in the HTML prototype. Implement the subset each app requires.

| # | Table | Key columns (design) | Rule/purpose |
|---:|---|---|---|
| 1 | `local_stores` | store_id PK, tenant_id, name, type, status, timezone, currency, address_json, server_version, updated_at | Store/profile cache. |
| 2 | `local_store_hours` | store_id + weekday PK, open_at, close_at, closed, server_version | Hours display; server revalidates checkout. |
| 3 | `local_categories` | category_id PK, parent_id, name, sort_order, server_version | Category browser cache. |
| 4 | `local_products` | product_id PK, name, sku, unit, category_id, image_asset_id, archived, server_version | Fast product-list render. |
| 5 | `local_store_products` | store_id + product_id PK, price_minor, currency, availability, stock_snapshot, stock_version, server_version | Assortment cache only; not final price/stock authority. |
| 6 | `local_customer_profile` | profile_id PK, display_name, masked_contact_json, updated_at | Minimal profile; avoid unnecessary PII. |
| 7 | `local_addresses` | address_id PK, label, recipient, encrypted_address_json, lat?, lng?, is_default, sync_state | Encrypt sensitive fields where supported; clear per retention policy. |
| 8 | `local_cart` | cart_id PK, user_id?, store_id, currency, updated_at, sync_state | Cart header; one-store-per-order until multi-store fulfilment is designed. |
| 9 | `local_cart_items` | cart_id + product_id PK, quantity, product_snapshot_json, updated_at | Local edits persist immediately. |
| 10 | `local_orders` | order_id PK, tenant_id?, store_id, customer_id?, status, payment_state, delivery_state, total_minor, currency, server_version, created_at, updated_at, sync_state | Local view reconciles to server version. |
| 11 | `local_order_items` | order_id + line_id PK, product_id, name_snapshot, quantity, unit_price_minor, tax_snapshot_json | Immutable historical line snapshots. |
| 12 | `local_order_events` | event_id PK, order_id, state, actor_id, occurred_at, server_version, payload_json | Append-only cached order timeline. |
| 13 | `local_payment_attempts` | attempt_id PK, order_id/sale_id, method, amount_minor, currency, state, provider_ref?, idempotency_key, created_at | Never persist card PAN/CVV or provider secrets. |
| 14 | `local_pos_sales` | client_sale_id PK, store_id, cashier_id, status, subtotal_minor, tax_minor, total_minor, currency, occurred_at, server_sale_id?, sync_state | Offline POS sale identity. |
| 15 | `local_pos_sale_items` | client_sale_id + line_id PK, product_id, sku_snapshot, quantity, unit_price_minor, tax_snapshot_json | Sale-time product/price snapshot. |
| 16 | `local_provisional_bills` | client_bill_id PK, store_id, customer_id?, lines_json, note?, revision, updated_at, sync_state | Editable draft, not a statutory invoice. |
| 17 | `local_inventory_balance_cache` | store_id + item_id PK, quantity_snapshot, reorder_level?, server_version, pulled_at | Cache only; canonical stock is server ledger. |
| 18 | `local_inventory_movements` | client_movement_id PK, store_id, item_id, type, quantity, reason, source_id?, occurred_at, sync_state | Local operation intent until server acknowledgement. |
| 19 | `local_suppliers` | supplier_id PK, name, contact_snapshot_json, server_version | Supplier cache. |
| 20 | `local_purchase_orders` | purchase_order_id/client_id PK, supplier_id, status, total_minor, currency, server_version, sync_state | Offline drafts; server checks conflicts. |
| 21 | `local_purchase_order_lines` | purchase_order_id + line_id PK, product_id, ordered_qty, received_qty, unit_cost_minor, name_snapshot | Line-level receiving state. |
| 22 | `local_kitchen_tickets` | ticket_id PK, order_id?, status, items_snapshot_json, due_at?, server_version, sync_state | KDS cache; state conflicts need resolution. |
| 23 | `local_driver_jobs` | job_id PK, order_id, driver_id, status, pickup_at?, started_at?, delivered_at?, server_version, sync_state | Only assigned driver can mutate. |
| 24 | `local_driver_location_queue` | point_id PK, job_id, lat, lng, accuracy_m?, captured_at, upload_state | Throttle + retention; prune acknowledged points. |
| 25 | `local_notifications` | notification_id PK, title, body, read_at?, created_at, server_version | Notification inbox cache. |
| 26 | `local_outbox` | event_id PK, tenant_id, device_id, aggregate_type, aggregate_id, operation, payload_json, schema_version, idempotency_key, occurred_at, attempts, next_attempt_at?, state, last_error_code? | Entity write + outbox event commit in one local transaction. |
| 27 | `local_sync_cursors` | module_name PK, cursor, last_success_at, server_version | One cursor per module and sync scope. |
| 28 | `local_sync_conflicts` | conflict_id PK, event_id, aggregate_type, aggregate_id, server_snapshot_json, local_snapshot_json, resolution_state, created_at | Preserve both snapshots until explicit resolution. |
| 29 | `local_media_upload_queue` | media_id PK, local_path, mime_type, size_bytes, checksum, target_type, target_id?, upload_state, attempts | Queue proof/chat/product media upload. |
| 30 | `local_print_jobs` | print_job_id PK, sale_id/invoice_id, printer_profile_json, format, copies, state, attempts, last_error?, created_at | Printing state is separate from sale success. |

### Drift rules

- Use server IDs for canonical rows and client-generated IDs for offline-created rows until acknowledgement.
- Index local_orders(status, updated_at), local_products(name), local_store_products(store_id, product_id), local_outbox(state, next_attempt_at), local_order_events(order_id, occurred_at) and frequently queried foreign keys.
- Enable SQLite foreign keys. Migrations preserve data; never drop/recreate user tables during normal upgrade.
- Entity write and local_outbox event are committed in the same Drift transaction. First render never waits for full bootstrap/pull.
- ACK marks synced and records server ID/version; CONFLICT preserves local and server snapshots; REJECTED retains actionable diagnostics; transient network errors stay pending with bounded exponential backoff.
- Driver location must be consented, throttled, access-restricted and retention-limited.
- Do not duplicate the full POS cache into every mobile app by default.

## 9. Proposed PostgreSQL data model

Server-owned tables/aggregates; every tenant-owned read/write is tenant/store/permission scoped.

| Module | Tables/aggregates | Key constraints |
|---|---|---|
| Identity | users, auth_identities, refresh_sessions, otp_challenges | Normalized identifiers unique; tokens stored hashed; OTPs expire. |
| Tenant/RBAC | tenants, tenant_memberships, roles, permissions, role_permissions, membership_roles | Unique tenant+user membership; platform roles separate from tenant roles. |
| Stores | stores, store_hours | Each store belongs to a tenant; hours use store timezone. |
| Customer/driver | customer_profiles, customer_addresses, driver_profiles, driver_availability, device_registrations | PII and driver location restricted and retained by policy. |
| Catalogue | business_categories, categories, products, product_images, store_products | Unique SKU per agreed scope; price in minor units; soft-delete referenced products. |
| Promotions | coupons, coupon_redemptions | Eligibility and usage limits enforced transactionally. |
| Commerce | carts, cart_items, orders, order_items, order_status_events | Order lines have immutable name/price/tax snapshots; order events append-only. |
| Payments | payments, payment_events, payment_methods, refunds | Unique provider event ID; gateway token refs only, no PAN/CVV. |
| Delivery | delivery_jobs, delivery_events, driver_location_points, delivery_proofs | Active-job policy, driver assignment checks and location retention. |
| Messaging | chat_conversations, chat_messages, message_attachments, safety_reports, user_blocks | Participant-only access, client message idempotency and moderation. |
| POS/Billing | pos_sales, pos_sale_items, provisional_bills, invoices, invoice_lines, print_jobs | Client sale ID unique by tenant/device; invoices immutable; print failure doesn't undo sale. |
| Inventory/Buying | inventory_items, inventory_movements, suppliers, purchase_orders, purchase_order_lines, purchase_receipts | Append-only stock ledger; receiving and movement atomic. |
| Restaurant | kitchen_tickets, kitchen_ticket_lines | State transitions check current version. |
| SaaS billing | plans, plan_entitlements, subscriptions, subscription_events, store_payouts | Snapshot plan/price at subscription start; audit lifecycle. |
| Website/admin | ad_campaigns, contact_messages, cms_pages, system_settings, feature_flags | Sanitize CMS HTML; settings responses never contain secrets. |
| Reliability | notifications, audit_logs, idempotency_records, outbox_events, sync_cursors | Audit append-only; idempotency uniqueness; outbox retries tracked. |

### Database invariants

- UNIQUE(tenant_id, customer_id, client_order_id) for create replay; idempotency table stores scope + key + normalized request hash + result.
- UNIQUE(provider, provider_event_id) for webhook de-duplication.
- Past order/sale item snapshots are immutable when catalogue prices change.
- Inventory movements are append-only; stock balance projection updates in the same transaction or from a reliable ledger projection.
- Order/payment/stock/outbox changes commit atomically when part of one business operation.
- Invoices, payouts, audit logs and payment events need retention/access policy and redaction.
- Tenant-scoped indexes begin with tenant_id where practical; index pending outbox and active jobs.

## 10. Java / Spring Boot package design

Use one deployable modular monolith initially. Root package: com.vyavsetu.

~~~text
com.vyavsetu
├── VyavsetuApplication.java
├── common/{api,security,tracing,money,idempotency,outbox}
├── identity/{api,application,domain,infrastructure}
├── tenancy/{api,application,domain,infrastructure}
├── customer/      catalog/       pricing/
├── orders/        payments/      merchant/
├── delivery/      chat/          pos/
├── invoicing/     inventory/     purchasing/
├── restaurant/    reporting/     subscriptions/
├── admin/         notifications/ sync/
└── audit/
~~~

Each module should have:
- **api:** thin REST controllers, Java record DTOs, Bean Validation and OpenAPI.
- **application:** use cases such as CreateOrder, AcceptMerchantOrder, CompleteDelivery and ReceivePurchaseOrder.
- **domain:** aggregates, status enums, Money value object and state-transition invariants.
- **infrastructure:** JPA repositories, Flyway migrations, provider adapters, outbox workers and object storage adapters.

Example request DTO:

~~~java
package com.vyavsetu.orders.api;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.util.UUID;

public record CreateOrderRequest(
    @NotBlank String quoteId,
    @NotBlank String clientOrderId,
    @NotNull UUID storeId,
    @NotBlank String fulfilmentType,
    UUID addressId,
    @NotBlank String paymentMethod,
    String customerNote
) {}
~~~

Java rules:
- CurrentActor comes from validated authentication; never accept actorId from the client as authority.
- Check membership, tenant, store, object ownership and role for every request.
- Separate platform roles from tenant roles; use least privilege and stronger authentication for high-risk SaaS actions.
- Use @Transactional around business state changes, but never hold DB transactions open around slow payment-gateway network calls.
- Use Flyway migrations and PostgreSQL integration tests, not production auto-DDL.
- Store secrets outside source control; admin settings responses return configured status, not secret values.

## 11. Realtime updates — WebSocket + STOMP

### Decision and boundary

Use **WebSocket with STOMP 1.2** for server-pushed updates in Customer, Store and Driver apps. Keep **REST as the authoritative command/read API** for checkout/order creation, store accept/reject/preparing/ready/handover, driver accept/pickup/start/complete, payment reconciliation and message creation. WebSocket publishes committed changes; it is not a second database and does not replace the 137 REST operations.

This is the proposed production design. The current HTML Customer/Store/Driver previews do **not** connect to a WebSocket server, and this repository does not yet contain a production Java backend or Flutter app projects. Do not add WebSocket calls to the existing previews as part of the documentation-only task.

### Connection and destinations

| Item | Local development | Production |
|---|---|---|
| REST base | `http://localhost:8080/api/v1` | `https://api.<your-domain>/api/v1` |
| WebSocket handshake | `ws://localhost:8080/ws` | `wss://api.<your-domain>/ws` |
| STOMP version | STOMP 1.2 over WebSocket | STOMP 1.2 over WebSocket |
| Client-to-server app prefix | `/app/**` | `/app/**` |
| Broker destinations | `/topic/**`, `/queue/**` | `/topic/**`, `/queue/**` |
| Per-user destinations | `/user/queue/**` | `/user/queue/**` |

The WebSocket handshake URL and STOMP destinations are infrastructure channels, not additional REST business endpoints. The 137 REST count remains unchanged.

| Destination | Consumer | Example events | Authorization requirement |
|---|---|---|---|
| `/user/queue/order-updates` | Customer app | `ORDER.CREATED`, `ORDER.STATUS_CHANGED`, `PAYMENT.STATUS_CHANGED` | Authenticated user is a participant on that order. |
| `/user/queue/store-orders` | Store app | `STORE.ORDER_ASSIGNED`, `ORDER.CANCELLED` | User has access to the order's tenant and store. |
| `/user/queue/driver-jobs` | Driver app | `DRIVER.JOB_ASSIGNED`, `DRIVER.JOB_CANCELLED` | Driver is approved and eligible for the assignment. |
| `/topic/orders/{orderId}/tracking` | Order participants + assigned driver | `DELIVERY.STATUS_CHANGED`, `DELIVERY.LOCATION_UPDATED` | Verify order participation and current driver assignment on every subscribe. |
| `/topic/conversations/{conversationId}` | Conversation participants | `CHAT.MESSAGE_CREATED`, `CHAT.MESSAGE_READ` | Active conversation participant only; enforce blocks/reports. |
| `/user/queue/notifications` | One signed-in user | `NOTIFICATION.CREATED` | User-specific, never a public broadcast. |
| `/user/queue/sync-alerts` | Signed-in user/device | `SYNC.CONFLICT`, `SYNC.REJECTED` | Limit to the requesting user's allowed tenant/device scope. |

Never authorize a subscription just because the client knows an order ID or supplies a tenant/store ID. Implement server-side subscription authorization against the authenticated principal and database relationships.

### Event envelope (server → frontend)

~~~json
{
  "eventId": "evt_01J9ORDER",
  "eventType": "ORDER.STATUS_CHANGED",
  "schemaVersion": 1,
  "occurredAt": "2026-10-16T09:15:20Z",
  "aggregate": {
    "type": "ORDER",
    "id": "ord_01J9ABC",
    "version": 4
  },
  "data": {
    "status": "READY_FOR_PICKUP",
    "storeId": "str_01J9STORE"
  },
  "requestId": "req_01J9"
}
~~~

### Message reliability rules

- Commit the order/status change first; publish only after the database transaction succeeds.
- Include `eventId`, `schemaVersion`, aggregate ID/version and server timestamp. The client ignores duplicate event IDs and stale aggregate versions.
- On connect/reconnect, reconnect and re-subscribe with a **fresh access token**. Refresh the token via REST; when the token rotates, recreate/reconnect the STOMP client.
- WebSocket is not a durable history. After reconnect, app resume, a sequence gap or a missed event, fetch the canonical state via REST (`GET /orders/{id}`, `GET /merchant/orders`, `GET /driver/jobs`) and/or use `/sync/pull`.
- Do not assume a frame sent means the business operation succeeded. Use REST response as the command result; optionally add application-level `eventId` ACKs if the domain requires them.
- Limit payload sizes, heartbeat, connection rate and location event frequency. Never broadcast raw customer address/phone or driver coordinates to audiences that are not authorized.
- For a single-node local prototype, Spring's simple in-memory broker is sufficient. For multiple backend replicas/production reliability, use a broker relay (e.g. RabbitMQ STOMP relay) or a dedicated event transport plus a transactional outbox; an in-memory broker does not fan out across replicas.

## 12. Backend implementation — Spring Boot WebSocket

### Dependencies (Maven)

Use the Spring Boot parent/BOM for managed versions; do not mix arbitrary Spring versions. Add the WebSocket, Web, Security, Validation, JPA, PostgreSQL, Flyway and Actuator starters alongside the existing dependencies.

~~~xml
<dependencies>
  <dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-web</artifactId>
  </dependency>
  <dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-websocket</artifactId>
  </dependency>
  <dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-security</artifactId>
  </dependency>
  <dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-validation</artifactId>
  </dependency>
  <dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-data-jpa</artifactId>
  </dependency>
  <dependency>
    <groupId>org.postgresql</groupId>
    <artifactId>postgresql</artifactId>
    <scope>runtime</scope>
  </dependency>
  <dependency>
    <groupId>org.flywaydb</groupId>
    <artifactId>flyway-core</artifactId>
  </dependency>
  <dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-actuator</artifactId>
  </dependency>
</dependencies>
~~~

### WebSocket configuration skeleton

~~~java
package com.vyavsetu.common.realtime;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {
    private final String[] allowedOrigins;
    private final StompAuthenticationInterceptor authenticationInterceptor;

    public WebSocketConfig(
            @Value("\${app.realtime.allowed-origins}") String[] allowedOrigins,
            StompAuthenticationInterceptor authenticationInterceptor) {
        this.allowedOrigins = allowedOrigins;
        this.authenticationInterceptor = authenticationInterceptor;
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/ws").setAllowedOriginPatterns(allowedOrigins);
        // Add SockJS only if a documented browser fallback is actually needed.
    }

    @Override
    public void configureClientInboundChannel(ChannelRegistration registration) {
        registration.interceptors(authenticationInterceptor);
    }

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        registry.setApplicationDestinationPrefixes("/app");
        registry.setUserDestinationPrefix("/user");
        registry.enableSimpleBroker("/topic", "/queue"); // local/single-node only
        // Production multi-instance option: configureMessageBroker(relay).
    }
}
~~~

### Authenticate the STOMP CONNECT frame

Native WebSocket clients and browsers have different ability to add HTTP handshake headers. Use the STOMP `CONNECT` frame's `Authorization: Bearer <access-token>` header and authenticate it in an inbound `ChannelInterceptor`; do not put the token in a URL query string. Secure the handshake origins separately. After authentication, set the connection's `Principal` and authorize every `SUBSCRIBE` destination.

Illustrative interceptor skeleton (wire `JwtAuthenticator` and `SubscriptionAuthorizer` to the project's actual Spring Security/JWT services):

~~~java
package com.vyavsetu.common.realtime;

import java.security.Principal;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.stereotype.Component;

@Component
public class StompAuthenticationInterceptor implements ChannelInterceptor {
    private final JwtAuthenticator jwtAuthenticator;
    private final SubscriptionAuthorizer subscriptionAuthorizer;

    public StompAuthenticationInterceptor(
            JwtAuthenticator jwtAuthenticator,
            SubscriptionAuthorizer subscriptionAuthorizer) {
        this.jwtAuthenticator = jwtAuthenticator;
        this.subscriptionAuthorizer = subscriptionAuthorizer;
    }

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor =
            MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
        if (accessor == null) return message;

        if (StompCommand.CONNECT.equals(accessor.getCommand())) {
            String header = accessor.getFirstNativeHeader("Authorization");
            if (header == null || !header.startsWith("Bearer ")) {
                throw new IllegalArgumentException("Missing STOMP bearer token");
            }
            Principal principal =
                jwtAuthenticator.authenticate(header.substring("Bearer ".length()));
            accessor.setUser(principal);
        }

        if (StompCommand.SUBSCRIBE.equals(accessor.getCommand())) {
            Principal principal = accessor.getUser();
            String destination = accessor.getDestination();
            if (principal == null ||
                !subscriptionAuthorizer.maySubscribe(principal, destination)) {
                throw new IllegalArgumentException("Subscription not authorized");
            }
        }
        return message;
    }
}
~~~

Register the interceptor with `configureClientInboundChannel(ChannelRegistration registration)`. Also configure the normal Spring Security HTTP filter chain, CORS/origin allowlist, rate limits, token expiry handling and tests. Never trust tenantId/storeId embedded in a destination without checking access in the database.

### Publish after commit

Domain services should persist the canonical order/status plus an outbox event in the same PostgreSQL transaction. An after-commit worker reads the outbox and publishes a minimal event via `SimpMessagingTemplate`. For a low-volume single instance, an `@TransactionalEventListener(phase = AFTER_COMMIT)` can demonstrate the flow, but a durable transactional outbox is the production choice; otherwise a process crash after commit but before publish can lose the realtime notification.

~~~java
package com.vyavsetu.common.realtime;

import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

@Component
public class RealtimePublisher {
    private final SimpMessagingTemplate messaging;

    public RealtimePublisher(SimpMessagingTemplate messaging) {
        this.messaging = messaging;
    }

    public void publishCustomerOrderUpdate(
            String customerUserId, Object eventEnvelope) {
        messaging.convertAndSendToUser(
            customerUserId, "/queue/order-updates", eventEnvelope);
    }

    public void publishStoreOrder(
            String storeUserId, Object eventEnvelope) {
        messaging.convertAndSendToUser(
            storeUserId, "/queue/store-orders", eventEnvelope);
    }

    public void publishDriverJob(
            String driverUserId, Object eventEnvelope) {
        messaging.convertAndSendToUser(
            driverUserId, "/queue/driver-jobs", eventEnvelope);
    }

    public void publishOrderTracking(String orderId, Object eventEnvelope) {
        messaging.convertAndSend(
            "/topic/orders/" + orderId + "/tracking", eventEnvelope);
    }
}
~~~

Use a typed `RealtimeEvent<T>` DTO rather than an arbitrary `Object` in production, and build recipient lists from trusted database relationships. Never let a client choose another user's destination for server publication.

### Backend configuration

Example local profile (set credentials through environment variables; do not commit production secrets):

~~~yaml
server:
  port: 8080
spring:
  datasource:
    url: ${DB_URL:jdbc:postgresql://localhost:5432/vyavsetu}
    username: ${DB_USERNAME:vyavsetu}
    password: ${DB_PASSWORD:change-me-local}
  jpa:
    hibernate:
      ddl-auto: validate
  flyway:
    enabled: true
  jackson:
    time-zone: UTC
app:
  realtime:
    allowed-origins: ${APP_ALLOWED_ORIGINS:http://localhost:3000,http://localhost:5173,http://localhost:8081}
management:
  endpoints:
    web:
      exposure:
        include: health,info
~~~

Do not use the example local password in a shared/staging/production environment. Keep production secrets in a secret manager. Flyway owns schema creation; `ddl-auto: validate` only validates.

## 13. Frontend implementation — Flutter Customer / Store / Driver

The frontend has three responsibilities: connect, subscribe to only permitted destinations, and reconcile pushed events with the local database/state. It must **not** treat WebSocket frames as the canonical order record and must not send privileged state changes by arbitrary STOMP messages.

### Dependency and config

Add a maintained Dart STOMP client to each Flutter app (or a shared internal package) and pin the resolved version in `pubspec.lock`:

~~~bash
flutter pub add stomp_dart_client
~~~

Provide per-environment values with `--dart-define` (use HTTPS/WSS outside local development):

~~~text
API_BASE_URL=http://localhost:8080/api/v1
WS_URL=ws://localhost:8080/ws
~~~

Android emulator special case: use `http://10.0.2.2:8080/api/v1` and `ws://10.0.2.2:8080/ws` to reach the host computer. A physical phone needs the host computer's reachable LAN IP, firewall access, and a development origin/security configuration. Do not ship cleartext WS/HTTP to production; use HTTPS/WSS and valid certificates.

### Shared Dart client skeleton

Keep one connection per signed-in app session, not one connection per widget. Callbacks should dispatch parsed typed events to the app's BLoC/Cubit/Repository, and repositories then refresh Drift-backed state. Example API shape (adapt error APIs to the pinned package version):

~~~dart
import 'dart:convert';
import 'package:stomp_dart_client/stomp_dart_client.dart';

class VyavsetuRealtimeClient {
  StompClient? _client;
  final void Function(Map<String, dynamic>) onEvent;
  final void Function(Object error)? onError;

  VyavsetuRealtimeClient({required this.onEvent, this.onError});

  void connect({
    required String wsUrl,
    required String accessToken,
    required List<String> destinations,
  }) {
    disconnect();
    _client = StompClient(
      config: StompConfig(
        url: wsUrl,
        stompConnectHeaders: {'Authorization': 'Bearer $accessToken'},
        heartbeatIncoming: const Duration(seconds: 20),
        heartbeatOutgoing: const Duration(seconds: 20),
        reconnectDelay: const Duration(seconds: 5),
        onConnect: (frame) {
          for (final destination in destinations) {
            _client?.subscribe(
              destination: destination,
              callback: (frame) {
                final body = frame.body;
                if (body == null) return;
                try {
                  final decoded = jsonDecode(body);
                  if (decoded is Map<String, dynamic>) onEvent(decoded);
                } catch (error) {
                  onError?.call(error); // malformed/outdated event
                }
              },
            );
          }
        },
        onWebSocketError: (dynamic error) => onError?.call(error is Object ? error : Exception('$error')),
        onStompError: (frame) => onError?.call(Exception(frame.body ?? 'STOMP error')),
      ),
    );
    _client!.activate();
  }

  void disconnect() {
    _client?.deactivate();
    _client = null;
  }
}
~~~

Check the exact constructor/callback types against the resolved `stomp_dart_client` version during implementation; package versions can change. When the access token refreshes, deactivate and create a new connection with the fresh token. Disconnect on logout/account switch and when the session is revoked.

### Subscription sets by app

~~~dart
// Customer app
const customerSubscriptions = [
  '/user/queue/order-updates',
  '/user/queue/notifications',
];

// Store app — only if the signed-in staff membership can access that store
const storeSubscriptions = [
  '/user/queue/store-orders',
  '/user/queue/notifications',
];

// Driver app — only for an approved, signed-in driver
const driverSubscriptions = [
  '/user/queue/driver-jobs',
  '/user/queue/notifications',
];
~~~

Subscribe to `/topic/orders/{orderId}/tracking` only while the user is allowed to view that order and its driver tracking. Unsubscribe on leaving the order, logout or loss of permission. These destination strings should match the server configuration exactly.

### Frontend event handling contract

1. User signs in through REST and the app securely stores session credentials using the platform-appropriate secure storage.
2. App loads its current orders/jobs from REST and immediately displays its Drift/local cached view.
3. Realtime client connects and subscribes after authentication.
4. On `ORDER.STATUS_CHANGED`, `DRIVER.JOB_ASSIGNED` or `DELIVERY.LOCATION_UPDATED`, validate the envelope/version; update invalidation/state and refresh the canonical entity through the repository.
5. Repository/DAO updates the local database; BLoC/Cubit emits the updated view. Ignore duplicate `eventId` values and stale aggregate versions.
6. When connection returns after a gap, perform a REST/delta-sync reconciliation before assuming the screen is current.
7. UI commands still call REST, e.g. `POST /merchant/orders/{id}/ready`; the server validates the transition and publishes the resulting event after commit.

For the current **HTML preview only**, do not add a fake WebSocket connection: it continues to use browser localStorage and works in one browser/origin. The shared event contract is for the future Flutter apps and live backend.

## 14. Local development — start backend and frontend end-to-end

The following is the proposed runbook for the backend/frontend projects after they are created. It does not imply that a Java service or Flutter source apps currently exist in this repository.

### A. Start PostgreSQL

Create `docker-compose.dev.yml` outside the existing app code, or in the backend folder:

~~~yaml
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_DB: vyavsetu
      POSTGRES_USER: vyavsetu
      POSTGRES_PASSWORD: change-me-local
    ports:
      - "5432:5432"
    volumes:
      - vyavsetu_pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U vyavsetu -d vyavsetu"]
      interval: 5s
      timeout: 3s
      retries: 20
volumes:
  vyavsetu_pgdata:
~~~

Run from the folder containing that file:

~~~bash
docker compose -f docker-compose.dev.yml up -d postgres
docker compose -f docker-compose.dev.yml ps
~~~

### B. Start Spring Boot

From the backend project root (once scaffolded), configure the environment and launch:

~~~bash
export DB_URL='jdbc:postgresql://localhost:5432/vyavsetu'
export DB_USERNAME='vyavsetu'
export DB_PASSWORD='change-me-local'
export APP_ALLOWED_ORIGINS='http://localhost:3000,http://localhost:5173,http://localhost:8081'
./mvnw spring-boot:run -Dspring-boot.run.profiles=local
~~~

Verify health once Actuator is included/configured:

~~~bash
curl -fsS http://localhost:8080/actuator/health
~~~

Expected health response is `{"status":"UP"}` when the app and required health contributors are ready. Check Flyway migration logs and confirm `ddl-auto: validate` passes before testing realtime.

### C. Start the Flutter frontend

For each Flutter source app folder (paths below are placeholders until the Flutter projects are created):

~~~bash
cd <customer-flutter-app>
flutter pub get
flutter run -d chrome --dart-define=API_BASE_URL=http://localhost:8080/api/v1 --dart-define=WS_URL=ws://localhost:8080/ws
~~~

Use the same configuration approach for Store and Driver. For a physical Android phone, replace localhost with the developer machine's reachable LAN address and allow the development port through the firewall. For Android emulator use 10.0.2.2. Do not use development cleartext traffic in production.

### D. Verify the full realtime flow

1. Sign in as a test customer; create an order via REST. Verify `GET /orders/{orderId}` returns `PENDING_STORE_ACCEPTANCE`.
2. Sign in as staff for the matching store in a separate client. The Store app receives `STORE.ORDER_ASSIGNED` through `/user/queue/store-orders`.
3. Use REST to accept and mark the order preparing/ready. After the PostgreSQL commit, the server outbox publishes `ORDER.STATUS_CHANGED`; the Customer app refreshes its order view.
4. Dispatcher assigns a driver; the Driver app gets `DRIVER.JOB_ASSIGNED`. Driver accepts/picks up/starts/completes through the REST endpoints.
5. The customer/authorized store subscribes to its allowed tracking topic and receives status/location events. Complete delivery using a server-verified OTP, not a client-side state override.
6. Stop network briefly and resume it. Verify reconnect/resubscription, REST/sync reconciliation, no duplicate order/payment, and correct current state.
7. Try an unauthorized user subscribing to another tenant's order topic; the server must deny it and emit an auditable security event.

### E. Troubleshooting

| Symptom | Check |
|---|---|
| WebSocket fails before STOMP connects | `/ws` endpoint, HTTP/proxy upgrade headers, allowed Origin, TLS/mixed-content rules, port/firewall. |
| STOMP reports unauthenticated | CONNECT frame carries current bearer token; interceptor validates it; token hasn't expired. |
| CONNECT works but SUBSCRIBE is denied | User destination spelling and object-level subscription authorizer. |
| REST changes succeed but no event arrives | Domain outbox persisted; publisher/relay health; recipient user ID maps to authenticated Principal; event schema/version. |
| Duplicate/stale cards after reconnect | Dedupe by `eventId`, compare aggregate version, then reconcile by REST/delta cursor. |
| Works on one instance only | Simple broker is in-memory; use broker relay or shared event transport for multiple replicas. |
| Browser complains about mixed content | If page is HTTPS, WebSocket must use WSS in production; localhost exceptions are for local development only. |

## 15. Security, privacy & reliability

- TLS, short-lived access tokens, refresh rotation, password hashing and OTP attempt limits.
- Object-level tests for orders, addresses, payments, conversations and driver jobs.
- Signed payment webhooks with freshness/replay checks, event de-duplication and reconciliation.
- Same Idempotency-Key + same body replays the result; same key + different body returns 409.
- Validate inputs; set CORS allowlist, upload size/type scanning and CSRF strategy where cookie auth is used.
- Logs include requestId/tenantId/actorId/module/entity/outcome but omit passwords, OTPs, tokens, card data, full addresses and chat content.
- Monitor API latency, error rate, checkout failure, sync queue age, webhook lag, outbox retries, inventory conflicts and driver dispatch latency.

## 16. Implementation order

1. **Foundation:** API envelope/errors, auth/session, tenant context, permissions, Flyway, request IDs, idempotency and OpenAPI.
2. **Marketplace slice:** store/catalog → quote/order → merchant accept/ready → driver delivery → customer timeline.
3. **Payments/chat/notifications:** sandbox provider, webhooks/reconciliation, customer address/payment tokenization and user safety.
4. **Offline POS:** Drift migrations, provisional bills, sale/payment/invoice, printing, outbox push, delta pull and conflict UI.
5. **Inventory/purchasing/reports:** movement ledger, receiving and server-authoritative reports.
6. **SaaS admin:** tenants, plans, subscriptions, entitlement, staff/roles, campaigns, contact messages, CMS, settings, audit and flags.
7. **Hardening:** tenant boundary tests, concurrency/offline retries, webhook replay, backup/restore, accessibility/device tests and rollback.

Do not implement all 137 endpoints in one unreviewed batch. Ship a narrow end-to-end vertical slice while keeping contracts versioned and testable.

## 17. Acceptance checklist

- [ ] All 137 proposal endpoints are represented in OpenAPI with schemas, access, response codes and error model before client integration.
- [ ] Tests prove a user cannot read another customer's order/address/payment/chat or another tenant's store.
- [ ] Same idempotency key/body replays result; same key/different body gives 409.
- [ ] Payment timeout reconciles and cannot duplicate charges or mark unpaid orders as paid.
- [ ] Invalid merchant/driver state transitions are rejected and recorded in timeline.
- [ ] POS sale/stock/payment/invoice follow transaction policy; print failure does not undo a committed sale.
- [ ] Outbox survives restart; ACK/CONFLICT/REJECTED stay distinct and actionable.
- [ ] Local migrations preserve data; logout/account switch clears sensitive user cache.
- [ ] OpenAPI examples match Java DTOs and contract tests.
- [ ] Current HTML prototype, screens, logic and 36 localStorage keys remain untouched by documentation-only changes.

## 18. Related documents

- [Architecture & business flowcharts](ARCHITECTURE_FLOWCHARTS.md) · [visual version](architecture-flowcharts.html)
- [Developer handoff](DEVELOPER_HANDOFF.md) · [visual handoff](developer-handoff.html)
- [Developer docs home](index.html)
- [Standalone app prototypes](../apps/README.md)
