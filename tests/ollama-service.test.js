const test = require('node:test');
const assert = require('node:assert/strict');

const ollamaService = require('../dist/services/ollamaService');

test('structured Ollama analysis disables thinking so JSON is returned in response', async () => {
  let capturedBody = null;
  const originalClient = ollamaService.client;
  const originalRefreshConfig = ollamaService.refreshConfig;
  ollamaService.refreshConfig = () => {};
  ollamaService.client = {
    post: async (_url, body) => {
      capturedBody = body;
      return { data: { response: '{"tags":[]}' } };
    }
  };

  try {
    await ollamaService._callOllamaAPI('prompt', 'system', 4096, {
      type: 'object',
      properties: { tags: { type: 'array', items: { type: 'string' } } }
    });
    assert.equal(capturedBody.think, false);
  } finally {
    ollamaService.client = originalClient;
    ollamaService.refreshConfig = originalRefreshConfig;
  }
});

test('Ollama token counts are preserved for history and review metrics', () => {
  assert.deepEqual(ollamaService._metricsFromOllamaResponse({
    prompt_eval_count: 321,
    eval_count: 45
  }), {
    promptTokens: 321,
    completionTokens: 45,
    totalTokens: 366
  });
  assert.deepEqual(ollamaService._metricsFromOllamaResponse({}), {
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0
  });
});
