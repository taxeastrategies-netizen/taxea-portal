import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const read = relative => fs.readFileSync(path.resolve(relative), 'utf8');
const invoicePublic = read('base44/functions/getPublicInvoice/entry.ts');
const invoiceOperations = read('base44/functions/invoiceOperations/entry.ts');
const stripeWebhook = read('base44/functions/stripeWebhook/entry.ts');
const activation = read('base44/functions/activateUnlimitedUser/entry.ts');
const usersPage = read('src/pages/GestionUsuarios.jsx');

assert.match(invoicePublic, /req\.method !== 'POST'/);
assert.match(invoicePublic, /\^\[a-f0-9\]\{64\}\$/);
assert.match(invoicePublic, /records\.length !== 1/);
assert.match(invoicePublic, /public_token_revoked_at/);
assert.match(invoicePublic, /public_token_expires_at/);
assert.match(invoicePublic, /'Cache-Control': 'no-store, max-age=0'/);
assert.match(invoicePublic, /const publicInvoice = pick\(invoice/);
assert.match(invoicePublic, /const publicCompany = pick\(company/);
assert.doesNotMatch(invoicePublic, /return publicJson\(\{ ok: true, invoice, company \}/);
assert.match(invoiceOperations, /crypto\.getRandomValues\(bytes\)/);
assert.match(invoiceOperations, /\^\[a-f0-9\]\{64\}\$/i);

assert.match(stripeWebhook, /req\.method !== 'POST'/);
assert.match(stripeWebhook, /!STRIPE_SECRET \|\| !WEBHOOK_SECRET/);
assert.match(stripeWebhook, /req\.headers\.get\("stripe-signature"\)/);
assert.match(stripeWebhook, /stripe\.webhooks\.constructEventAsync\(body, signature, WEBHOOK_SECRET\)/);
assert.match(stripeWebhook, /existingEvent\?\.processed === true/);

assert.ok(activation.includes("sub.status === 'paid_pending_activation' && sub.firstPaymentStatus === 'paid'"));
assert.ok(activation.indexOf('if (!pendingPaidSubscription)') < activation.indexOf('admin.entities.User.update(targetUserId'));
assert.ok(activation.includes('Subscription.update(pendingPaidSubscription.id'));
assert.ok(!activation.includes('qaTrial') && !activation.includes('isReccQaTrial'));
assert.ok(!usersPage.includes('qaTrial') && !usersPage.includes('isReccQaTrial'));

console.log(JSON.stringify({
  ok: true,
  assertions: {
    publicInvoiceUsesOpaqueExpiringToken: true,
    publicInvoiceResponseIsAllowlistedAndNoStore: true,
    publicInvoiceOnlyAllowsPost: true,
    stripeRejectsMissingConfigurationAndSignature: true,
    stripeVerifiesRawBodySignature: true,
    stripeRetriesAreIdempotent: true,
    unpaidTrialBypassRemoved: true,
    paidSubscriptionRequiredBeforeActivation: true,
  },
}, null, 2));

