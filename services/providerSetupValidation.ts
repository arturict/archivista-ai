import setupService from './setupService';

type ProviderSetupValues = Record<string, string>;

async function validateProviderSetupModel(
  instanceId: string,
  values: ProviderSetupValues,
  modelId: string
): Promise<boolean> {
  const model = modelId.trim();
  if (!model) return false;

  switch (instanceId) {
    case 'openrouter':
      return setupService.validateOpenRouterConfig(
        values.apiKey,
        model,
        values.baseUrl || 'https://openrouter.ai/api/v1'
      );
    case 'openai':
      return setupService.validateOpenAIConfig(values.apiKey, model);
    case 'ollama':
      return setupService.validateOllamaConfig(
        values.baseUrl || 'http://localhost:11434',
        model,
        values.apiKey
      );
    case 'ollama-cloud':
      return setupService.validateOllamaConfig(
        values.baseUrl || 'https://ollama.com',
        model,
        values.apiKey
      );
    case 'opencode':
      return setupService.validateCustomConfig(
        values.baseUrl || 'https://opencode.ai/zen/go/v1',
        values.apiKey,
        model
      );
    case 'compatible':
      return setupService.validateCustomConfig(values.baseUrl, values.apiKey, model);
    default:
      return false;
  }
}

export default validateProviderSetupModel;
module.exports = validateProviderSetupModel;
