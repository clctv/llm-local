#!/usr/bin/env node

import { runCLI } from '../dist/cli.js'

function isInterruptedError(error) {
  if (!(error instanceof Error)) {
    return false
  }
  return error.name === 'AbortError' || error.name === 'ExitPromptError'
}

runCLI().catch((error) => {
  if (isInterruptedError(error)) {
    process.exit(0)
  }
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
