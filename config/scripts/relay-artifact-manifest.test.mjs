// Packaged-relay contract: what `build:relay` actually writes to disk.
//
// Asserts against a real build, not the source tree: only the two WSL guest
// relays ship, and each version marker must hash its own bundle.
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const projectDir = resolve(import.meta.dirname, '../..')
// Its own tree: building into out/relay would clobber a developer's build and
// race the suites that read it.
const relayOutDir = mkdtempSync(join(tmpdir(), 'orca-relay-contract-'))
const wslDir = join(relayOutDir, 'wsl')

beforeAll(() => {
  execFileSync('node', [join(projectDir, 'config', 'scripts', 'build-relay.mjs')], {
    cwd: projectDir,
    stdio: 'pipe',
    env: { ...process.env, ORCA_RELAY_OUT_ROOT: relayOutDir }
  })
}, 120_000)

afterAll(() => {
  rmSync(relayOutDir, { recursive: true, force: true })
})

describe('packaged relay artifact manifest', () => {
  it('emits only the WSL relay directory', () => {
    expect(readdirSync(relayOutDir)).toEqual(['wsl'])
  })

  it('emits exactly the two WSL bundles and their version markers', () => {
    expect(readdirSync(wslDir).sort()).toEqual([
      '.browser-network-version',
      '.version',
      'wsl-agent-hook-relay.js',
      'wsl-browser-network-relay.js'
    ])
  })

  it.each([
    ['.version', 'wsl-agent-hook-relay.js'],
    ['.browser-network-version', 'wsl-browser-network-relay.js']
  ])('stamps %s with the hash of %s', (versionFile, bundle) => {
    const version = readFileSync(join(wslDir, versionFile), 'utf8')
    const hash = createHash('sha256')
      .update(readFileSync(join(wslDir, bundle)))
      .digest('hex')
      .slice(0, 12)

    expect(version).toMatch(/^0\.1\.0\+[0-9a-f]{12}$/)
    expect(version).toBe(`0.1.0+${hash}`)
  })
})
