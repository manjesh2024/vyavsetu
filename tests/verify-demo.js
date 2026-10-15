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
  ['POS per-item add', 'function addPos(id)'],
  ['POS quantity controls', 'function qtyPos(id,d)'],
  ['POS checkout entry', "beginCheckout('pos')"],
  ['Marketplace checkout entry', "beginCheckout('market')"],
  ['Pending reconciliation state', 'Payment pending reconciliation'],
  ['Dummy decline flow', "result==='declined'"],
  ['Dummy timeout flow', "result==='unknown'"],
  ['Cash on delivery unpaid status', 'Confirmed · collect on delivery'],
  ['Order history screen', 'function orders()'],
  ['Provisional bill save', 'function saveProvisionalBill()'],
  ['Provisional bill resume', 'function resumeBill(id)'],
  ['Receipt printing', 'function printDemoReceipt()'],
  ['Orders export', 'function downloadOrders()'],
  ['Dummy payment disclaimer', 'No card, UPI or bank connection']
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
