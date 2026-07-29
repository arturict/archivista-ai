'use strict';

const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const { EventEmitter } = require('node:events');
const test = require('node:test');

test('abandoned Codex device login expires server-side and permits a fresh challenge', async (t) => {
  const originalSpawn = childProcess.spawn;
  const originalTimeout = process.env.CODEX_LOGIN_TIMEOUT_MS;
  const killed = [];

  process.env.CODEX_LOGIN_TIMEOUT_MS = '50';
  childProcess.spawn = () => {
    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.kill = (signal) => {
      killed.push(signal);
      child.emit('exit', null, signal);
      return true;
    };
    return child;
  };

  const servicePath = require.resolve('../dist/services/codexAuthService');
  delete require.cache[servicePath];
  const service = require(servicePath);
  t.after(async () => {
    const active = await service.login('chatgptDeviceCode');
    await service.cancel(active.loginId);
    childProcess.spawn = originalSpawn;
    if (originalTimeout === undefined) delete process.env.CODEX_LOGIN_TIMEOUT_MS;
    else process.env.CODEX_LOGIN_TIMEOUT_MS = originalTimeout;
    delete require.cache[servicePath];
  });

  const first = await service.login('chatgptDeviceCode');
  await new Promise((resolve) => setTimeout(resolve, 100));

  assert.deepEqual(service.loginStatus(first.loginId), {
    loginId: first.loginId,
    completed: true,
    cancelled: true,
    output: '',
    error: 'ChatGPT device sign-in expired. Start a new sign-in.',
    startedAt: first.startedAt
  });
  assert.deepEqual(killed, ['SIGTERM']);

  const second = await service.login('chatgptDeviceCode');
  assert.notEqual(second.loginId, first.loginId);
  assert.equal(second.completed, false);
});
