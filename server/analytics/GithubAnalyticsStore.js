const ALLOWED_EVENTS = new Set([
  'STORE_VIEW',
  'PACKAGE_CLICK',
  'PAYMENT_METHOD_SELECTED',
  'PURCHASE_INTENT',
  'PURCHASE_CANCELLED'
]);

const PACKAGE_IDS = new Set(['starter', 'popular', 'pro', 'king']);
const PAYMENT_IDS = new Set(['vodafone_cash', 'instapay']);

function emptyData() {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    totals: {
      STORE_VIEW: 0,
      PACKAGE_CLICK: 0,
      PAYMENT_METHOD_SELECTED: 0,
      PURCHASE_INTENT: 0,
      PURCHASE_CANCELLED: 0
    },
    packages: { starter: 0, popular: 0, pro: 0, king: 0 },
    payments: { vodafone_cash: 0, instapay: 0 },
    uniqueVisitorIds: [],
    lastEvents: []
  };
}

function safeString(value, max = 80) {
  return String(value ?? '').trim().slice(0, max);
}

function mergeShape(input) {
  const base = emptyData();
  if (!input || typeof input !== 'object') return base;
  base.updatedAt = input.updatedAt || base.updatedAt;
  for (const key of Object.keys(base.totals)) base.totals[key] = Number(input.totals?.[key] || 0);
  for (const key of Object.keys(base.packages)) base.packages[key] = Number(input.packages?.[key] || 0);
  for (const key of Object.keys(base.payments)) base.payments[key] = Number(input.payments?.[key] || 0);
  base.uniqueVisitorIds = Array.isArray(input.uniqueVisitorIds) ? input.uniqueVisitorIds.map(item => safeString(item, 80)).filter(Boolean).slice(-5000) : [];
  base.lastEvents = Array.isArray(input.lastEvents) ? input.lastEvents.slice(-200) : [];
  return base;
}

export class GithubAnalyticsStore {
  constructor(env = process.env) {
    this.token = safeString(env.GITHUB_TOKEN, 500);
    this.branch = safeString(env.GITHUB_BRANCH || 'main', 120);
    this.path = safeString(env.GITHUB_DATA_PATH || 'data/analytics.json', 300);
    this.owner = safeString(env.GITHUB_OWNER, 120);
    this.repo = safeString(env.GITHUB_REPO, 120);
    this.apiUrl = safeString(env.GITHUB_ANALYTICS_API_URL, 600) || (
      this.owner && this.repo
        ? `https://api.github.com/repos/${encodeURIComponent(this.owner)}/${encodeURIComponent(this.repo)}/contents/${this.path.split('/').map(encodeURIComponent).join('/')}`
        : ''
    );
    this.flushMs = Math.max(15_000, Number(env.ANALYTICS_FLUSH_MS || 45_000));
    this.data = emptyData();
    this.sha = null;
    this.loaded = false;
    this.dirty = false;
    this.pending = [];
    this.unflushedEvents = [];
    this.writeQueue = Promise.resolve();
    this.timer = null;
  }

  get persistenceMode() {
    return this.apiUrl && this.token ? 'github' : 'memory';
  }

  async init() {
    if (this.persistenceMode === 'github') {
      try {
        await this.#loadRemote();
      } catch (error) {
        console.warn('[ANALYTICS] GitHub load failed, using memory until next flush:', error.message);
      }
    }
    this.loaded = true;
    if (this.pending.length) {
      const queued = this.pending.splice(0);
      queued.forEach(event => this.#apply(event));
    }
    this.timer = setInterval(() => this.flush().catch(error => {
      console.warn('[ANALYTICS] Flush failed:', error.message);
    }), this.flushMs);
    this.timer.unref?.();
    console.log(`[ANALYTICS] persistence=${this.persistenceMode}`);
  }

  record(raw = {}) {
    const event = safeString(raw.event, 60).toUpperCase();
    if (!ALLOWED_EVENTS.has(event)) return false;
    const entry = {
      event,
      visitorId: safeString(raw.visitorId, 80),
      sessionId: safeString(raw.sessionId, 80),
      packageId: PACKAGE_IDS.has(raw.packageId) ? raw.packageId : null,
      paymentMethod: PAYMENT_IDS.has(raw.paymentMethod) ? raw.paymentMethod : null,
      points: Number.isFinite(Number(raw.points)) ? Number(raw.points) : null,
      price: Number.isFinite(Number(raw.price)) ? Number(raw.price) : null,
      at: new Date().toISOString()
    };
    if (!this.loaded) this.pending.push(entry);
    else this.#apply(entry);
    return true;
  }

  summary() {
    const storeViews = this.data.totals.STORE_VIEW || 0;
    const intents = this.data.totals.PURCHASE_INTENT || 0;
    return {
      persistence: this.persistenceMode,
      updatedAt: this.data.updatedAt,
      uniqueVisitors: this.data.uniqueVisitorIds.length,
      totals: { ...this.data.totals },
      packages: { ...this.data.packages },
      payments: { ...this.data.payments },
      purchaseIntentConversion: storeViews ? Number(((intents / storeViews) * 100).toFixed(1)) : 0,
      lastEvents: this.data.lastEvents.slice(-30).reverse()
    };
  }

  async flush() {
    if (!this.dirty || this.persistenceMode !== 'github') return false;
    this.writeQueue = this.writeQueue.then(() => this.#flushOnce(), () => this.#flushOnce());
    return this.writeQueue;
  }

  async close() {
    clearInterval(this.timer);
    if (this.dirty) {
      try { await this.flush(); } catch {}
    }
  }

  #apply(entry, { track = true } = {}) {
    if (track) this.unflushedEvents.push(entry);
    this.data.totals[entry.event] = (this.data.totals[entry.event] || 0) + 1;
    if (entry.event === 'PACKAGE_CLICK' && entry.packageId) this.data.packages[entry.packageId] += 1;
    if (entry.event === 'PAYMENT_METHOD_SELECTED' && entry.paymentMethod) this.data.payments[entry.paymentMethod] += 1;
    if (entry.visitorId && !this.data.uniqueVisitorIds.includes(entry.visitorId)) {
      this.data.uniqueVisitorIds.push(entry.visitorId);
      if (this.data.uniqueVisitorIds.length > 5000) this.data.uniqueVisitorIds.splice(0, this.data.uniqueVisitorIds.length - 5000);
    }
    this.data.lastEvents.push(entry);
    if (this.data.lastEvents.length > 200) this.data.lastEvents.splice(0, this.data.lastEvents.length - 200);
    this.data.updatedAt = new Date().toISOString();
    this.dirty = true;
  }

  async #loadRemote() {
    const response = await fetch(`${this.apiUrl}?ref=${encodeURIComponent(this.branch)}`, {
      headers: this.#headers()
    });
    if (response.status === 404) {
      this.data = emptyData();
      this.sha = null;
      return;
    }
    if (!response.ok) throw new Error(`GitHub GET ${response.status}`);
    const payload = await response.json();
    this.sha = payload.sha || null;
    const decoded = Buffer.from(payload.content || '', 'base64').toString('utf8');
    this.data = mergeShape(JSON.parse(decoded || '{}'));
  }

  async #flushOnce(retry = true) {
    if (!this.dirty) return false;
    const body = {
      message: `Update Ludo points analytics ${new Date().toISOString()}`,
      content: Buffer.from(`${JSON.stringify(this.data, null, 2)}\n`, 'utf8').toString('base64'),
      branch: this.branch
    };
    if (this.sha) body.sha = this.sha;

    const response = await fetch(this.apiUrl, {
      method: 'PUT',
      headers: { ...this.#headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if ((response.status === 409 || response.status === 422) && retry) {
      const latest = await fetch(`${this.apiUrl}?ref=${encodeURIComponent(this.branch)}`, { headers: this.#headers() });
      if (latest.ok) {
        const latestPayload = await latest.json();
        this.sha = latestPayload.sha || this.sha;
        const decoded = Buffer.from(latestPayload.content || '', 'base64').toString('utf8');
        this.data = mergeShape(JSON.parse(decoded || '{}'));
        for (const event of this.unflushedEvents) this.#apply(event, { track: false });
        return this.#flushOnce(false);
      }
    }
    if (!response.ok) throw new Error(`GitHub PUT ${response.status}`);
    const payload = await response.json();
    this.sha = payload.content?.sha || this.sha;
    this.dirty = false;
    this.unflushedEvents = [];
    return true;
  }

  #headers() {
    return {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${this.token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'ludo-3d-analytics'
    };
  }
}
