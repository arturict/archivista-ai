const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createServer } = require('node:http');

const json = (response, status, value) => {
  response.writeHead(status, { 'content-type': 'application/json' });
  response.end(JSON.stringify(value));
};

const readBody = async (request) => {
  let body = '';
  for await (const chunk of request) body += chunk;
  return body ? JSON.parse(body) : {};
};

test('action sync retries local writes, isolates member credentials, and redacts audit snapshots', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tagvico-action-sync-'));
  const customFields = new Map();
  const tags = new Map();
  let nextResourceId = 100;
  let patchRequests = 0;
  let document = { id: 42, title: 'Original title', content: 'private OCR must not enter the approval audit', custom_fields: [], tags: [] };

  const server = createServer(async (request, response) => {
    const url = new URL(request.url, 'http://127.0.0.1');
    const tagDetail = url.pathname.match(/^\/api\/tags\/(\d+)\/$/);
    if (tagDetail) {
      const tagId = Number(tagDetail[1]);
      const entry = [...tags.values()].find((tag) => tag.id === tagId);
      if (!entry) return json(response, 404, { error: 'not found' });
      if (request.method === 'GET') return json(response, 200, entry);
      if (request.method === 'PATCH') {
        const patch = await readBody(request);
        const updated = { ...entry, ...patch };
        tags.delete(entry.name);
        tags.set(updated.name, updated);
        return json(response, 200, updated);
      }
      if (request.method === 'DELETE') {
        tags.delete(entry.name);
        response.writeHead(204);
        return response.end();
      }
    }
    const resource = url.pathname === '/api/custom_fields/' ? customFields : url.pathname === '/api/tags/' ? tags : null;
    if (resource && request.method === 'GET') {
      const exact = url.searchParams.get('name__iexact');
      const contains = url.searchParams.get('name__icontains')?.toLowerCase();
      const results = exact
        ? [resource.get(exact)].filter(Boolean)
        : [...resource.values()].filter((entry) => !contains || entry.name.toLowerCase().includes(contains));
      return json(response, 200, { count: results.length, results });
    }
    if (resource && request.method === 'POST') {
      const body = await readBody(request);
      const created = { id: nextResourceId++, name: body.name, color: body.color || '#ffffff', text_color: body.text_color || '#000000', document_count: 0 };
      resource.set(body.name, created);
      return json(response, 201, created);
    }
    if (url.pathname === '/api/documents/42/' && request.method === 'GET') return json(response, 200, document);
    if (url.pathname === '/api/documents/42/' && request.method === 'PATCH') {
      patchRequests += 1;
      document = { ...document, ...(await readBody(request)) };
      return json(response, 200, document);
    }
    if (url.pathname === '/api/documents/' && request.method === 'GET') {
      return json(response, 200, {
        count: 2,
        results: [
          { id: 43, title: 'Newest document', created: '2030-01-02' },
          { id: 42, title: document.title, created: '2030-01-01' }
        ].slice(0, Number(url.searchParams.get('page_size') || 2))
      });
    }
    return json(response, 404, { error: 'not found' });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

  try {
    const address = server.address();
    assert.ok(address && typeof address === 'object');
    process.env.TAGVICO_DATA_DIR = dataDir;
    process.env.JWT_SECRET = 'test-secret-that-is-long-enough-for-action-sync';
    delete process.env.PAPERLESS_API_URL;
    delete process.env.PAPERLESS_API_TOKEN;

    const documentModel = require('../dist/models/document');
    const actions = require('../dist/models/actionCenter');
    const sync = require('../dist/services/actionSyncService');
    // Setup and the Next application run in separate processes. Initial setup
    // therefore writes the shared .env after Action Sync has already loaded;
    // the application process must observe that saved configuration without a
    // restart or a process.env mutation.
    fs.writeFileSync(path.join(dataDir, '.env'), [
      `PAPERLESS_API_URL=http://127.0.0.1:${address.port}/api`,
      'PAPERLESS_API_TOKEN=owner-admin-token'
    ].join('\n'));
    const db = documentModel.getDatabase();
    const userId = Number(db.prepare('INSERT INTO users (username, password) VALUES (?, ?)').run('owner', 'hash').lastInsertRowid);
    const workspace = actions.ensureWorkspaceForUser(userId, 'owner');
    const managedMember = actions.addHouseholdMember(workspace.id, 'Member', 'member');
    await assert.rejects(() => sync.searchPaperlessDocuments(workspace.id, managedMember.id, 'invoice'), /personal Paperless token/);
    assert.deepEqual(await sync.countPaperlessDocuments(workspace.id, workspace.member_id), { count: 2 });
    assert.deepEqual(await sync.listRecentPaperlessDocuments(workspace.id, workspace.member_id, 1), [
      { id: 43, title: 'Newest document', created: '2030-01-02' }
    ]);

    const created = actions.createCase(workspace.id, workspace.member_id, { paperlessDocumentId: 42, title: 'Pay invoice', dueAt: '2030-01-01' });
    const first = await sync.reconcileAllCases();
    assert.deepEqual(first, { checked: 1, changed: 1, failed: 0 });
    assert.equal(patchRequests, 1, 'pending local state must push instead of pulling stale Paperless fields');
    assert.equal(actions.getCase(workspace.id, created.id).syncStatus, 'synced');

    actions.updateCase(workspace.id, created.id, workspace.member_id, { title: 'Pay corrected invoice' });
    patchRequests = 0;
    const [left, right] = await Promise.all([sync.reconcileAllCases(), sync.reconcileAllCases()]);
    assert.deepEqual(left, right);
    assert.equal(patchRequests, 1, 'overlapping cron ticks must share one reconciliation');

    const audited = await sync.patchPaperlessDocument(workspace.id, workspace.member_id, 42, { title: 'Final title' });
    assert.deepEqual(audited.before, { title: 'Original title' });
    assert.deepEqual(audited.after, { title: 'Final title' });
    assert.equal(JSON.stringify(audited).includes('private OCR'), false);
    const createdTag = await sync.createPaperlessTag(workspace.id, workspace.member_id, {
      name: 'Needs review',
      color: '#193c2c',
      textColor: '#ffffff'
    });
    assert.equal(createdTag.tag.name, 'Needs review');
    const listedTags = await sync.listPaperlessTags(workspace.id, workspace.member_id, 'review', 20);
    assert.equal(listedTags.some((item) => item.name === 'Needs review'), true);
    const updatedTag = await sync.updatePaperlessTag(workspace.id, workspace.member_id, createdTag.tag.id, {
      name: 'Reviewed'
    });
    assert.equal(updatedTag.after.name, 'Reviewed');
    const deletedTag = await sync.deletePaperlessTag(workspace.id, workspace.member_id, createdTag.tag.id);
    assert.equal(deletedTag.deleted.name, 'Reviewed');
    await documentModel.closeDatabase();
  } finally {
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});
