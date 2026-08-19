'use client';

import { Radar, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { InlineStatus } from './inline-status';

type DiscoveredInstance = {
  url: string;
  ok: boolean;
  status?: number;
  version?: string | null;
  apiVersion?: string | null;
  requiresAuth?: boolean;
};

type PaperlessDiscoveryProps = {
  baseUrl: string;
  /**
   * Settings runs discovery through the authenticated Next route. First-run setup has no
   * owner yet and uses the backend endpoint, which the setup middleware opens until the
   * installation is configured.
   */
  endpoint?: string;
  /** When provided, each result offers to fill the connection form instead of only reporting. */
  onSelect?: (url: string) => void;
};

export function PaperlessDiscovery({
  baseUrl,
  endpoint = '/api/paperless/discovery',
  onSelect
}: PaperlessDiscoveryProps) {
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState('');
  const [instances, setInstances] = useState<DiscoveredInstance[]>([]);
  const [scanned, setScanned] = useState<number | null>(null);

  const scan = async () => {
    setScanning(true);
    setError('');
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hint: baseUrl })
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || body.success === false) throw new Error(body.error || 'Paperless discovery failed.');
      setInstances(Array.isArray(body.instances) ? body.instances : []);
      setScanned(Number(body.scanned || 0));
    } catch (scanError) {
      setError(scanError instanceof Error ? scanError.message : 'Paperless discovery failed.');
    } finally {
      setScanning(false);
    }
  };

  return <div className="settings-discovery">
    <div className="settings-action-cluster">
      <button className="settings-button" type="button" disabled={scanning} onClick={() => void scan()}>
        {scanning ? <RefreshCw className="is-spinning" aria-hidden="true" /> : <Radar aria-hidden="true" />}
        {scanning ? 'Scanning local network…' : 'Scan for Paperless'}
      </button>
      {scanning ? <InlineStatus kind="loading">Read-only discovery is running.</InlineStatus> : null}
      {error ? <InlineStatus kind="error">{error}</InlineStatus> : null}
      {!scanning && scanned !== null && !error ? <InlineStatus kind={instances.length ? 'success' : 'neutral'}>
        {instances.length
          ? `${instances.length} instance${instances.length === 1 ? '' : 's'} found.`
          : `No Paperless instance found across ${scanned} candidates.`}
      </InlineStatus> : null}
    </div>
    {instances.length ? <ul className="settings-discovery-results" aria-label="Discovered Paperless instances">
      {instances.map((instance) => <li key={instance.url}>
        <span>
          <strong>{instance.url}</strong>
          <small>
            {instance.version ? `Paperless ${instance.version}` : 'Paperless-compatible response'}
            {instance.requiresAuth ? ' · authentication required' : ''}
          </small>
        </span>
        {onSelect ? <button
          className="settings-button"
          type="button"
          onClick={() => onSelect(instance.url)}
        >
          Use this URL
        </button> : <span className="settings-badge">Read only</span>}
      </li>)}
    </ul> : null}
  </div>;
}
