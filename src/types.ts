export type Role = 'system' | 'user' | 'assistant'

export interface Message {
  role: Role
  content: string
}

export interface LLMRequest {
  provider?: string
  model?: string
  think?: boolean
  prompt?: string
  messages?: Message[]
  temperature?: number
  maxTokens?: number
  stream?: boolean
  extra?: Record<string, unknown>
}

export interface LLMUsage {
  promptTokens?: number
  completionTokens?: number
}

export interface LLMResponse {
  text: string
  usage?: LLMUsage
  raw?: unknown
}

export interface LLMStreamChunk {
  delta: string
  thinking?: string
  done?: boolean
  raw?: unknown
}

export interface LLMProviderInitResult {
  name: string
  available: boolean
  models?: string[]
}

export interface LLMProvider {
  name: string
  supports: {
    chat: boolean
    completion: boolean
    stream: boolean
  }
  init(): Promise<LLMProviderInitResult>
  generate(req: LLMRequest): Promise<LLMResponse>
  generateStream?(req: LLMRequest): AsyncIterable<LLMStreamChunk>
}
