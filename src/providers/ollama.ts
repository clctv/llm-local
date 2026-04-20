import type {
  LLMRequest,
  LLMResponse,
  LLMStreamChunk,
  LLMProvider,
  LLMProviderInitResult,
  LLMStreamRequest,
  LLMNonStreamRequest,
} from '../types'
import { normalizeMessagesFromRequest, postJson, readNdjsonStream } from './shared'

export interface OllamaProviderOptions {
  baseURL?: string
  name?: string
}

interface OllamaChatResponse {
  message?: { role: string; content: string; thinking?: string }
  done?: boolean
  prompt_eval_count?: number
  eval_count?: number
}

interface OllamaTagsResponse {
  models?: Array<{ name: string }>
}

export class OllamaProvider implements LLMProvider {
  public readonly name: string
  private readonly baseURL: string

  constructor(options?: OllamaProviderOptions) {
    this.name = options?.name || 'ollama'
    this.baseURL = this.resolveBaseURL(options?.baseURL)
  }

  async init(): Promise<LLMProviderInitResult> {
    try {
      const response = await fetch(`${this.baseURL}/api/tags`, { method: 'GET' })
      if (!response.ok) {
        return { available: false }
      }
      const raw = (await response.json()) as OllamaTagsResponse
      const models = (raw.models || []).map((item) => item.name)
      return { available: true, models }
    } catch {
      return { available: false }
    }
  }

  generate(req: LLMStreamRequest): AsyncIterable<LLMStreamChunk>
  generate(req: LLMNonStreamRequest): Promise<LLMResponse>
  generate(req: LLMRequest): Promise<LLMResponse> | AsyncIterable<LLMStreamChunk> {
    if (req.stream) {
      return this.generateAsStream(req)
    }
    return this.generateAsResponse(req)
  }

  private async generateAsResponse(req: LLMRequest): Promise<LLMResponse> {
    const payload = this.buildPayload(req, false)
    const raw = await postJson<OllamaChatResponse>(`${this.baseURL}/api/chat`, payload)
    return {
      content: raw.message?.content || '',
      thinking: raw.message?.thinking || '',
      usage: {
        promptTokens: raw.prompt_eval_count,
        completionTokens: raw.eval_count,
      },
      raw,
    }
  }

  private async *generateAsStream(req: LLMRequest): AsyncIterable<LLMStreamChunk> {
    const payload = this.buildPayload(req, true)

    const response = await fetch(`${this.baseURL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!response.ok) {
      throw new Error(`Ollama stream request failed with ${response.status}`)
    }

    for await (const raw of readNdjsonStream(response)) {
      const content =
        ((raw.message as { content?: string } | undefined)?.content as string | undefined) ||
        (raw.response as string | undefined) ||
        ''
      const thinking =
        ((raw.message as { thinking?: string } | undefined)?.thinking as string | undefined) ||
        (raw.thinking as string | undefined) ||
        ''
      const done = Boolean(raw.done)
      const promptTokens =
        typeof raw.prompt_eval_count === 'number' ? (raw.prompt_eval_count as number) : undefined
      const completionTokens =
        typeof raw.eval_count === 'number' ? (raw.eval_count as number) : undefined
      const usage =
        typeof promptTokens === 'number' || typeof completionTokens === 'number'
          ? { promptTokens, completionTokens }
          : undefined
      yield { content, thinking, usage, done, raw }
    }
  }

  private buildPayload(req: LLMRequest, stream: boolean): Record<string, unknown> {
    return {
      model: req.model,
      messages: normalizeMessagesFromRequest(req),
      stream,
      think: req.think,
      format: req.format,
      ...this.mapTopLevelExtra(req),
      options: this.mapOptions(req),
    }
  }

  private mapTopLevelExtra(req: LLMRequest): Record<string, unknown> {
    const extra = (req.extra ?? {}) as Record<string, unknown>
    return {
      ...(Array.isArray(extra.tools) ? { tools: extra.tools } : {}),
      ...(extra.keep_alive !== undefined ? { keep_alive: extra.keep_alive } : {}),
    }
  }

  private mapOptions(req: LLMRequest): Record<string, unknown> {
    const extra = (req.extra ?? {}) as Record<string, unknown>
    const {
      format: _format,
      tools: _tools,
      keep_alive: _keepAlive,
      stream: _stream,
      model: _model,
      messages: _messages,
      think: _think,
      options: _options,
      ...rest
    } = extra

    return {
      ...(typeof req.temperature === 'number' ? { temperature: req.temperature } : {}),
      ...rest,
    }
  }

  private resolveBaseURL(input?: string): string {
    const raw = (input || process.env.OLLAMA_HOST || '127.0.0.1:11434').trim()
    const normalized = /^https?:\/\//i.test(raw) ? raw : `http://${raw}`
    const url = new URL(normalized)
    if (!url.port) {
      url.port = '11434'
    }
    return url.toString().replace(/\/$/, '')
  }
}
