# llm-local

A lightweight local LLM layer with:

- A ready-to-use CLI (`llm`)
- A simple programmatic entrypoint (`createLLM`)
- Automatic local provider discovery and model listing
- Unified streaming output with optional reasoning/thinking chunks

Supported providers:

- Ollama (default: `http://127.0.0.1:11434`)
- LM Studio (default: `http://127.0.0.1:1234`, native `/api/v1` API)

## Requirements

- Node.js 18+
- At least one local provider running (Ollama or LM Studio)

> [!NOTE]
> Providers are detected at startup. Unavailable providers are skipped automatically.

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

Use `createLLM` for the simplest programmatic flow:

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

for await (const chunk of llm.generateStream({
  provider,
  model,
  messages: [{ role: 'user', content: 'Write a one-paragraph intro about Ollama.' }],
  think: true,
})) {
  if (chunk.thinking) process.stdout.write(chunk.thinking)
  if (chunk.content) process.stdout.write(chunk.content)
}
```

## Advanced: Using LLMCore

`LLMCore` is the advanced API if you want full provider control:

- Register custom provider instances
- Control provider names and base URLs
- Mix built-in and custom providers

Core methods:

- `register()`
- `listProviders()`
- `listModels(provider)`
- `generate(req)`
- `generateStream(req)`

Request fields:

- `provider`, `model`
- `prompt` or `messages` (at least one is required; `prompt` is wrapped as one `user` message)
- `think`
- `format` (only supports `'json'`)
- `temperature`
- `extra` (provider-specific passthrough payload)

## Providers

### Ollama

- Provider name: `ollama`
- Default URL: `http://127.0.0.1:11434`
- Override host with `OLLAMA_HOST` (with or without protocol)
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
