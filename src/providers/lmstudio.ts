import type {
  LLMProvider,
  LLMProviderInitResult,
  LLMRequest,
  LLMResponse,
  LLMStreamChunk,
} from '../types'
import { normalizeMessagesFromRequest, postJson, readOpenAISSE } from './shared'

export interface LMStudioProviderOptions {
  name?: string
  baseURL?: string
}

interface LMStudioModelItem {
  key: string
  type: 'llm' | 'embedding'
}

interface LMStudioModelsResponse {
  models?: LMStudioModelItem[]
}

interface LMStudioOutputItem {
  type?: string
  content?: string
}

interface LMStudioChatResponse {
  output?: LMStudioOutputItem[]
  stats?: {
    input_tokens?: number
    total_output_tokens?: number
  }
  response_id?: string
  model_instance_id?: string
}

export class LMStudioProvider implements LLMProvider {
  public readonly name: string
  private readonly baseURL: string
  private readonly latestResponseIdByModel = new Map<string, string>()

  constructor(options?: LMStudioProviderOptions) {
    this.name = options?.name || 'lmstudio'
    this.baseURL = this.resolveBaseURL(options?.baseURL)
  }

  async generate(req: LLMRequest): Promise<LLMResponse> {
    const payload = this.buildPayload(req, false)
    const raw = await postJson<LMStudioChatResponse>(`${this.baseURL}/api/v1/chat`, payload)
    const parsed = this.parseOutput(raw.output)
    this.rememberResponseId(req.model, raw.response_id)
    return {
      content: parsed.content,
      thinking: parsed.thinking,
      usage: {
        promptTokens: raw.stats?.input_tokens,
        completionTokens: raw.stats?.total_output_tokens,
      },
      raw,
    }
  }

  async *generateStream(req: LLMRequest): AsyncIterable<LLMStreamChunk> {
    const payload = this.buildPayload(req, true)
    const response = await fetch(`${this.baseURL}/api/v1/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })
    if (!response.ok) {
      throw new Error(`${this.name} stream request failed with ${response.status}`)
    }

    for await (const rawChunk of readOpenAISSE(response)) {
      const { content, thinking, done } = this.parseStreamChunk(rawChunk)
      const endData = this.extractStreamEndData(rawChunk)
      if (!content && !thinking && !done) {
        continue
      }
      yield { content, thinking, usage: endData?.usage, done, raw: rawChunk }
      if (done) {
        this.rememberResponseId(req.model, endData?.responseId)
      }
    }
  }

  async init(): Promise<LLMProviderInitResult> {
    try {
      const response = await fetch(`${this.baseURL}/api/v1/models`, {
        method: 'GET',
      })
      if (!response.ok) {
        return { available: false }
      }
      const raw = (await response.json()) as LMStudioModelsResponse
      const models = (raw.models || [])
        .filter((item) => item.type === 'llm')
        .map((item) => item.key)

      return { available: true, models }
    } catch {
      return { available: false }
    }
  }

  private buildPayload(req: LLMRequest, stream: boolean): Record<string, unknown> {
    const { input, system_prompt, previous_response_id } = this.mapInput(req)
    const payload: Record<string, unknown> = {
      model: req.model,
      input,
      ...(typeof system_prompt === 'string' && system_prompt.length > 0 ? { system_prompt } : {}),
      ...(typeof previous_response_id === 'string' && previous_response_id.length > 0
        ? { previous_response_id }
        : {}),
      ...(typeof req.temperature === 'number' ? { temperature: req.temperature } : {}),
      ...(typeof req.maxTokens === 'number' ? { max_output_tokens: req.maxTokens } : {}),
      ...this.mapThink(req),
      ...req.extra,
      stream,
    }

    return payload
  }

  private mapInput(req: LLMRequest): {
    input: string | Array<{ type: 'message'; content: string }>
    system_prompt?: string
    previous_response_id?: string
  } {
    const messages = normalizeMessagesFromRequest(req)
    if (messages.length === 0) {
      return { input: req.prompt || '' }
    }

    const system_prompt = messages
      .filter((message) => message.role === 'system')
      .map((message) => message.content)
      .filter((content) => content.length > 0)
      .join('\n\n')
    const conversational = messages.filter((message) => message.role !== 'system')

    if (conversational.length === 0) {
      return { input: req.prompt || '', ...(system_prompt ? { system_prompt } : {}) }
    }

    if (conversational.some((message) => message.role === 'assistant')) {
      const last = conversational[conversational.length - 1]
      if (last.role !== 'user') {
        throw new Error(
          'LM Studio /api/v1/chat expects the latest message to be a user turn when using stateful chat.',
        )
      }
      const previousResponseId = this.getPreviousResponseId(req)
      if (previousResponseId) {
        return {
          input: last.content,
          ...(system_prompt ? { system_prompt } : {}),
          previous_response_id: previousResponseId,
        }
      }
      throw new Error(
        'LM Studio stateful chat context is missing previous_response_id. Start a new chat or pass extra.previous_response_id explicitly.',
      )
    }

    if (conversational.length === 1) {
      return {
        input: conversational[0].content,
        ...(system_prompt ? { system_prompt } : {}),
      }
    }
    return {
      input: conversational.map((message) => ({ type: 'message', content: message.content })),
      ...(system_prompt ? { system_prompt } : {}),
    }
  }

  private getPreviousResponseId(req: LLMRequest): string | undefined {
    const fromExtra = (req.extra as Record<string, unknown> | undefined)?.previous_response_id
    if (typeof fromExtra === 'string' && fromExtra.length > 0) {
      return fromExtra
    }
    if (!req.model) {
      return
    }
    return this.latestResponseIdByModel.get(req.model)
  }

  private rememberResponseId(model: string | undefined, responseId: string | undefined): void {
    if (!model || !responseId) {
      return
    }
    this.latestResponseIdByModel.set(model, responseId)
  }

  private mapThink(req: LLMRequest): Record<string, unknown> {
    if (typeof req.think !== 'boolean') {
      return {}
    }
    const extra = req.extra || {}
    if (typeof extra.reasoning === 'string') {
      return {}
    }
    return { reasoning: req.think ? 'on' : 'off' }
  }

  private parseOutput(output?: LMStudioOutputItem[]): { content: string; thinking: string } {
    const items = Array.isArray(output) ? output : []
    const content = items
      .filter((item) => item.type === 'message')
      .map((item) => item.content || '')
      .join('')
    const thinking = items
      .filter((item) => item.type === 'reasoning')
      .map((item) => item.content || '')
      .join('')
    return { content, thinking }
  }

  private parseStreamChunk(rawChunk: Record<string, unknown>): {
    content: string
    thinking: string
    done: boolean
  } {
    const type = this.toString(rawChunk.type)
    const eventContent = this.toString(rawChunk.content)
    const content = type === 'message.delta' ? eventContent : ''
    const thinking = type === 'reasoning.delta' ? eventContent : ''
    const done = type === 'chat.end'
    return { content, thinking, done }
  }

  private extractStreamEndData(rawChunk: Record<string, unknown>):
    | {
        usage: { promptTokens?: number; completionTokens?: number }
        responseId?: string
      }
    | undefined {
    const type = this.toString(rawChunk.type)
    if (type !== 'chat.end') {
      return undefined
    }
    const result = (rawChunk.result as Record<string, unknown> | undefined) || {}
    const stats = (result.stats as Record<string, unknown> | undefined) || {}
    const responseId =
      typeof result.response_id === 'string' && result.response_id.length > 0
        ? result.response_id
        : undefined
    return {
      usage: {
        promptTokens: this.toNumber(stats.input_tokens),
        completionTokens: this.toNumber(stats.total_output_tokens),
      },
      responseId,
    }
  }

  private toString(value: unknown): string {
    return typeof value === 'string' ? value : ''
  }

  private toNumber(value: unknown): number | undefined {
    return typeof value === 'number' ? value : undefined
  }

  private resolveBaseURL(input?: string): string {
    const raw = (input || 'http://127.0.0.1:1234').trim()
    return raw.replace(/\/$/, '')
  }
}
