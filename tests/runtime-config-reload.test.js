'use strict';

const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

test('runtime config reload applies persisted scan settings without a restart', () => {
  const dataDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'tagvico-runtime-config-'));
  const environment = {
    ...process.env,
    TAGVICO_DATA_DIR: dataDirectory
  };
  delete environment.DISABLE_AUTOMATIC_PROCESSING;

  const script = `
    const assert = require('node:assert/strict');
    const fs = require('node:fs');
    const path = require('node:path');
    const envPath = path.join(process.env.TAGVICO_DATA_DIR, '.env');
    fs.writeFileSync(envPath, 'DISABLE_AUTOMATIC_PROCESSING=yes\\nSCAN_INTERVAL=*/30 * * * *\\n');
    const config = require('./dist/config/config');
    const setupService = require('./dist/services/setupService');
    assert.equal(config.disableAutomaticProcessing, 'yes');
    fs.writeFileSync(envPath, 'DISABLE_AUTOMATIC_PROCESSING=no\\nSCAN_INTERVAL=*/5 * * * *\\n');
    setupService.reloadRuntimeConfig();
    assert.equal(process.env.DISABLE_AUTOMATIC_PROCESSING, 'no');
    assert.equal(config.disableAutomaticProcessing, 'no');
    assert.equal(config.scanInterval, '*/5 * * * *');
  `;

  try {
    const result = spawnSync(process.execPath, ['-e', script], {
      cwd: process.cwd(),
      env: environment,
      encoding: 'utf8',
      windowsHide: true
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);
  } finally {
    fs.rmSync(dataDirectory, { recursive: true, force: true });
  }
});
