import type { Message } from './types'
import select from './select'
import pc from 'picocolors'
import { createInterface } from 'node:readline/promises'
import { stdin, stdout } from 'node:process'
import { LLMCore } from './core'
import { createLLM } from './createLLM'

export async function runCLI(): Promise<number> {
  const output = (text: string) => console.log(text)
  const core = await createLLM()

  const provider = await chooseProvider(core)
  const model = await chooseModel(core, provider)
  const history: Message[] = []
  const rl = createInterface({ input: stdin, output: stdout })
  let thinkEnabled = true

  output(`Using ${pc.green(model)} from ${pc.green(provider)}`)
  output(`Think: ${pc.yellow('on')}  (use /think on|off|toggle|status)`)

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
        output(next.message)
        continue
      }

      history.push({ role: 'user', content: text })
      let answer = ''
      let printedThinking = false

      for await (const chunk of core.generateStream({
        provider,
        model,
        think: thinkEnabled,
        messages: history,
      })) {
        if (chunk.thinking) {
          printedThinking = true
          stdout.write(pc.dim(chunk.thinking))
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

async function chooseProvider(core: LLMCore): Promise<string> {
  const providers = core.listProviders()
  if (providers.length === 0) {
    throw new Error('No provider available')
  }
  if (providers.length === 1) {
    return providers[0]
  }
  return select({
    message: 'Select provider',
    choices: providers.map((item) => ({ name: item, value: item })),
  })
}

async function chooseModel(core: LLMCore, provider: string): Promise<string> {
  const models = core.listModels(provider)
  if (models.length === 0) {
    throw new Error(`No models available for provider "${provider}"`)
  }
  if (models.length === 1) {
    return models[0]
  }
  return select({
    message: 'Select model',
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
  if (!action || action === 'status') {
    return {
      enabled: current,
      message: `Think: ${current ? pc.yellow('on') : pc.gray('off')}`,
    }
  }
  if (action === 'on') {
    return { enabled: true, message: `Think: ${pc.yellow('on')}` }
  }
  if (action === 'off') {
    return { enabled: false, message: `Think: ${pc.gray('off')}` }
  }
  if (action === 'toggle') {
    const enabled = !current
    return { enabled, message: `Think: ${enabled ? pc.yellow('on') : pc.gray('off')}` }
  }
  return {
    enabled: current,
    message: 'Usage: /think [on|off|toggle|status]',
  }
}
