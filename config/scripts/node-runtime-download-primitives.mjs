// Build-time only: fetches the pinned Node for packaging. The shipped app never imports this.
import { createHash } from 'node:crypto'
import { createReadStream, createWriteStream, mkdirSync } from 'node:fs'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { runProcessSync } from '@orca/process-host'
import { NODE_RUNTIME_PIN } from '../../src/shared/node-runtime-pin.ts'
import { getTarProgram, getZipExtractorCommand } from './zip-extractor-command.mjs'

const NODE_RUNTIME_BASE_URLS = {
  official: 'https://nodejs.org/dist',
  unofficial: 'https://unofficial-builds.nodejs.org/download/release'
}

export function nodeRuntimeReleaseUrl(source, file, version = NODE_RUNTIME_PIN.version) {
  return `${NODE_RUNTIME_BASE_URLS[source]}/v${version}/${file}`
}

export function nodeRuntimeHeadersUrl(pin = NODE_RUNTIME_PIN) {
  return nodeRuntimeReleaseUrl('official', pin.headers.file, pin.version)
}

export async function download(url, destination) {
  const response = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(600_000) })
  if (!response.ok || !response.body) {
    await response.body?.cancel()
    throw new Error(`GET ${url} failed: ${response.status} ${response.statusText}`)
  }
  await pipeline(Readable.fromWeb(response.body), createWriteStream(destination))
}

export async function sha256File(path) {
  const hash = createHash('sha256')
  await pipeline(createReadStream(path), hash)
  return hash.digest('hex')
}

function run(program, args) {
  const result = runProcessSync({ program, args, timeoutMs: 300_000 })
  if (result.code !== 0) {
    throw new Error(
      `${program} ${args.join(' ')} exited ${result.code}: ${result.stderr || result.stdout}`
    )
  }
  return result.stdout
}

export function extract(archivePath, destination, member) {
  mkdirSync(destination, { recursive: true })
  if (archivePath.endsWith('.zip')) {
    const command = getZipExtractorCommand(archivePath, destination)
    run(command.file, command.args)
    return
  }
  run(getTarProgram(), ['-xzf', archivePath, '-C', destination, member])
}
