const fs = require('node:fs');
const assert = require('node:assert/strict');

const html = fs.readFileSync('app.html', 'utf8');
const scripts = html.split('<script>').slice(1).map(part => part.split('</script>')[0]);
assert.ok(scripts.length, 'app.html should contain an application script');
for (const [i, script] of scripts.entries()) {
  try { new Function(script); }
  catch (error) { console.error('JavaScript syntax check failed in script', i, error); throw error; }
}
const required = [
  ['POS product add', 'function addPos(id)'],
  ['POS per-item quantity', 'function qtyPos(id,d)'],
  ['POS checkout', "beginCheckout('pos')"],
  ['Marketplace basket', "beginCheckout('market')"],
  ['Dummy payment decline', "result==='declined'"],
  ['Dummy payment timeout', "result==='unknown'"],
  ['COD remains unpaid', 'Confirmed · collect on delivery'],
  ['Orders and receipts', 'function orders()'],
  ['Provisional bill save/resume', 'function saveProvisionalBill()'],
  ['POS inventory deduction', "writeStore('vyavsetu_inventory_items',inventoryItems)"],
  ['Marketplace creates driver job', 'createDriverJob(order)'],
  ['Driver status transition', 'function advanceDriver(id,action)'],
  ['Driver OTP delivery completion', 'function completeDriverDelivery(id)'],
  ['KDS ticket transitions', 'function advanceKitchen(id)'],
  ['Inventory receipt/adjustment', 'function saveStock(id,mode)'],
  ['Product create/edit/delete', 'function saveProduct(id)'],
  ['Purchase order receiving', "function purchaseAction(id,action)"],
  ['Customer records', 'function saveCustomer(id)'],
  ['Return/refund workflow', 'function processReturn(id,action)'],
  ['CSV reports export', 'function downloadSalesCsv()'],
  ['Staff management', 'function saveStaff()'],
  ['Business settings', 'function saveBusinessSettings()'],
  ['Plans and subscriptions', 'function saveSubscription(id)'],
  ['Support ticket workflow', 'function toggleSupport(id)'],
  ['Feature flags', 'function toggleFeature(id)'],
  ['Product catalogue CRUD', 'function saveProduct(id)'],
  ['Purchasing and receiving', 'function purchaseAction(id,action)'],
  ['Supplier management', 'function saveSupplier(id)'],
  ['Customer management', 'function saveCustomer(id)'],
  ['Returns/refunds', 'function processReturn(id,action)'],
  ['Reports and CSV export', 'function downloadSalesCsv()'],
  ['Staff records', 'function saveStaff()'],
  ['Business settings', 'function saveBusinessSettings()'],
  ['SaaS plans', 'function savePlan()'],
  ['Tenant subscriptions', 'function saveSubscription(id)'],
  ['Support centre', 'function saveSupportTicket()'],
  ['Feature flag screen', 'function features()'],
  ['Developer handoff', 'function developer()']
];
for (const [label, needle] of required) {
  assert.ok(html.includes(needle), 'Missing expected capability: ' + label);
  console.log('PASS', label);
}
assert.ok(html.includes('data-action="confirm-checkout"'), 'Checkout confirmation action should exist');
assert.ok(html.includes('data-market-shop='), 'Marketplace shop selection should exist');
assert.ok(html.includes('data-driver-id='), 'Driver action controls should exist');
assert.ok(html.includes('data-kds-advance='), 'Kitchen status controls should exist');
assert.ok(html.includes('data-product-edit='), 'Product management controls should exist');
assert.ok(html.includes('data-po-action='), 'Purchase receiving controls should exist');
assert.ok(html.includes('No real payment gateway is used'), 'Dummy payment disclaimer should exist');
assert.ok(!html.includes('Demo action completed'), 'Generic inert header action should not remain');
console.log('PASS embedded JavaScript syntax');
console.log('PASS all interaction capability checks');
