import { z } from 'zod';
import { apiError, ApiError, readJsonBody } from '@/lib/server/auth';
import { assertInitialSetupOpen } from '@/lib/server/initial-setup';
import { providerInstanceIdSchema } from '@root/contracts/provider';
import providerDiscoveryService from '@root/services/providerDiscoveryService';

const providerRegistryModule = require('@root/services/providerRegistry');
const providerRegistry = providerRegistryModule.default || providerRegistryModule;

const requestSchema = z.object({
  instanceId: providerInstanceIdSchema,
  values: z.record(z.string().max(4096)).default({})
}).strict();

function assertSafeUrls(
  fields: Array<{ key: string; type: string }>,
  values: Record<string, string>
) {
  for (const field of fields.filter((candidate) => candidate.type === 'url')) {
    const value = values[field.key];
    if (!value) continue;
    const url = new URL(value);
    if (url.username || url.password) {
      throw new ApiError(400, `${field.key} must not contain embedded credentials.`);
    }
  }
}

function safeDiscoveryError(error: unknown) {
  const message = error instanceof Error ? error.message : '';
  const status = message.match(/HTTP \d{3}/)?.[0];
  if (/not authenticated/i.test(message)) return 'The runtime account is not authenticated yet.';
  return status
    ? `The runtime returned ${status}. Check its URL, credentials, and model API compatibility.`
    : 'The runtime could not be reached. Check its URL, credentials, and network access.';
}

export async function POST(request: Request) {
  try {
    await assertInitialSetupOpen(request);

    const input = requestSchema.parse(await readJsonBody(request, 32 * 1024));
    const definition = providerRegistry.getProviderDefinition(input.instanceId);
    if (!definition) {
      return Response.json({ error: `Provider "${input.instanceId}" is unavailable.` }, { status: 404 });
    }
    const values = {
      ...Object.fromEntries(definition.fields.flatMap((field: { key: string; defaultValue?: string }) => (
        field.defaultValue ? [[field.key, field.defaultValue]] : []
      ))),
      ...input.values
    };
    assertSafeUrls(definition.fields, values);
    const environment = providerRegistry.providerValuesToEnvironment(input.instanceId, values);
    let models;
    try {
      models = await providerDiscoveryService.discoverProviderModels(input.instanceId, environment);
    } catch (error) {
      throw new ApiError(400, safeDiscoveryError(error));
    }

    return Response.json({
      ok: true,
      models: models.map((model) => ({
        id: model.id,
        name: model.name,
        isDefault: model.isDefault,
        capabilities: model.capabilities
      }))
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return apiError(error);
  }
}
