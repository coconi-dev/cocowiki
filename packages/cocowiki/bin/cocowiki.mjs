#!/usr/bin/env node
import { run } from '../dist/node/cli.js'
try { await run() } catch (error) {
  console.error(`[cocowiki] ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
}
