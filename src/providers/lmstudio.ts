import { OpenAICompatibleProvider } from './openai-compatible'
import type { LLMRequest, LLMResponse, LLMStreamChunk } from '../types'

export interface LMStudioProviderOptions {
  name?: string
  baseURL?: string
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
}
