import 'server-only';

import { ApiError, assertSameOrigin } from './auth';
import { getBackendConfigurationState } from './system';

export async function assertInitialSetupOpen(request: Request) {
  await assertSameOrigin(request);
  if (process.env.ALLOW_REMOTE_SETUP !== 'yes') {
    throw new ApiError(
      403,
      'Setup through the web application is disabled. Set ALLOW_REMOTE_SETUP=yes temporarily to opt in.'
    );
  }
  const configured = await getBackendConfigurationState();
  if (configured === true) {
    throw new ApiError(409, 'Initial setup is complete. Continue from Settings.');
  }
  if (configured === null) {
    throw new ApiError(
      503,
      'Tagvico could not confirm the initial setup state. Try again after the health check succeeds.'
    );
  }
}
