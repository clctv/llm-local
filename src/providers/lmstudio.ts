import { OpenAICompatibleProvider } from './openai-compatible'
import type { LLMProviderInitResult, LLMRequest, LLMResponse, LLMStreamChunk } from '../types'

export interface LMStudioProviderOptions {
  name?: string
  baseURL?: string
}

interface LMStudioModelItem {
  id?: string
  type?: string
  object?: string
}

interface LMStudioModelsResponse {
  data?: LMStudioModelItem[]
}

export class LMStudioProvider extends OpenAICompatibleProvider {
  constructor(options?: LMStudioProviderOptions) {
    super({
      name: options?.name || 'lmstudio',
      baseURL: options?.baseURL || 'http://127.0.0.1:1234',
    })
  }

  async generate(req: LLMRequest): Promise<LLMResponse> {
    return super.generate(this.withThink(req))
  }

  async *generateStream(req: LLMRequest): AsyncIterable<LLMStreamChunk> {
    for await (const chunk of super.generateStream(this.withThink(req))) {
      yield chunk
    }
  }

  async init(): Promise<LLMProviderInitResult> {
    try {
      const response = await fetch(`${this.baseURL}/v1/models`, {
        method: 'GET',
        headers: this.buildHeaders(),
      })
      if (!response.ok) {
        return { available: false }
      }
      const raw = (await response.json()) as LMStudioModelsResponse
      const models = (raw.data || [])
        .filter((item) => !this.isEmbeddingModel(item))
        .map((item) => item.id)
        .filter((id): id is string => typeof id === 'string' && id.length > 0)
      return { available: true, models }
    } catch {
      return { available: false }
    }
  }

  private withThink(req: LLMRequest): LLMRequest {
    if (typeof req.think !== 'boolean') {
      return req
    }
    const extra = (req.extra || {}) as Record<string, unknown>
    const chatTemplateKwargs = (extra.chat_template_kwargs as Record<string, unknown>) || {}
    return {
      ...req,
      extra: {
        ...extra,
        chat_template_kwargs: {
          ...chatTemplateKwargs,
          enable_thinking: req.think,
        },
      },
    }
  }

  private isEmbeddingModel(item: LMStudioModelItem): boolean {
    const id = (item.id || '').toLowerCase()
    const type = (item.type || '').toLowerCase()
    const object = (item.object || '').toLowerCase()
    if (type.includes('embedding') || object.includes('embedding')) {
      return true
    }
    return id.includes('embedding') || /(?:^|[-_/])embed(?:ding|dings)?(?:$|[-_/])/.test(id)
  }
}
