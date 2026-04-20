export type Role = 'system' | 'user' | 'assistant'
export type ThinkLevel = 'high' | 'medium' | 'low'

export interface Message {
  role: Role
  content: string
}

export interface LLMRequest {
  provider?: string
  model?: string
  think?: boolean | ThinkLevel
  prompt?: string
  messages?: Message[]
  temperature?: number
  stream?: boolean
  format?: 'json'
  extra?: Record<string, unknown>
}

export interface LLMUsage {
  promptTokens?: number
  completionTokens?: number
}

export interface LLMResponse {
  content: string
  thinking?: string
  usage?: LLMUsage
  raw?: unknown
}

export interface LLMStreamChunk {
  content: string
  thinking?: string
  usage?: LLMUsage
  done: boolean
  raw?: unknown
}

export interface LLMProviderInitResult {
  available: boolean
  models?: string[]
}

export interface LLMProvider {
  name: string
  init(): Promise<LLMProviderInitResult>
  generate(req: LLMRequest): Promise<LLMResponse>
  generateStream(req: LLMRequest): AsyncIterable<LLMStreamChunk>
}
