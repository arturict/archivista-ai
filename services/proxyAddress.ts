type ProxyAddressInput = { remoteAddress?: string; forwardedFor?: string };

export function isLoopbackAddress(address = '') {
  return address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1';
}

export function allowsInitialSetup(env: NodeJS.ProcessEnv = process.env) {
  return env.ALLOW_REMOTE_SETUP === 'yes' ||
    isLoopbackAddress(String(env.TAGVICO_AI_BIND_ADDRESS || '').trim());
}

/** Public Next-proxied setup is always remote and requires explicit opt-in. */
export function isLocalProxyRequest({ remoteAddress = '', forwardedFor }: ProxyAddressInput) {
  return isLoopbackAddress(remoteAddress) && forwardedFor === undefined;
}
