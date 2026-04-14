import type { LLMRequest, LLMResponse, LLMStreamChunk, LLMProvider } from './types'

export class LLMCore {
  private providers = new Map<string, LLMProvider>()
  private providerModels = new Map<string, Set<string>>()
  private defaultProviderName?: string

  async register(providers: LLMProvider | LLMProvider[]): Promise<void> {
    const input = Array.isArray(providers) ? providers : [providers]

    for (const provider of input) {
      const initResult = await provider.init()
      if (!initResult.available) {
        this.providers.delete(provider.name)
        this.providerModels.delete(provider.name)
        if (this.defaultProviderName === provider.name) {
          this.defaultProviderName = this.pickDefaultProviderName()
        }
        continue
      }

      if (initResult.models?.length) {
        this.providerModels.set(provider.name, new Set(initResult.models))
      } else {
        this.providerModels.delete(provider.name)
      }

      this.providers.set(provider.name, provider)
      if (!this.defaultProviderName) {
        this.defaultProviderName = provider.name
      }
    }
  }

  listProviders(): string[] {
    return Array.from(this.providers.keys())
  }

  listModels(provider: string): string[] {
    const models = this.providerModels.get(provider)
    return models ? Array.from(models) : []
  }

  async generate(req: LLMRequest): Promise<LLMResponse> {
    this.validateRequest(req)
    const { provider, normalizedRequest } = this.resolveProvider(req)
    return provider.generate(normalizedRequest)
  }

  async *generateStream(req: LLMRequest): AsyncIterable<LLMStreamChunk> {
    this.validateRequest(req)
    const { provider, normalizedRequest } = this.resolveProvider(req)

    for await (const chunk of provider.generateStream(normalizedRequest)) {
      yield chunk
    }
  }

  private resolveProvider(req: LLMRequest): {
    provider: LLMProvider
    normalizedRequest: LLMRequest
  } {
    const providerName = req.provider || this.defaultProviderName
    if (!providerName) {
      throw new Error('No provider registered')
    }

    const provider = this.providers.get(providerName)
    if (!provider) {
      throw new Error(`Provider "${providerName}" is not registered`)
    }

    const model = this.resolveModelName(provider.name, req.model)

    const normalizedRequest: LLMRequest = {
      ...req,
      model,
    }

    this.ensureModelSupported(provider.name, model)

    return { provider, normalizedRequest }
  }

  private validateRequest(req: LLMRequest): void {
    const hasPrompt = typeof req.prompt === 'string' && req.prompt.length > 0
    const hasMessages = Array.isArray(req.messages) && req.messages.length > 0
    if (!hasPrompt && !hasMessages) {
      throw new Error('Either `prompt` or `messages` is required')
    }
  }

  private ensureModelSupported(providerName: string, model: string): void {
    const models = this.providerModels.get(providerName)
    if (!models || models.size === 0 || models.has(model)) {
      return
    }

    throw new Error(
      `Model "${model}" is not found in provider "${providerName}". Available models: ${Array.from(models).join(', ')}`,
    )
  }

  private pickDefaultProviderName(): string | undefined {
    const first = this.providers.keys().next()
    return first.done ? undefined : first.value
  }

  private resolveModelName(providerName: string, model?: string): string {
    if (model) {
      return model
    }
    const models = this.listModels(providerName)
    if (models.length > 0) {
      return models[0]
    }
    throw new Error(`\`model\` is required for provider "${providerName}"`)
  }
}
