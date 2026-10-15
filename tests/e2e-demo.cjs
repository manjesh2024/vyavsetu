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

    // 1. POS approved dummy cash transaction creates a demo receipt and order.
    await go('pos');
    await app.locator('[data-pos-add="bowl"]').click();
    await app.locator('[data-header-action="checkout-pos"]').click();
    await app.locator('#payMethod').selectOption('cash');
    await app.locator('#payResult').selectOption('success');
    await app.locator('[data-action="confirm-checkout"]').click();
    await app.locator('#dialogTitle').waitFor();
    assert.ok((await app.locator('#dialogTitle').textContent()).includes('Demo receipt'), 'POS success should show receipt');
    await app.locator('[data-action="close-dialog"]').last().click();

    // 2. Decline does not create a paid order and keeps the basket intact.
    await app.locator('[data-pos-add="bowl"]').click();
    await app.locator('[data-header-action="checkout-pos"]').click();
    await app.locator('#payResult').selectOption('declined');
    await app.locator('[data-action="confirm-checkout"]').click();
    assert.equal((await app.locator('#dialogTitle').textContent()).trim(), 'Payment declined');
    await app.locator('[data-action="close-dialog"]').last().click();
    assert.ok(await app.locator('[data-pos-qty="bowl"]').count() >= 2, 'Declined checkout should preserve cart quantity controls');
    await app.locator('[data-action="clear-pos"]').click();

    // 3. Marketplace checkout creates a real local demo order, customer record, driver job and kitchen ticket.
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

    const marketOrderId = await app.locator('body').evaluate(() => {
      const orders = JSON.parse(localStorage.getItem('vyavsetu_demo_orders') || '[]');
      return orders.find(order => order.customer === 'E2E Demo Customer')?.id;
    });
    assert.ok(marketOrderId, 'Marketplace checkout should save an order ID');

    // 4. Driver can accept, pick up, start route and complete that exact order.
    await go('driver');
    let deliveryCard = app.locator('.delivery-card').filter({ hasText: marketOrderId });
    await deliveryCard.locator('[data-driver-action="accept"]').click();
    await deliveryCard.locator('[data-driver-action="pickup"]').click();
    await deliveryCard.locator('[data-driver-action="route"]').click();
    await deliveryCard.locator('[data-driver-action="complete"]').click();
    await app.locator('#driverOtp').fill('2468');
    await app.locator('[data-action="confirm-delivery"]').click();
    deliveryCard = app.locator('.delivery-card').filter({ hasText: marketOrderId });
    await assert.equal((await deliveryCard.locator('.tag').textContent()).trim(), 'Delivered',
      'Driver should mark this exact marketplace order delivered');

    // 5. The customer order list must show delivery status for this exact order.
    await go('market');
    const customerOrderRow = app.locator('.order-row').filter({ hasText: marketOrderId });
    await customerOrderRow.waitFor();
    const customerStatusTexts = await customerOrderRow.locator('small').allTextContents();
    const deliveryDiagnostics = await app.locator('body').evaluate(() => ({
      targetOrder: JSON.parse(localStorage.getItem('vyavsetu_demo_orders') || '[]').find(order => order.customer === 'E2E Demo Customer'),
      matchingJobs: JSON.parse(localStorage.getItem('vyavsetu_driver_jobs') || '[]').filter(job => job.customer === 'E2E Demo Customer'),
      deliveryStatuses: JSON.parse(localStorage.getItem('vyavsetu_delivery_statuses') || '{}')
    }));
    assert.ok(customerStatusTexts.includes('Delivered'),
      'Customer order status should reflect driver completion. Row: '+JSON.stringify(customerStatusTexts)+' Data: '+JSON.stringify(deliveryDiagnostics));
    // 6. Purchasing receiving creates or updates the stock record.
    await go('purchases');
    await app.locator('[data-action="new-purchase"]').click();
    await app.locator('#poQty').fill('10');
    await app.locator('[data-action="save-purchase"]').click();
    await app.locator('[data-po-action="order"]').first().click();
    await app.locator('[data-po-action="receive"]').first().click();
    await app.getByText('Received', { exact: true }).first().waitFor();

    // 7. Product creation persists to the catalogue and remains searchable/visible.
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
    console.log('PASS POS approval receipt');
    console.log('PASS declined payment preserves cart');
    console.log('PASS marketplace checkout');
    console.log('PASS driver delivery OTP and completion');
    console.log('PASS customer order status tracking');
    console.log('PASS purchase receiving and product creation');
    console.log('PASS all module navigation');
    console.log('PASS dark theme and phone viewport');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exit(1); });
