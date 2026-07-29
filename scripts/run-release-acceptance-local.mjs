import { spawn } from 'node:child_process';

const projectName = process.env.TAGVICO_ACCEPTANCE_PROJECT || 'tagvico-e2e-local';
const composeFile = 'docker-compose.e2e.yml';

const runDocker = (args, { allowFailure = false } = {}) => new Promise((resolve, reject) => {
  const child = spawn('docker', args, {
    cwd: process.cwd(),
    env: process.env,
    stdio: 'inherit',
    windowsHide: true
  });
  child.once('error', reject);
  child.once('exit', (code) => {
    if (code === 0 || allowFailure) resolve(code ?? 1);
    else reject(new Error(`docker ${args.join(' ')} failed with exit code ${code ?? 1}`));
  });
});

const compose = (...args) => runDocker([
  'compose',
  '-p',
  projectName,
  '-f',
  composeFile,
  ...args
]);

try {
  await compose('down', '-v', '--remove-orphans');
  await compose('up', '-d', '--build', '--wait');
  await compose(
    'exec',
    '-T',
    '-e',
    'TAGVICO_ACCEPTANCE_BASE_URL=http://tagvico-ai:3000',
    '-e',
    'TAGVICO_ACCEPTANCE_MOCK_URL=http://release-mock:4010',
    'release-mock',
    'node',
    'scripts/release-acceptance.mjs'
  );
} finally {
  await runDocker([
    'compose',
    '-p',
    projectName,
    '-f',
    composeFile,
    'down',
    '-v',
    '--remove-orphans'
  ], { allowFailure: true });
}
