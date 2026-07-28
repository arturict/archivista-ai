const ALLOWED_BUCKETS = {
  documents_processed: new Set(['0', '1-10', '11-100', '101-1000', '1000+']),
  write_mode: new Set(['review', 'automatic']),
  provider_category: new Set(['local', 'hosted', 'custom'])
};

function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...headers }
  });
}

function publicOrigin(env) {
  return env.PUBLIC_ORIGIN || 'https://tagvico.arturf.ch';
}

function websiteHeaders(request, env) {
  const origin = request.headers.get('origin');
  if (origin !== publicOrigin(env)) return null;
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
    'vary': 'Origin'
  };
}

function publicCount(value) {
  const count = Number(value) || 0;
  return count >= 5
    ? { value: count, publication: 'exact' }
    : { value: null, publication: 'below_threshold', threshold: 5 };
}

function validId(value) {
  return typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
}

function validate(payload) {
  if (!payload || payload.schema !== 1 || !validId(payload.daily_id) || !validId(payload.monthly_id)) return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(payload.period?.day || '') || !/^\d{4}-\d{2}$/.test(payload.period?.month || '')) return false;
  if (!/^[0-9A-Za-z.+_-]{1,40}$/.test(payload.version || '')) return false;
  return Object.entries(ALLOWED_BUCKETS).every(([key, values]) => values.has(payload[key]));
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS' && (url.pathname === '/v1/pageview' || url.pathname === '/v1/public-summary')) {
      const headers = websiteHeaders(request, env);
      return headers ? new Response(null, { status: 204, headers }) : json({ error: 'origin_not_allowed' }, 403);
    }

    if (request.method === 'POST' && url.pathname === '/v1/pageview') {
      const headers = websiteHeaders(request, env);
      if (!headers) return json({ error: 'origin_not_allowed' }, 403);
      await env.DB.prepare(`
        INSERT INTO landing_pageviews (day, views, received_at)
        VALUES (date('now'), 1, unixepoch())
        ON CONFLICT(day) DO UPDATE SET
          views=landing_pageviews.views + 1,
          received_at=excluded.received_at
      `).run();
      return json({ accepted: true }, 202, headers);
    }

    if (request.method === 'GET' && url.pathname === '/v1/public-summary') {
      const headers = websiteHeaders(request, env);
      if (!headers) return json({ error: 'origin_not_allowed' }, 403);
      const [pageviews, activeInstallations] = await env.DB.batch([
        env.DB.prepare("SELECT COALESCE(SUM(views), 0) AS value FROM landing_pageviews WHERE day >= date('now', '-29 days')"),
        env.DB.prepare("SELECT COUNT(DISTINCT monthly_id) AS value FROM heartbeats WHERE month = strftime('%Y-%m','now')")
      ]);
      return json({
        landing_pageviews: {
          value: Number(pageviews.results[0]?.value) || 0,
          window_days: 30,
          note: 'Page views are requests, not unique people.'
        },
        opted_in_active_installations: {
          ...publicCount(activeInstallations.results[0]?.value),
          period: 'current_month',
          note: 'Only installations with anonymous analytics enabled are counted.'
        },
        generated_at: new Date().toISOString()
      }, 200, {
        ...headers,
        'cache-control': 'public, max-age=900'
      });
    }

    if (request.method === 'POST' && url.pathname === '/v1/heartbeat') {
      let payload;
      try { payload = await request.json(); } catch { return json({ error: 'invalid_json' }, 400); }
      if (!validate(payload)) return json({ error: 'invalid_payload' }, 400);
      const f = payload.features || {};
      await env.DB.prepare(`
        INSERT INTO heartbeats
          (monthly_id, daily_id, day, month, version, documents_processed, write_mode,
           provider_category, ocr_rescue, custom_fields, controlled_tags, received_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, unixepoch())
        ON CONFLICT(daily_id) DO UPDATE SET
          version=excluded.version,
          documents_processed=excluded.documents_processed, write_mode=excluded.write_mode,
          provider_category=excluded.provider_category, ocr_rescue=excluded.ocr_rescue,
          custom_fields=excluded.custom_fields, controlled_tags=excluded.controlled_tags,
          received_at=excluded.received_at
      `).bind(
        payload.monthly_id, payload.daily_id, payload.period.day, payload.period.month, payload.version,
        payload.documents_processed, payload.write_mode, payload.provider_category,
        f.ocr_rescue ? 1 : 0, f.custom_fields ? 1 : 0, f.controlled_tags ? 1 : 0
      ).run();
      return json({ accepted: true }, 202);
    }

    if (request.method === 'GET' && url.pathname === '/v1/summary') {
      if (!env.ADMIN_TOKEN || request.headers.get('authorization') !== `Bearer ${env.ADMIN_TOKEN}`) return json({ error: 'unauthorized' }, 401);
      const [activeDay, activeMonth, versions, volume, modes, providers, features] = await env.DB.batch([
        env.DB.prepare("SELECT COUNT(DISTINCT daily_id) AS value FROM heartbeats WHERE day = date('now')"),
        env.DB.prepare("SELECT COUNT(DISTINCT monthly_id) AS value FROM heartbeats WHERE month = strftime('%Y-%m','now')"),
        env.DB.prepare("SELECT version, COUNT(DISTINCT monthly_id) AS installations FROM heartbeats WHERE month = strftime('%Y-%m','now') GROUP BY version ORDER BY installations DESC"),
        env.DB.prepare("SELECT documents_processed AS bucket, COUNT(DISTINCT monthly_id) AS installations FROM heartbeats WHERE month = strftime('%Y-%m','now') GROUP BY documents_processed"),
        env.DB.prepare("SELECT write_mode AS mode, COUNT(DISTINCT monthly_id) AS installations FROM heartbeats WHERE month = strftime('%Y-%m','now') GROUP BY write_mode"),
        env.DB.prepare("SELECT provider_category AS category, COUNT(DISTINCT monthly_id) AS installations FROM heartbeats WHERE month = strftime('%Y-%m','now') GROUP BY provider_category"),
        env.DB.prepare("SELECT SUM(ocr_rescue) AS ocr_rescue, SUM(custom_fields) AS custom_fields, SUM(controlled_tags) AS controlled_tags FROM (SELECT monthly_id, MAX(ocr_rescue) AS ocr_rescue, MAX(custom_fields) AS custom_fields, MAX(controlled_tags) AS controlled_tags FROM heartbeats WHERE month = strftime('%Y-%m','now') GROUP BY monthly_id)")
      ]);
      return json({
        active_installations: { day: activeDay.results[0]?.value || 0, month: activeMonth.results[0]?.value || 0 },
        versions: versions.results,
        documents_processed: volume.results,
        write_modes: modes.results,
        provider_categories: providers.results,
        feature_adoption: features.results[0] || {},
        note: 'Counts include opted-in installations only.'
      });
    }
    return json({ error: 'not_found' }, 404);
  },

  async scheduled(_event, env) {
    await env.DB.batch([
      env.DB.prepare("DELETE FROM heartbeats WHERE received_at < unixepoch() - 5356800"),
      env.DB.prepare("DELETE FROM landing_pageviews WHERE received_at < unixepoch() - 8035200")
    ]);
  }
};
