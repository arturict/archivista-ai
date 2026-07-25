const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

let harness;

test.before(async () => {
  harness = await import(pathToFileURL(
    path.resolve('scripts', 'ollama-benchmark-harness-lib.mjs')
  ).href);
});

test('benchmark arguments require models and validate bounded repetitions', () => {
  assert.throws(
    () => harness.parseBenchmarkArguments([]),
    /At least one model/
  );
  assert.throws(
    () => harness.parseBenchmarkArguments(['--models', 'tiny', '--repetitions', '0']),
    /between 1 and 20/
  );
  assert.deepEqual(
    harness.parseBenchmarkArguments([
      '--models', 'gemma4:e2b, granite4.1:3b',
      '--base-url', 'http://localhost:11434/',
      '--repetitions', '2',
      '--suite', 'tools'
    ]),
    {
      baseUrl: 'http://localhost:11434',
      models: ['gemma4:e2b', 'granite4.1:3b'],
      repetitions: 2,
      suite: 'tools',
      timeoutMs: 180000,
      outputDir: path.join('.local', 'benchmarks', 'ollama')
    }
  );
});

test('report URL removes credentials, query strings, and fragments', () => {
  assert.equal(
    harness.sanitizeBaseUrlForReport('https://user:secret@ollama.test:11434/?token=nope#private'),
    'https://ollama.test:11434'
  );
  assert.throws(
    () => harness.normalizeBaseUrl('https://user:secret@ollama.test:11434'),
    /Do not put credentials/
  );
});

test('structured scorer measures title, metadata, and exact tag precision', () => {
  const fixture = harness.SYNTHETIC_DOCUMENT_FIXTURES[0];
  const score = harness.scoreStructuredResult(fixture, JSON.stringify({
    title: 'Alpenstrom Energie AG Stromrechnung Juni 2026',
    tags: ['Finance', 'Housing'],
    document_type: 'Invoice',
    correspondent: 'Alpenstrom Energie AG',
    document_date: '2026-06-12',
    language: 'de'
  }));
  assert.equal(score.validJson, true);
  assert.equal(score.titleRelevant, true);
  assert.equal(score.tagRecall, 1);
  assert.equal(score.tagPrecision, 1);
  assert.equal(score.score, 1);

  const invalid = harness.scoreStructuredResult(fixture, 'not-json');
  assert.equal(invalid.validJson, false);
  assert.equal(invalid.score, 0);
});

test('structured scorer does not reward an unrelated allowed tag', () => {
  const fixture = harness.SYNTHETIC_DOCUMENT_FIXTURES[0];
  const score = harness.scoreStructuredResult(fixture, JSON.stringify({
    title: 'Stromrechnung von Alpenstrom Energie AG',
    tags: ['Health'],
    document_type: fixture.documentType,
    correspondent: fixture.correspondent,
    document_date: fixture.documentDate,
    language: fixture.language
  }));
  assert.equal(score.tagRecall, 0);
  assert.equal(score.tagPrecision, 0);
});

test('tool scorer accepts object or encoded arguments and rejects missing fields', () => {
  const fixture = harness.TOOL_CALL_FIXTURES[0];
  const complete = harness.scoreToolResult(fixture, {
    message: {
      tool_calls: [{
        function: {
          name: 'search_documents',
          arguments: '{"query":"Alpenstrom 2026"}'
        }
      }]
    }
  });
  assert.equal(complete.expectedToolCalled, true);
  assert.equal(complete.argumentsValid, true);
  assert.equal(complete.score, 1);

  const incomplete = harness.scoreToolResult(fixture, {
    message: {
      tool_calls: [{
        function: {
          name: 'search_documents',
          arguments: {}
        }
      }]
    }
  });
  assert.deepEqual(incomplete.missingArgumentKeys, ['query']);
  assert.equal(incomplete.score, 0);
});

test('benchmark keeps structured and tool probes separate and writes JSON and Markdown artifacts', async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    const pathname = new URL(url).pathname;
    const body = JSON.parse(options.body);
    calls.push({ pathname, body });
    if (pathname === '/api/show') {
      return new Response(JSON.stringify({
        capabilities: ['completion', 'tools'],
        details: { parameter_size: '2B' },
        model_info: { 'gemma.context_length': 131072 }
      }), { status: 200 });
    }
    if (pathname === '/api/generate') {
      return new Response(JSON.stringify({
        response: JSON.stringify({
          title: 'Synthetic result',
          tags: ['Finance'],
          document_type: 'Invoice',
          correspondent: 'Synthetic sender',
          document_date: '2026-06-12',
          language: 'de'
        }),
        prompt_eval_count: 100,
        eval_count: 20,
        eval_duration: 1_000_000_000,
        total_duration: 1_500_000_000
      }), { status: 200 });
    }
    return new Response(JSON.stringify({
      message: {
        role: 'assistant',
        content: '',
        tool_calls: [{
          function: {
            name: 'search_documents',
            arguments: { query: 'Alpenstrom 2026 Northlake insurance' }
          }
        }]
      },
      prompt_eval_count: 80,
      eval_count: 10,
      eval_duration: 1_000_000_000,
      total_duration: 1_200_000_000
    }), { status: 200 });
  };

  const report = await harness.runBenchmark({
    fetchImpl,
    baseUrl: 'http://localhost:11434',
    models: ['synthetic-model'],
    repetitions: 1,
    suite: 'all',
    timeoutMs: 10_000
  });
  assert.equal(report.models.length, 1);
  assert.equal(report.models[0].probes.length, 18);
  assert.equal(report.models[0].probes.filter((probe) => probe.kind === 'structured').length, 16);
  assert.equal(report.models[0].probes.filter((probe) => probe.kind === 'tools').length, 2);
  assert.equal(report.models[0].modelInfo.capabilities.includes('tools'), true);
  assert.equal(report.models[0].unloadErrors, undefined);
  assert.equal(calls.filter((call) => call.pathname === '/api/show').length, 1);
  assert.equal(calls.filter((call) => call.pathname === '/api/generate').length, 17);
  assert.equal(calls.filter((call) => call.body.keep_alive === 0).length, 1);
  assert.equal(calls.filter((call) => call.pathname === '/api/chat').length, 2);
  assert.ok(calls.filter((call) => call.pathname === '/api/generate' && call.body.keep_alive !== 0)
    .every((call) => call.body.format?.properties?.tags?.maxItems === 4));
  assert.ok(calls.filter((call) => call.pathname === '/api/generate' && call.body.keep_alive !== 0)
    .every((call) => call.body.think === false));

  const temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'tagvico-ollama-benchmark-'));
  try {
    const artifacts = await harness.writeBenchmarkArtifacts({
      report,
      outputDir: temporaryDirectory
    });
    const writtenJson = JSON.parse(await fs.readFile(artifacts.jsonPath, 'utf8'));
    const writtenMarkdown = await fs.readFile(artifacts.markdownPath, 'utf8');
    assert.equal(writtenJson.models[0].model, 'synthetic-model');
    assert.match(writtenMarkdown, /Tagvico Ollama benchmark/);
    assert.match(writtenMarkdown, /synthetic-model/);
  } finally {
    await fs.rm(temporaryDirectory, { recursive: true, force: true });
  }
});
