const fs = require('node:fs');
const assert = require('node:assert/strict');

const html = fs.readFileSync('app.html', 'utf8');
const scripts = [...html.matchAll(/<script>([\\s\\S]*?)<\\/script>/gi)].map(m => m[1]);
assert.ok(scripts.length, 'app.html should contain an application script');
for (const [i, script] of scripts.entries()) {
  try { new Function(script); }
  catch (error) { console.error('JavaScript syntax check failed in script', i, error); throw error; }
}
const required = [
  ['POS per-item add', 'function addPos(id)'],
  ['POS quantity controls', 'function qtyPos(id,d)'],
  ['POS checkout', "beginCheckout('pos')"],
  ['Marketplace checkout', "beginCheckout('market')"],
  ['Pending reconciliation state', 'Payment pending reconciliation'],
  ['Dummy decline flow', "result==='declined'"],
  ['Dummy timeout flow', "result==='unknown'"],
  ['Cash on delivery not paid', 'Confirmed · collect on delivery'],
  ['Order history', 'function orders()'],
  ['Provisional bill save', 'function saveProvisionalBill()'],
  ['Provisional bill resume', 'function resumeBill(id)'],
  ['Receipt print', 'function printDemoReceipt()'],
  ['Export orders', 'function downloadOrders()'],
  ['No real payment connection disclaimer', 'No card, UPI or bank connection']
];
for (const [label, needle] of required) {
  assert.ok(html.includes(needle), 'Missing expected demo capability: ' + label);
  console.log('PASS', label);
}
assert.ok(html.includes('data-action="confirm-checkout"'), 'Checkout confirmation action should exist');
assert.ok(html.includes('data-market-shop='), 'Marketplace shop controls should exist');
assert.ok(html.includes('One store per order'), 'Marketplace must enforce one store per order');
console.log('PASS embedded JavaScript syntax');
console.log('PASS all demo capability checks');
