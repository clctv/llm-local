import type {
  LLMRequest,
  LLMResponse,
  LLMStreamChunk,
  Message,
  LLMProvider,
  LLMProviderInitResult,
} from '../types'
import { postJson, readNdjsonStream } from './shared'

export interface OllamaProviderOptions {
  baseURL?: string
  name?: string
}

interface OllamaGenerateResponse {
  response?: string
  done?: boolean
  prompt_eval_count?: number
  eval_count?: number
}

interface OllamaChatResponse {
  message?: { role: string; content: string; thinking?: string }
  done?: boolean
  prompt_eval_count?: number
  eval_count?: number
}

interface OllamaTagsResponse {
  models?: Array<{ name?: string; model?: string }>
}

export class OllamaProvider implements LLMProvider {
  public readonly name: string
  public readonly supports = {
    chat: true,
    completion: true,
    stream: true,
  }
  private readonly baseURL: string

  constructor(options?: OllamaProviderOptions) {
    this.name = options?.name || 'ollama'
    this.baseURL = this.resolveBaseURL(options?.baseURL)
  }

  async init(): Promise<LLMProviderInitResult> {
    try {
      const response = await fetch(`${this.baseURL}/api/tags`, { method: 'GET' })
      if (!response.ok) {
        return { name: this.name, available: false }
      }
      const raw = (await response.json()) as OllamaTagsResponse
      const models = (raw.models || [])
        .map((item) => item.name || item.model)
        .filter((name): name is string => typeof name === 'string' && name.length > 0)
      return { name: this.name, available: true, models }
    } catch {
      return { name: this.name, available: false }
    }
  }

  async generate(req: LLMRequest): Promise<LLMResponse> {
    if (req.messages?.length) {
      const payload = {
        model: req.model,
        messages: req.messages,
        stream: false,
        ...(typeof req.think === 'boolean' ? { think: req.think } : {}),
        options: this.mapOptions(req),
      }
      const raw = await postJson<OllamaChatResponse>(`${this.baseURL}/api/chat`, payload)
      return {
        text: raw.message?.content || '',
        usage: {
          promptTokens: raw.prompt_eval_count,
          completionTokens: raw.eval_count,
        },
        raw,
      }
    }

    const payload = {
      model: req.model,
      prompt: req.prompt || this.messagesToPrompt(req.messages || []),
      stream: false,
      ...(typeof req.think === 'boolean' ? { think: req.think } : {}),
      options: this.mapOptions(req),
    }
    const raw = await postJson<OllamaGenerateResponse>(`${this.baseURL}/api/generate`, payload)
    return {
      text: raw.response || '',
      usage: {
        promptTokens: raw.prompt_eval_count,
        completionTokens: raw.eval_count,
      },
      raw,
    }
  }

  async *generateStream(req: LLMRequest): AsyncIterable<LLMStreamChunk> {
    const isChat = Array.isArray(req.messages) && req.messages.length > 0
    const payload = isChat
      ? {
          model: req.model,
          messages: req.messages,
          stream: true,
          ...(typeof req.think === 'boolean' ? { think: req.think } : {}),
          options: this.mapOptions(req),
        }
      : {
          model: req.model,
          prompt: req.prompt || this.messagesToPrompt(req.messages || []),
          stream: true,
          ...(typeof req.think === 'boolean' ? { think: req.think } : {}),
          options: this.mapOptions(req),
        }

    const endpoint = isChat ? '/api/chat' : '/api/generate'
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!response.ok) {
      throw new Error(`Ollama stream request failed with ${response.status}`)
    }

    for await (const raw of readNdjsonStream(response)) {
      const delta = isChat
        ? ((raw.message as { content?: string } | undefined)?.content as string | undefined) || ''
        : (raw.response as string | undefined) || ''
      const thinking = isChat
        ? ((raw.message as { thinking?: string } | undefined)?.thinking as string | undefined) || ''
        : (raw.thinking as string | undefined) || ''
      const done = Boolean(raw.done)
      yield { delta, thinking, done, raw }
    }
  }

  private mapOptions(req: LLMRequest): Record<string, unknown> {
    return {
      ...(typeof req.temperature === 'number' ? { temperature: req.temperature } : {}),
      ...(typeof req.maxTokens === 'number' ? { num_predict: req.maxTokens } : {}),
      ...req.extra,
    }
  }

  private messagesToPrompt(messages: Message[]): string {
    return messages.map((item) => `${item.role}: ${item.content}`).join('\n')
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
