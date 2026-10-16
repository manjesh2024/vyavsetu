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

## 11. Security, privacy & reliability

- TLS, short-lived access tokens, refresh rotation, password hashing and OTP attempt limits.
- Object-level tests for orders, addresses, payments, conversations and driver jobs.
- Signed payment webhooks with freshness/replay checks, event de-duplication and reconciliation.
- Same Idempotency-Key + same body replays the result; same key + different body returns 409.
- Validate inputs; set CORS allowlist, upload size/type scanning and CSRF strategy where cookie auth is used.
- Logs include requestId/tenantId/actorId/module/entity/outcome but omit passwords, OTPs, tokens, card data, full addresses and chat content.
- Monitor API latency, error rate, checkout failure, sync queue age, webhook lag, outbox retries, inventory conflicts and driver dispatch latency.

## 12. Implementation order

1. **Foundation:** API envelope/errors, auth/session, tenant context, permissions, Flyway, request IDs, idempotency and OpenAPI.
2. **Marketplace slice:** store/catalog → quote/order → merchant accept/ready → driver delivery → customer timeline.
3. **Payments/chat/notifications:** sandbox provider, webhooks/reconciliation, customer address/payment tokenization and user safety.
4. **Offline POS:** Drift migrations, provisional bills, sale/payment/invoice, printing, outbox push, delta pull and conflict UI.
5. **Inventory/purchasing/reports:** movement ledger, receiving and server-authoritative reports.
6. **SaaS admin:** tenants, plans, subscriptions, entitlement, staff/roles, campaigns, contact messages, CMS, settings, audit and flags.
7. **Hardening:** tenant boundary tests, concurrency/offline retries, webhook replay, backup/restore, accessibility/device tests and rollback.

Do not implement all 137 endpoints in one unreviewed batch. Ship a narrow end-to-end vertical slice while keeping contracts versioned and testable.

## 13. Acceptance checklist

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

## 14. Related documents

- [Architecture & business flowcharts](ARCHITECTURE_FLOWCHARTS.md) · [visual version](architecture-flowcharts.html)
- [Developer handoff](DEVELOPER_HANDOFF.md) · [visual handoff](developer-handoff.html)
- [Developer docs home](index.html)
- [Standalone app prototypes](../apps/README.md)
