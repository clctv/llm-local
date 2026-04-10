import { LLMCore } from './core'
import { LMStudioProvider } from './providers/lmstudio'
import { OllamaProvider } from './providers/ollama'

export const createLLM = async (): Promise<LLMCore> => {
  const llm = new LLMCore()
  await llm.register([new OllamaProvider(), new LMStudioProvider()])
  return llm
}
