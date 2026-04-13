import type {
  LLMRequest,
  LLMResponse,
  LLMStreamChunk,
  LLMProvider,
  LLMProviderInitResult,
} from '../types'
import { normalizeMessagesFromRequest, postJson, readOpenAISSE } from './shared'

export interface OpenAICompatibleProviderOptions {
  name: string
  baseURL: string
  apiKey?: string
}

interface OpenAITextResponse {
  choices?: Array<{
    text?: string
    message?: {
      role?: string
      content?: string
      reasoning?: string
      reasoning_content?: string
      thinking?: string
    }
    reasoning?: string
    reasoning_content?: string
    thinking?: string
  }>
  usage?: {
    prompt_tokens?: number
    completion_tokens?: number
  }
}

interface OpenAIStreamChoice {
  text?: string
  delta?: {
    role?: string
    content?: string
    reasoning?: string
    reasoning_content?: string
    thinking?: string
  }
  reasoning?: string
  reasoning_content?: string
  thinking?: string
}

interface OpenAIStreamChunkRaw {
  choices?: OpenAIStreamChoice[]
}

interface OpenAIModelsResponse {
  data?: Array<{ id?: string }>
}

export class OpenAICompatibleProvider implements LLMProvider {
  public readonly name: string
  public readonly supports = {
    chat: true,
    stream: true,
  }
  protected readonly baseURL: string
  protected readonly apiKey?: string

  constructor(options: OpenAICompatibleProviderOptions) {
    this.name = options.name
    this.baseURL = options.baseURL.replace(/\/$/, '')
    this.apiKey = options.apiKey
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
      const raw = (await response.json()) as OpenAIModelsResponse
      const models = (raw.data || [])
        .map((item) => item.id)
        .filter((id): id is string => typeof id === 'string' && id.length > 0)
      return { available: true, models }
    } catch {
      return { available: false }
    }
  }

  async generate(req: LLMRequest): Promise<LLMResponse> {
    const messages = normalizeMessagesFromRequest(req)
    const payload = {
      model: req.model,
      messages,
      ...(typeof req.temperature === 'number' ? { temperature: req.temperature } : {}),
      ...(typeof req.maxTokens === 'number' ? { max_tokens: req.maxTokens } : {}),
      ...this.mapFormat(req.format),
      ...req.extra,
      stream: false,
    }

    const raw = await postJson<OpenAITextResponse>(
      `${this.baseURL}/v1/chat/completions`,
      payload,
      this.buildHeaders(),
    )
    const first = raw.choices?.[0]
    const content = first?.message?.content || first?.text || ''
    const thinking =
      first?.message?.reasoning ||
      first?.message?.reasoning_content ||
      first?.message?.thinking ||
      first?.reasoning ||
      first?.reasoning_content ||
      first?.thinking ||
      ''
    return {
      content,
      thinking,
      usage: {
        promptTokens: raw.usage?.prompt_tokens,
        completionTokens: raw.usage?.completion_tokens,
      },
      raw,
    }
  }

  async *generateStream(req: LLMRequest): AsyncIterable<LLMStreamChunk> {
    const messages = normalizeMessagesFromRequest(req)
    const payload = {
      model: req.model,
      messages,
      ...(typeof req.temperature === 'number' ? { temperature: req.temperature } : {}),
      ...(typeof req.maxTokens === 'number' ? { max_tokens: req.maxTokens } : {}),
      ...this.mapFormat(req.format),
      ...req.extra,
      stream: true,
    }

    const response = await fetch(`${this.baseURL}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.buildHeaders(),
      },
      body: JSON.stringify(payload),
    })
    if (!response.ok) {
      throw new Error(`${this.name} stream request failed with ${response.status}`)
    }

    for await (const rawChunk of readOpenAISSE(response)) {
      const chunk = rawChunk as OpenAIStreamChunkRaw
      const choice = chunk.choices?.[0]
      const content = choice?.delta?.content || choice?.text || ''
      const thinking =
        choice?.delta?.reasoning ||
        choice?.delta?.reasoning_content ||
        choice?.delta?.thinking ||
        choice?.reasoning ||
        choice?.reasoning_content ||
        choice?.thinking ||
        ''
      yield { content, thinking, raw: rawChunk }
    }
  }

  protected buildHeaders(): Record<string, string> {
    if (!this.apiKey) {
      return {}
    }
    return { Authorization: `Bearer ${this.apiKey}` }
  }

  private mapFormat(format: LLMRequest['format']): Record<string, unknown> {
    if (typeof format === 'undefined') {
      return {}
    }
    return {
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'structured_output',
          schema: {
            type: 'object',
            additionalProperties: true,
          },
        },
      },
    }
  }
}
