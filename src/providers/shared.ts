import type { LLMRequest, Message } from '../types'

export function normalizeMessagesFromRequest(
  req: Pick<LLMRequest, 'messages' | 'prompt'>,
): Message[] {
  if (Array.isArray(req.messages) && req.messages.length > 0) {
    return req.messages
  }
  if (typeof req.prompt === 'string' && req.prompt.length > 0) {
    return [{ role: 'user', content: req.prompt }]
  }
  return []
}

export async function postJson<T>(
  url: string,
  body: unknown,
  headers?: Record<string, string>,
): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const message = await readTextSafe(response)
    throw new Error(`HTTP ${response.status} ${response.statusText}: ${message}`)
  }

  return (await response.json()) as T
}

export async function* readNdjsonStream(
  response: Response,
): AsyncIterable<Record<string, unknown>> {
  await ensureResponseOk(response)
  if (!response.body) {
    return
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) {
        buffer += decoder.decode()
        break
      }
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        const chunk = line.trim()
        if (!chunk) {
          continue
        }
        yield parseJsonObject(chunk, 'NDJSON chunk')
      }
    }

    const finalLine = buffer.trim()
    if (finalLine) {
      yield parseJsonObject(finalLine, 'NDJSON final chunk')
    }
  } finally {
    reader.releaseLock()
  }
}

export async function* readOpenAISSE(response: Response): AsyncIterable<Record<string, unknown>> {
  await ensureResponseOk(response)
  if (!response.body) {
    return
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) {
        buffer += decoder.decode()
        break
      }
      buffer += decoder.decode(value, { stream: true })

      const parts = buffer.split('\n\n')
      buffer = parts.pop() || ''

      for (const part of parts) {
        const parsed = parseOpenAISSEPart(part)
        if (parsed) {
          yield parsed
        }
      }
    }

    const remaining = buffer.trim()
    if (remaining) {
      const parsed = parseOpenAISSEPart(remaining)
      if (parsed) {
        yield parsed
      }
    }
  } finally {
    reader.releaseLock()
  }
}

async function readTextSafe(response: Response): Promise<string> {
  try {
    return await response.text()
  } catch {
    return ''
  }
}

async function ensureResponseOk(response: Response): Promise<void> {
  if (response.ok) {
    return
  }
  const message = await readTextSafe(response)
  throw new Error(`HTTP ${response.status} ${response.statusText}: ${message}`)
}

function parseJsonObject(input: string, label: string): Record<string, unknown> {
  try {
    return JSON.parse(input) as Record<string, unknown>
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`${label} parse failed: ${message}`)
  }
}

function parseOpenAISSEPart(part: string): Record<string, unknown> | undefined {
  const lines = part.split('\n')
  const dataLines: string[] = []
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed.startsWith('data:')) {
      continue
    }
    dataLines.push(trimmed.slice(5).trim())
  }

  if (dataLines.length === 0) {
    return undefined
  }
  if (dataLines.length > 1) {
    throw new Error('OpenAI SSE chunk has multiple data lines, expected a single JSON payload')
  }

  const data = dataLines[0].trim()
  if (!data || data === '[DONE]') {
    return undefined
  }

  return parseJsonObject(data, 'OpenAI SSE chunk')
}
