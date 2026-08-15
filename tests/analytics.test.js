import test from 'node:test';
import assert from 'node:assert/strict';
import { GithubAnalyticsStore } from '../server/analytics/GithubAnalyticsStore.js';

test('points validation analytics aggregates funnel, packages and payments in memory', async () => {
  const store = new GithubAnalyticsStore({});
  await store.init();
  store.record({ event:'STORE_VIEW', visitorId:'v1', sessionId:'s1' });
  store.record({ event:'PACKAGE_CLICK', visitorId:'v1', sessionId:'s1', packageId:'popular', points:1200, price:20 });
  store.record({ event:'PAYMENT_METHOD_SELECTED', visitorId:'v1', sessionId:'s1', packageId:'popular', paymentMethod:'vodafone_cash' });
  store.record({ event:'PURCHASE_INTENT', visitorId:'v1', sessionId:'s1', packageId:'popular', paymentMethod:'vodafone_cash' });
  const summary = store.summary();
  assert.equal(summary.persistence, 'memory');
  assert.equal(summary.uniqueVisitors, 1);
  assert.equal(summary.totals.STORE_VIEW, 1);
  assert.equal(summary.totals.PURCHASE_INTENT, 1);
  assert.equal(summary.packages.popular, 1);
  assert.equal(summary.payments.vodafone_cash, 1);
  assert.equal(summary.purchaseIntentConversion, 100);
  await store.close();
});
