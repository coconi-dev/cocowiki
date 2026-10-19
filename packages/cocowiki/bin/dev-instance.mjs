import { createHash, randomUUID } from 'node:crypto'
import { closeSync, mkdirSync, openSync, readFileSync, realpathSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'

function isAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false
  try { process.kill(pid, 0); return true } catch (error) {
    if (error.code === 'ESRCH') return false
    if (error.code === 'EPERM') return true
    throw error
  }
}

// This file is a lease, not just a PID check: a reusable instance must answer
// with the same project, process and random token before we report its URL.
export async function acquireDevInstance(projectRoot) {
  const filename = resolve(projectRoot, '.cocowiki/dev.lock')
  const projectId = createHash('sha256').update(realpathSync(projectRoot)).digest('hex')
  const token = randomUUID()
  const deadline = Date.now() + 15000
  mkdirSync(dirname(filename), { recursive: true })
  while (Date.now() < deadline) {
    let descriptor
    try { descriptor = openSync(filename, 'wx') } catch (error) {
      if (error.code !== 'EEXIST') throw error
    }
    if (descriptor !== undefined) {
      let metadata = { pid: process.pid, token, projectId, state: 'starting', url: null }
      try { writeFileSync(descriptor, JSON.stringify(metadata)) } finally { closeSync(descriptor) }
      const ownsLease = () => {
        try { return JSON.parse(readFileSync(filename, 'utf8')).token === token } catch { return false }
      }
      return {
        kind: 'owner',
        token,
        update(state, url = metadata.url) {
          if (!ownsLease()) throw new Error('开发实例状态已改变，请重新启动开发服务。')
          metadata = { ...metadata, state, url }
          const temporary = `${filename}.${token}.tmp`
          try {
            writeFileSync(temporary, JSON.stringify(metadata))
            renameSync(temporary, filename)
          } finally { rmSync(temporary, { force: true }) }
        },
        release() {
          if (ownsLease()) rmSync(filename, { force: true })
        }
      }
    }

    let source
    let existing
    try {
      source = readFileSync(filename, 'utf8')
      existing = JSON.parse(source)
    } catch (error) {
      if (error.code === 'ENOENT') continue
      // Another process may be between exclusive creation and its first write.
      // Only recover malformed files that have remained unchanged for a while.
      try {
        if (Date.now() - statSync(filename).mtimeMs > 5000 && readFileSync(filename, 'utf8') === source) {
          rmSync(filename, { force: true })
          continue
        }
      } catch (error) { if (error.code !== 'ENOENT') throw error }
      await delay(50)
      continue
    }
    if (!isAlive(existing.pid)) {
      try {
        if (readFileSync(filename, 'utf8') === source) rmSync(filename, { force: true })
      } catch (error) { if (error.code !== 'ENOENT') throw error }
      continue
    }
    if (existing.state === 'ready' && existing.url && existing.projectId === projectId) {
      try {
        const statusUrl = new URL('__cocowiki/status', existing.url)
        const response = await fetch(statusUrl, { signal: AbortSignal.timeout(700) })
        const identity = await response.json()
        if (response.ok && identity.pid === existing.pid && identity.token === existing.token && identity.projectId === projectId) {
          return { kind: 'existing', pid: existing.pid, url: existing.url }
        }
      } catch {}
    }
    await delay(100)
  }
  throw new Error('现有开发实例尚未就绪或没有响应；请在启动它的终端查看日志。')
}
