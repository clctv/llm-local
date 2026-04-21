# llm-local

A lightweight local LLM layer with:

- A ready-to-use CLI (`llm`)
- Automatic local provider discovery and model listing
- Unified API across multiple local providers

Supported providers:

- Ollama (default: `http://127.0.0.1:11434`)
- LM Studio (default: `http://127.0.0.1:1234`)

## Installation

Install as a CLI:

```bash
npm i -g llm-local
```

Install as a dependency:

```bash
npm i llm-local
```

## CLI

Run:

```bash
llm
```

CLI behavior:

- Auto-selects provider and model (if only one choice is available, it is selected directly)
- Keeps multi-turn history in session
- `think` is enabled by default and can be switched with `/think on|off`

Built-in commands:

- `/think on`
- `/think off`
- `/exit`

## Quick Start

```ts
import { createLLM } from 'llm-local'

const llm = await createLLM()

const providers = llm.listProviders()
if (providers.length === 0) {
  throw new Error('No provider available')
}

const provider = providers[0]
const model = llm.listModels(provider)[0]

const result = await llm.generate({
  provider,
  model,
  prompt: 'Give me a short summary of local LLM routing.',
})

console.log(result.content)
```

Streaming response:

```ts
import { createLLM } from 'llm-local'

const llm = await createLLM()
const provider = llm.listProviders()[0]
const model = llm.listModels(provider)[0]
let text = ''

for await (const chunk of llm.generate({
  provider,
  model,
  stream: true,
  messages: [{ role: 'user', content: 'Write a one-paragraph intro about Ollama.' }],
  think: true,
})) {
  if (chunk.thinking) text += chunk.thinking
  if (chunk.content) text += chunk.content
}
```

## Advanced: Provider Control

The `llm` instance returned by `createLLM()` supports advanced provider control:

```ts
import { createLLM, OllamaProvider } from 'llm-local'

const llm = await createLLM()
llm.register(
  new OllamaProvider({
    name: 'ollama-custom',
    baseURL: 'http://127.0.0.1:11434',
  }),
)
```

Alternatively, pass `providers` to `createLLM({ providers })` to override the default provider registration.

## Providers

### Ollama

- Provider name: `ollama`
- Default URL: `http://127.0.0.1:11434`
- Reads `/api/tags` for model discovery
- Uses chat endpoint `POST /api/chat` for generation and streaming
- When `format: 'json'` is set, request uses top-level `format: 'json'`

### LM Studio

- Provider name: `lmstudio`
- Default URL: `http://127.0.0.1:1234`
- Uses LM Studio endpoints:
  - `GET /api/v1/models`
  - `POST /api/v1/chat`
- `format: 'json'` is currently ignored by this provider.

## License

MIT
