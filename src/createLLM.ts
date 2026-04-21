import { LLMCore } from './core'
import { LMStudioProvider } from './providers/lmstudio'
import { OllamaProvider } from './providers/ollama'
import type { LLMProvider } from './types'

export interface CreateLLMOptions {
  providers?: LLMProvider[]
}

export const createLLM = async (options?: CreateLLMOptions): Promise<LLMCore> => {
  const llm = new LLMCore()
  await llm.register(options?.providers || [new OllamaProvider(), new LMStudioProvider()])
  return llm
}
