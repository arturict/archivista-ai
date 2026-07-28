const test = require('node:test');
const assert = require('node:assert/strict');

const telemetry = require('../dist/services/telemetryPrivacy');
const telemetryService = require('../dist/services/telemetryService');

test('telemetry period identifiers rotate and are deterministic within a period', () => {
  const secret = 'local-secret-never-sent';
  assert.equal(telemetry.periodId(secret, 'day:2026-07-11'), telemetry.periodId(secret, 'day:2026-07-11'));
  assert.notEqual(telemetry.periodId(secret, 'day:2026-07-11'), telemetry.periodId(secret, 'day:2026-07-12'));
  assert.notEqual(telemetry.periodId(secret, 'month:2026-07'), telemetry.periodId(secret, 'month:2026-08'));
});

test('provider categories avoid exposing exact hosted providers', () => {
  assert.equal(telemetry.providerCategory('ollama'), 'local');
  assert.equal(telemetry.providerCategory('compatible'), 'custom');
  assert.equal(telemetry.providerCategory('openai'), 'hosted');
  assert.equal(telemetry.providerCategory('anthropic'), 'hosted');
});

test('telemetry scheduling spreads startup and retry heartbeats across bounded windows', () => {
  assert.equal(telemetryService.jitteredDelay(15_000, 45_000, () => 0), 15_000);
  assert.equal(telemetryService.jitteredDelay(15_000, 45_000, () => 0.5), 37_500);
  assert.equal(telemetryService.jitteredDelay(15_000, 45_000, () => 1), 59_999);
});
