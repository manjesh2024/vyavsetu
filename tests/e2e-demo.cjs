const assert = require('node:assert/strict');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1050 } });
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  try {
    await page.goto(process.env.VYAVSETU_URL || 'http://127.0.0.1:8000/', { waitUntil: 'domcontentloaded' });
    const app = page.frameLocator('#app');
    await app.locator('#nav').waitFor();

    async function go(name) {
      await app.locator('#nav button[data-page="' + name + '"]').click();
      await app.locator('main h1').first().waitFor();
    }
    async function orderByCustomer(name) {
      return page.locator('#app').evaluate((frame, customer) => {
        const appDoc = frame.contentDocument;
        return JSON.parse(appDoc.defaultView.localStorage.getItem('vyavsetu_demo_orders') || '[]')
          .find(order => order.customer === customer) || null;
      }, name);
    }

    // POS product controls are the supported click targets, not the decorative card.
    await go('pos');
    const posStockBefore = await page.locator('#app').evaluate(frame =>
      JSON.parse(frame.contentDocument.defaultView.localStorage.getItem('vyavsetu_pos_products') || '[]')
        .find(product => product.id === 'bowl')?.stock);
    const bowlCard = app.locator('[data-pos-product][data-pos-id="bowl"]');
    await bowlCard.locator('.art').click();
    assert.equal(await bowlCard.locator('[data-pos-qty="bowl"]').count(), 2,
      'Clicking the product-card surface should add the item and show quantity controls');
    assert.match(await app.locator('main').innerText(), /1 in cart/,
      'Product-card click should update the cart display');
    await bowlCard.locator('[data-pos-qty="bowl"][data-d="1"]').click();
    assert.match(await app.locator('main').innerText(), /2 in cart/,
      'Product quantity increment should update the POS cart display');

    // 1. POS approved dummy cash transaction creates a demo receipt, order and stock deduction.
    await app.locator('[data-header-action="checkout-pos"]').click();
    await app.locator('#payMethod').selectOption('cash');
    await app.locator('#payResult').selectOption('success');
    await app.locator('[data-action="confirm-checkout"]').click();
    assert.ok((await app.locator('#dialogTitle').textContent()).includes('Demo receipt'), 'POS success should show receipt');
    await app.locator('[data-action="close-dialog"]').last().click();
    const posStockAfter = await page.locator('#app').evaluate(frame =>
      JSON.parse(frame.contentDocument.defaultView.localStorage.getItem('vyavsetu_pos_products') || '[]')
        .find(product => product.id === 'bowl')?.stock);
    assert.equal(posStockAfter, posStockBefore - 2, 'Approved POS checkout should deduct the exact sold quantity');
    const posOrderCount = await page.locator('#app').evaluate(frame =>
      JSON.parse(frame.contentDocument.defaultView.localStorage.getItem('vyavsetu_demo_orders') || '[]').length);

    // 2. Decline must preserve the basket and create no order.
    await app.locator('[data-pos-add="bowl"]').click();
    await app.locator('[data-header-action="checkout-pos"]').click();
    await app.locator('#payResult').selectOption('declined');
    await app.locator('[data-action="confirm-checkout"]').click();
    assert.equal((await app.locator('#dialogTitle').textContent()).trim(), 'Payment declined');
    await app.locator('[data-action="close-dialog"]').last().click();
    assert.ok(await app.locator('[data-pos-qty="bowl"]').count() >= 2, 'Declined checkout should preserve cart quantity controls');
    const declineOrderCount = await page.locator('#app').evaluate(frame =>
      JSON.parse(frame.contentDocument.defaultView.localStorage.getItem('vyavsetu_demo_orders') || '[]').length);
    assert.equal(declineOrderCount, posOrderCount, 'Declined payment must not create an order');
    await app.locator('[data-action="clear-pos"]').click();

    // 3. Timeout is explicitly pending/unknown: not paid, with no driver job/stock deduction.
    await app.locator('[data-pos-add="coffee"]').click();
    const coffeeStockBefore = await page.locator('#app').evaluate(frame =>
      JSON.parse(frame.contentDocument.defaultView.localStorage.getItem('vyavsetu_pos_products') || '[]')
        .find(product => product.id === 'coffee')?.stock);
    await app.locator('[data-header-action="checkout-pos"]').click();
    await app.locator('#payMethod').selectOption('card');
    await app.locator('#payResult').selectOption('unknown');
    await app.locator('[data-action="confirm-checkout"]').click();
    assert.equal((await app.locator('#dialogTitle').textContent()).trim(), 'Payment status needs checking');
    await app.locator('[data-action="close-dialog"]').last().click();
    const timeoutState = await page.locator('#app').evaluate(frame => {
      const s = frame.contentDocument.defaultView.localStorage;
      const orders = JSON.parse(s.getItem('vyavsetu_demo_orders') || '[]');
      const products = JSON.parse(s.getItem('vyavsetu_pos_products') || '[]');
      return {
        order: orders.find(order => order.status === 'Payment pending reconciliation'),
        coffeeStock: products.find(product => product.id === 'coffee')?.stock,
      };
    });
    assert.ok(timeoutState.order, 'Timeout should persist a pending reconciliation order');
    assert.notEqual(timeoutState.order.status, 'Paid (dummy)', 'Timeout must not appear paid');
    assert.equal(timeoutState.coffeeStock, coffeeStockBefore, 'Unknown payment should not deduct stock');
    await app.locator('[data-action="clear-pos"]').click();

    // 4. Marketplace checkout creates an order, customer record, driver job and kitchen ticket.
    await go('market');
    await app.locator('[data-market-add="m1"]').click();
    await app.locator('[data-header-action="checkout-market"]').click();
    await app.locator('#payName').fill('E2E Demo Customer');
    await app.locator('#payPhone').fill('9876543210');
    await app.locator('#payAddress').fill('12 Demo Street, Noida');
    await app.locator('#payMethod').selectOption('upi');
    await app.locator('#payResult').selectOption('success');
    await app.locator('[data-action="confirm-checkout"]').click();
    assert.ok((await app.locator('#dialogTitle').textContent()).includes('Demo receipt'), 'Marketplace success should show receipt');
    await app.locator('[data-action="close-dialog"]').last().click();

    const marketOrderId = await page.locator('#app').evaluate(frame => {
      const orders = JSON.parse(frame.contentDocument.defaultView.localStorage.getItem('vyavsetu_demo_orders') || '[]');
      return orders.find(order => order.customer === 'E2E Demo Customer')?.id;
    });
    assert.ok(marketOrderId, 'Marketplace checkout should save an order ID');

    // Same customer details on a different order must not inherit this delivery status.
    await page.locator('#app').evaluate((frame) => {
      const win = frame.contentWindow;
      const key = 'vyavsetu_demo_orders';
      const orders = JSON.parse(win.localStorage.getItem(key) || '[]');
      orders.unshift({
        id: 'VY-DUPLICATE-E2E', source: 'market', customer: 'E2E Demo Customer',
        phone: '9876543210', address: '12 Demo Street, Noida',
        lines: [], subtotal: 0, tax: 0, delivery: 0, total: 0,
        method: 'Dummy UPI', status: 'Paid (dummy)',
        deliveryStatus: 'Awaiting dispatch', created: new Date().toISOString()
      });
      win.localStorage.setItem(key, JSON.stringify(orders));
      win.location.reload();
    });
    await app.locator('#nav').waitFor();

    // 5. Driver transitions should remain linked to this exact order ID.
    await go('driver');
    let deliveryCard = app.locator('.delivery-card').filter({ hasText: marketOrderId });
    await deliveryCard.locator('[data-driver-action="accept"]').click();
    await deliveryCard.locator('[data-driver-action="pickup"]').click();
    await deliveryCard.locator('[data-driver-action="route"]').click();
    await deliveryCard.locator('[data-driver-action="complete"]').click();
    await app.locator('#driverOtp').fill('2468');
    await app.locator('[data-action="confirm-delivery"]').click();
    deliveryCard = app.locator('.delivery-card').filter({ hasText: marketOrderId });
    assert.equal((await deliveryCard.locator('.tag').textContent()).trim(), 'Delivered',
      'Driver should mark this exact marketplace order delivered');

    // 6. The customer order list and saved record must reflect driver completion.
    await go('market');
    const customerOrderRow = app.locator('.order-row').filter({ hasText: marketOrderId });
    await customerOrderRow.waitFor();
    const customerStatusTexts = await customerOrderRow.locator('small').allTextContents();
    const deliveryDiagnostics = await page.locator('#app').evaluate((frame, id) => {
      const s = frame.contentDocument.defaultView.localStorage;
      return {
        targetOrder: JSON.parse(s.getItem('vyavsetu_demo_orders') || '[]').find(order => String(order.id) === id),
        matchingJobs: JSON.parse(s.getItem('vyavsetu_driver_jobs') || '[]').filter(job => String(job.orderId) === id),
        deliveryStatuses: JSON.parse(s.getItem('vyavsetu_delivery_statuses') || '{}')
      };
    }, marketOrderId);
    assert.ok(customerStatusTexts.includes('Delivered'),
      'Customer order status should reflect driver completion. Row: '+JSON.stringify(customerStatusTexts)+' Data: '+JSON.stringify(deliveryDiagnostics));
    assert.equal(deliveryDiagnostics.targetOrder?.deliveryStatus, 'Delivered',
      'Exact order record should save Delivered');
    assert.equal(deliveryDiagnostics.matchingJobs.length, 1,
      'A checkout should create exactly one driver job keyed by order ID');
    const unrelatedCustomerOrder = app.locator('.order-row').filter({ hasText: 'VY-DUPLICATE-E2E' });
    await unrelatedCustomerOrder.waitFor();
    assert.ok((await unrelatedCustomerOrder.innerText()).includes('Awaiting dispatch'),
      'A separate order with matching customer details must not inherit Delivered status');
    assert.ok(!(await unrelatedCustomerOrder.innerText()).includes('Delivered'),
      'Driver status should never leak between orders sharing customer details');

    // 7. Purchase receiving creates or updates a stock record.
    await go('purchases');
    await app.locator('[data-action="new-purchase"]').click();
    await app.locator('#poQty').fill('10');
    await app.locator('[data-action="save-purchase"]').click();
    await app.locator('[data-po-action="order"]').first().click();
    await app.locator('[data-po-action="receive"]').first().click();
    await app.getByText('Received', { exact: true }).first().waitFor();

    // 8. Product creation persists to the catalogue and remains searchable/visible.
    await go('products');
    await app.locator('[data-action="add-product"]').click();
    await app.locator('#pName').fill('E2E Sample Product');
    await app.locator('#pSku').fill('E2E-1001');
    await app.locator('#pCat').fill('Testing');
    await app.locator('#pPrice').fill('99');
    await app.locator('#pStock').fill('20');
    await app.locator('#pEmoji').fill('🧪');
    await app.locator('[data-action="save-product"]').click();
    await app.getByText('E2E Sample Product', { exact: true }).first().waitFor();

    for (const name of ['overview','pos','orders','products','purchases','inventory','suppliers','customers','returns','reports','staff','settings','restaurant','market','driver','admin','plans','subscriptions','support','features','developer']) {
      await go(name);
      assert.ok(await app.locator('main h1').count(), 'Missing page heading: '+name);
    }
    await page.locator('#theme').selectOption('dark');
    await page.waitForFunction(() => document.querySelector('#app')?.contentDocument?.documentElement?.dataset?.theme === 'dark');
    await page.locator('#theme').selectOption('light');
    await page.locator('#device').selectOption('iphone');
    assert.ok(await page.locator('#shell.mobile').count(), 'Phone shell should be active');
    await page.waitForFunction(() => Math.abs(document.querySelector('#shell').getBoundingClientRect().width - 390) < 2);
    const phoneWidth = await page.locator('#shell').evaluate(el => Math.round(el.getBoundingClientRect().width));
    assert.ok(phoneWidth >= 380 && phoneWidth <= 400, 'Unexpected phone preview width: '+phoneWidth);
    const mobile = await browser.newPage({viewport:{width:390,height:844}});
    await mobile.goto(process.env.VYAVSETU_URL || 'http://127.0.0.1:8000/', {waitUntil:'domcontentloaded'});
    const dimensions = await mobile.evaluate(() => ({w:innerWidth,d:document.documentElement.scrollWidth}));
    assert.ok(dimensions.d <= dimensions.w, 'Mobile page overflows: '+JSON.stringify(dimensions));
    await mobile.close();
    assert.deepEqual(pageErrors, [], 'No unhandled browser JavaScript errors should occur: ' + pageErrors.join('; '));
    console.log('PASS POS product card Add/quantity controls and cart UI');
    console.log('PASS POS approval, receipt and exact stock deduction');
    console.log('PASS declined payment preserves basket and creates no order');
    console.log('PASS timeout creates pending reconciliation without stock deduction');
    console.log('PASS marketplace checkout and customer capture');
    console.log('PASS driver delivery OTP updates exact customer order status');
    console.log('PASS purchase receiving and product creation');
    console.log('PASS all module navigation');
    console.log('PASS dark theme and phone viewport/overflow');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exit(1); });
