'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const axios = require('axios');
const setupService = require('../dist/services/setupService');

test('Ollama setup accepts only a verified tool call from the selected model', async (t) => {
  const originalPost = axios.post;
  t.after(() => {
    axios.post = originalPost;
  });

  let captured;
  axios.post = async (...args) => {
    captured = args;
    return {
      data: {
        message: {
          tool_calls: [{
            function: {
              name: 'confirm_tagvico_tool_support',
              arguments: { supported: true }
            }
          }]
        }
      }
    };
  };

  assert.equal(
    await setupService.validateOllamaConfig(
      'https://ollama.example/',
      'qwen3.5:9b',
      'cloud-token'
    ),
    true
  );
  assert.equal(captured[0], 'https://ollama.example/api/chat');
  assert.equal(captured[1].model, 'qwen3.5:9b');
  assert.equal(captured[1].tools[0].function.name, 'confirm_tagvico_tool_support');
  assert.equal(captured[1].stream, false);
  assert.equal(captured[2].timeout, 15_000);
  assert.equal(captured[2].headers.Authorization, 'Bearer cloud-token');

  axios.post = async () => ({
    data: {
      message: {
        tool_calls: [{
          function: {
            name: 'confirm_tagvico_tool_support',
            arguments: { supported: false }
          }
        }]
      }
    }
  });
  assert.equal(
    await setupService.validateOllamaConfig('http://ollama.internal:11434', 'broken-tools'),
    false
  );
});
