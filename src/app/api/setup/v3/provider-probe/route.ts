import { z } from 'zod';
import { apiError, ApiError, readJsonBody } from '@/lib/server/auth';
import { assertInitialSetupOpen } from '@/lib/server/initial-setup';
import { providerInstanceIdSchema, type ModelDescriptor } from '@root/contracts/provider';
import providerDiscoveryService from '@root/services/providerDiscoveryService';
import validateProviderSetupModel from '@root/services/providerSetupValidation';

const providerRegistryModule = require('@root/services/providerRegistry');
const providerRegistry = providerRegistryModule.default || providerRegistryModule;

const requestSchema = z.object({
  instanceId: providerInstanceIdSchema,
  values: z.record(z.string().max(4096)).default({}),
  modelId: z.string().trim().min(1).max(200).optional()
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
    let models: ModelDescriptor[] = [];
    let discoveryError: unknown;
    try {
      models = await providerDiscoveryService.discoverProviderModels(input.instanceId, environment);
    } catch (error) {
      discoveryError = error;
    }

    let validatedModelId: string | undefined;
    if (input.modelId) {
      if (definition.manualModelInput) {
        const valid = await validateProviderSetupModel(input.instanceId, values, input.modelId);
        if (!valid) {
          throw new ApiError(
            400,
            'The selected model could not complete a test request. Check the model ID, credentials, and runtime URL.'
          );
        }
      } else if (!models.some((model) => model.id === input.modelId)) {
        throw new ApiError(400, 'The selected model is not available to this runtime account.');
      }
      validatedModelId = input.modelId;
      if (!models.some((model) => model.id === input.modelId)) {
        models = [{
          id: input.modelId,
          name: input.modelId,
          isDefault: true,
          options: [],
          capabilities: ['chat']
        }];
      }
    } else if (discoveryError) {
      const hint = definition.manualModelInput
        ? ' You can enter a model ID manually and check it directly.'
        : '';
      throw new ApiError(400, `${safeDiscoveryError(discoveryError)}${hint}`);
    } else if (!models.length) {
      const message = definition.manualModelInput
        ? 'The runtime returned no models. Enter a model ID manually and check it directly.'
        : 'The runtime account returned no usable models.';
      throw new ApiError(400, message);
    }

    return Response.json({
      ok: true,
      ...(validatedModelId ? {
        validatedModelId,
        validationMode: definition.manualModelInput ? 'chat' : 'catalog'
      } : {}),
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
