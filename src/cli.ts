import type { Message } from './types'
import select from './select'
import colors from 'picocolors'
import { createInterface } from 'node:readline/promises'
import { stdin, stdout } from 'node:process'
import { LLMCore } from './core'
import { createLLM } from './createLLM'

export async function runCLI(): Promise<number> {
  const llm = await createLLM()
  const provider = await chooseProvider(llm)
  const model = await chooseModel(llm, provider)
  const history: Message[] = []
  const rl = createInterface({ input: stdin, output: stdout })
  let thinkEnabled = true

  console.log(`Using ${colors.green(model)} from ${colors.green(provider)}`)
  console.log(`Think: ${colors.yellow('on')}  ${colors.dim('(use /think on|off)')}`)

  try {
    while (true) {
      const text = (await rl.question('\n>>> ')).trim()
      if (!text) {
        continue
      }
      if (text === '/exit') {
        break
      }
      if (text.startsWith('/think')) {
        const next = applyThinkCommand(text, thinkEnabled)
        thinkEnabled = next.enabled
        console.log(next.message)
        continue
      }

      history.push({ role: 'user', content: text })
      let answer = ''
      let printedThinking = false

      for await (const chunk of llm.generate({
        provider,
        model,
        stream: true,
        think: thinkEnabled,
        messages: history,
      })) {
        if (chunk.thinking) {
          printedThinking = true
          stdout.write(colors.dim(chunk.thinking))
        }
        if (chunk.content) {
          if (printedThinking) {
            stdout.write('\n')
            printedThinking = false
          }
          answer += chunk.content
          stdout.write(chunk.content)
        }
      }

      stdout.write('\n')
      history.push({ role: 'assistant', content: answer })
    }
  } finally {
    rl.close()
  }

  return 0
}

async function chooseProvider(llm: LLMCore): Promise<string> {
  const providers = llm.listProviders()
  if (providers.length === 0) {
    throw new Error('No provider available')
  }
  if (providers.length === 1) {
    return providers[0]
  }
  return select({
    message: 'Select provider:',
    choices: providers.map((item) => ({ name: item, value: item })),
  })
}

async function chooseModel(llm: LLMCore, provider: string): Promise<string> {
  const models = llm.listModels(provider)
  if (models.length === 0) {
    throw new Error(`No models available for provider "${provider}"`)
  }
  if (models.length === 1) {
    return models[0]
  }
  return select({
    message: 'Select model:',
    choices: models.map((item) => ({ name: item, value: item })),
  })
}

function applyThinkCommand(
  text: string,
  current: boolean,
): {
  enabled: boolean
  message: string
} {
  const action = text.trim().split(/\s+/)[1]
  if (!action) {
    return {
      enabled: current,
      message: `Think: ${current ? colors.yellow('on') : colors.gray('off')}`,
    }
  }
  if (action === 'on') {
    return { enabled: true, message: `Think: ${colors.yellow('on')}` }
  }
  if (action === 'off') {
    return { enabled: false, message: `Think: ${colors.gray('off')}` }
  }
  return {
    enabled: current,
    message: 'Usage: /think [on|off]',
  }
}
