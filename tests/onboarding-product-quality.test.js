const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (relativePath) => fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');

test('first-run setup verifies both dependencies and resumes without browser-stored secrets', () => {
  const wizard = read('src/components/settings/setup-wizard.tsx');
  assert.match(wizard, /fetch\('\/api\/paperless\/probe'/);
  assert.match(wizard, /fetch\('\/api\/setup\/v3\/provider-probe'/);
  assert.match(wizard, /fetch\('\/api\/setup\/v3\/codex\/login'/);
  assert.match(wizard, /ChatGPT account/);
  assert.match(wizard, /const updateProviderValue/);
  assert.match(wizard, /Connection details changed\. Check the runtime again/);
  const providerInvalidation = wizard.slice(
    wizard.indexOf('const updateProviderValue'),
    wizard.indexOf('const checkPaperless')
  );
  assert.match(providerInvalidation, /setModels\(\[\]\)/);
  assert.match(providerInvalidation, /setVerifiedModelId\(''\)/);
  assert.match(providerInvalidation, /modelId: ''/);
  assert.match(wizard, /validatedModelId/);
  assert.match(wizard, /Model ID/);
  assert.match(wizard, /minimal chat request/);
  assert.doesNotMatch(wizard, /discovered\[0\]\.id/);
  assert.match(wizard, /Restored non-secret fields for this tab/);
  assert.match(wizard, /Object\.entries\(state\.providerValues\)\.filter/);

  const storedDraft = wizard.match(/sessionStorage\.setItem\(DRAFT_KEY, JSON\.stringify\(\{([\s\S]*?)\}\)\);/)?.[1] || '';
  assert.doesNotMatch(storedDraft, /paperlessToken/);
  assert.doesNotMatch(storedDraft, /\bpassword\b/);
  assert.doesNotMatch(storedDraft, /confirmPassword/);
  assert.match(storedDraft, /providerValues: publicProviderValues/);
});

test('provider probe validates the selected model and supports catalog-less compatible runtimes', () => {
  const route = read('src/app/api/setup/v3/provider-probe/route.ts');
  const validation = read('services/providerSetupValidation.ts');
  const setupService = read('services/setupService.ts');
  const setupRoutes = read('routes/setup.ts');
  const acceptance = read('scripts/release-acceptance.mjs');
  const fixture = read('tests/fixtures/release-mock-server.mjs');

  assert.match(route, /modelId: z\.string\(\)\.trim\(\)\.min\(1\)\.max\(200\)\.optional\(\)/);
  assert.match(route, /validateProviderSetupModel\(input\.instanceId, values, input\.modelId\)/);
  assert.match(route, /capabilities: \['chat'\]/);
  assert.match(route, /validatedModelId/);
  assert.match(validation, /validateCustomConfig\(values\.baseUrl, values\.apiKey, model\)/);
  assert.match(validation, /validateOpenAIConfig\(values\.apiKey, model\)/);
  assert.match(setupService, /selectedModel \|\| process\.env\.OPENAI_MODEL/);
  assert.match(setupRoutes, /validateOpenAIConfig\(\s*providerConfig\.openaiApiKey,\s*providerConfig\.selectedModel/);
  assert.match(acceptance, /selectedProviderProbe\.body\.validatedModelId/);
  assert.match(acceptance, /cataloglessProviderProbe\.body\.validatedModelId/);
  assert.match(fixture, /\/catalogless\/chat\/completions/);
});

test('new setup starts in review mode with scheduled scans paused', () => {
  const setupRoute = read('src/app/api/setup/v3/route.ts');
  assert.match(setupRoute, /disableAutomaticProcessing: true/);
  assert.match(setupRoute, /write_mode: 'review'/);
});

test('first success opens Ask Tagvico and research sources link to document views', () => {
  const login = read('src/components/login-form.tsx');
  const companion = read('src/components/companion.tsx');
  const documentSource = read('src/app/(app)/documents/[id]/page.tsx');
  assert.match(login, /firstRun \? '\/companion\?welcome=1' : '\/actions'/);
  assert.match(companion, /href=\{`\/documents\/\$\{document\.id\}`\}/);
  assert.match(companion, /Your connections are ready\. Ask a read-only question/);
  assert.match(companion, /Tagvico will wait for approval before changing anything/);
  assert.match(documentSource, /requireUser\(\)/);
  assert.match(documentSource, /getPaperlessDocument/);
  assert.match(documentSource, /notFound\(\)/);
  assert.match(documentSource, /This view is read-only/);
});

test('mobile settings navigation scrolls internally without widening the page', () => {
  const styles = read('src/app/globals.css');
  const mobileSettings = styles.slice(styles.lastIndexOf('@media (max-width: 820px)'));
  assert.match(mobileSettings, /\.settings-nav\s*\{[\s\S]*overflow-x:\s*auto/);
  assert.match(mobileSettings, /max-width:\s*100%/);
  assert.match(mobileSettings, /margin-right:\s*0/);
});

test('Companion relative dates hydrate from one server timestamp and advance after mount', () => {
  const page = read('src/app/(app)/companion/page.tsx');
  const companion = read('src/components/companion.tsx');
  assert.match(page, /renderedAt=\{Date\.now\(\)\}/);
  assert.match(companion, /useState\(renderedAt\)/);
  assert.match(companion, /setInterval\(\(\) => setReferenceTime\(Date\.now\(\)\), 60_000\)/);
  assert.match(companion, /relativeDate\(session\.updated_at,\s*referenceTime\)/);
  assert.match(companion, /Intl\.RelativeTimeFormat\('en'/);
  assert.match(companion, /value\.replace\(' ', 'T'\).*Z/);
  assert.doesNotMatch(companion, /timestamp - Date\.now\(\)/);
});

test('subscription sign-in routes are limited to the open initial setup window', () => {
  const start = read('src/app/api/setup/v3/codex/login/route.ts');
  const poll = read('src/app/api/setup/v3/codex/login/[id]/route.ts');
  const cancel = read('src/app/api/setup/v3/codex/login/[id]/cancel/route.ts');
  const guard = read('src/lib/server/initial-setup.ts');
  for (const route of [start, poll, cancel]) {
    assert.match(route, /assertInitialSetupOpen\(request\)/);
    assert.doesNotMatch(route, /requireApiUser/);
  }
  assert.match(guard, /assertSameOrigin\(request\)/);
  assert.match(guard, /ALLOW_REMOTE_SETUP !== 'yes'/);
  assert.match(guard, /getBackendConfigurationState/);
  assert.match(guard, /Initial setup is complete/);
});

test('Docker release fixture keeps the mock document IDs used by acceptance', () => {
  const compose = read('docker-compose.e2e.yml');
  const fixture = read('tests/fixtures/release-mock-server.mjs');
  const acceptance = read('scripts/release-acceptance.mjs');
  assert.doesNotMatch(compose, /RELEASE_(?:ACTION_)?DOCUMENT_ID/);
  assert.match(fixture, /RELEASE_DOCUMENT_ID \|\| 42/);
  assert.match(fixture, /RELEASE_ACTION_DOCUMENT_ID \|\| 43/);
  assert.match(acceptance, /doc:42/);
  assert.match(acceptance, /for \(const documentId of \[42, 43\]\)/);
});

test('manual Paperless option failures return a retryable response instead of rejecting the route', () => {
  const routes = read('routes/setup.ts');
  const handler = routes.slice(
    routes.indexOf("router.get('/manual/options'"),
    routes.indexOf('/manual/tags:')
  );
  assert.match(handler, /try\s*\{/);
  assert.match(handler, /catch \(error\)/);
  assert.match(handler, /res\.status\(502\)\.json/);
  assert.match(handler, /Check the connection and retry/);
});

test('landing metrics stay separate, anonymous and privacy-signal aware', () => {
  const landing = read('docs/index.html');
  assert.match(landing, /Requests, not unique people/);
  assert.match(landing, /credentials: "omit"/);
  assert.match(landing, /referrerPolicy: "no-referrer"/);
  assert.match(landing, /navigator\.globalPrivacyControl !== true/);
  assert.match(landing, /navigator\.doNotTrack !== "1"/);
  assert.doesNotMatch(landing, /localStorage\./);
});

test('public metrics receiver rejects foreign origins and suppresses small installation counts', async () => {
  const source = read('telemetry/worker.js');
  const moduleUrl = `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
  const worker = (await import(moduleUrl)).default;
  const statements = [];
  const db = {
    prepare(sql) {
      statements.push(sql);
      return {
        bind() { return this; },
        async run() { return { success: true }; }
      };
    },
    async batch() {
      return [
        { results: [{ value: 91 }] },
        { results: [{ value: 3 }] }
      ];
    }
  };
  const env = { DB: db, PUBLIC_ORIGIN: 'https://tagvico.example' };

  const rejected = await worker.fetch(new Request('https://metrics.example/v1/pageview', {
    method: 'POST',
    headers: { origin: 'https://other.example' }
  }), env);
  assert.equal(rejected.status, 403);

  const accepted = await worker.fetch(new Request('https://metrics.example/v1/pageview', {
    method: 'POST',
    headers: { origin: env.PUBLIC_ORIGIN }
  }), env);
  assert.equal(accepted.status, 202);
  assert.ok(statements.some((sql) => sql.includes('landing_pageviews')));

  const summary = await worker.fetch(new Request('https://metrics.example/v1/public-summary', {
    headers: { origin: env.PUBLIC_ORIGIN }
  }), env);
  const body = await summary.json();
  assert.equal(body.landing_pageviews.value, 91);
  assert.equal(body.opted_in_active_installations.value, null);
  assert.equal(body.opted_in_active_installations.publication, 'below_threshold');
  assert.equal(body.opted_in_active_installations.threshold, 5);
  assert.equal(summary.headers.get('access-control-allow-origin'), env.PUBLIC_ORIGIN);
});
