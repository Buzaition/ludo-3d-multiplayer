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

test('GitHub analytics persistence loads and writes the JSON contents API', async () => {
  const originalFetch = global.fetch;
  const writes = [];
  const initial = {
    version: 1,
    updatedAt: null,
    totals: { STORE_VIEW:0, PACKAGE_CLICK:0, PAYMENT_METHOD_SELECTED:0, PURCHASE_INTENT:0, PURCHASE_CANCELLED:0 },
    packages: { starter:0, popular:0, pro:0, king:0 },
    payments: { vodafone_cash:0, instapay:0 },
    uniqueVisitorIds: [],
    lastEvents: []
  };
  global.fetch = async (url, options = {}) => {
    if (!options.method || options.method === 'GET') {
      return new Response(JSON.stringify({ sha:'sha-1', content:Buffer.from(JSON.stringify(initial)).toString('base64') }), { status:200, headers:{'content-type':'application/json'} });
    }
    if (options.method === 'PUT') {
      const body = JSON.parse(options.body);
      writes.push(JSON.parse(Buffer.from(body.content, 'base64').toString('utf8')));
      return new Response(JSON.stringify({ content:{ sha:'sha-2' } }), { status:200, headers:{'content-type':'application/json'} });
    }
    return new Response('{}', { status:500 });
  };

  try {
    const store = new GithubAnalyticsStore({
      GITHUB_TOKEN:'test-token', GITHUB_OWNER:'owner', GITHUB_REPO:'analytics',
      GITHUB_BRANCH:'main', GITHUB_DATA_PATH:'data/analytics.json', ANALYTICS_FLUSH_MS:'60000'
    });
    await store.init();
    store.record({ event:'STORE_VIEW', visitorId:'v2', sessionId:'s2' });
    await store.flush();
    assert.equal(writes.length, 1);
    assert.equal(writes[0].totals.STORE_VIEW, 1);
    assert.equal(store.status().lastError, null);
    assert.ok(store.status().lastFlushAt);
    await store.close();
  } finally {
    global.fetch = originalFetch;
  }
});
