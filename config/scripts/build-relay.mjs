#!/usr/bin/env node
/**
 * Bundle the two WSL guest relays. They run inside a WSL distro via wsl.exe, use
 * only Node built-ins, and ship inside the app through the out/relay extraResource.
 */
import { build } from 'esbuild'
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const __dirname = import.meta.dirname
// Why: the script lives under config/scripts, so go two levels up to reach the repo root.
const ROOT = join(__dirname, '..', '..')
// Why: lets the packaging contract test build into a temp tree instead of clobbering out/relay.
const OUT_ROOT = process.env.ORCA_RELAY_OUT_ROOT ?? join(ROOT, 'out', 'relay')
const RELAY_VERSION = '0.1.0'

const WSL_HOOK_ENTRY = join(ROOT, 'src', 'relay', 'wsl-agent-hook-relay.ts')
const WSL_BROWSER_NETWORK_ENTRY = join(ROOT, 'src', 'relay', 'wsl-browser-network-relay.ts')

async function bundleWslRelay(entry, outfile) {
  await build({
    entryPoints: [entry],
    bundle: true,
    platform: 'node',
    target: 'node18',
    format: 'cjs',
    outfile,
    sourcemap: false,
    minify: true,
    define: { 'process.env.NODE_ENV': '"production"' }
  })
  return createHash('sha256').update(readFileSync(outfile)).digest('hex').slice(0, 12)
}

const outDir = join(OUT_ROOT, 'wsl')
// Why: a stale per-platform SSH relay tree from an earlier checkout must not ship beside the WSL bundles.
rmSync(OUT_ROOT, { recursive: true, force: true })
mkdirSync(outDir, { recursive: true })

const hookHash = await bundleWslRelay(WSL_HOOK_ENTRY, join(outDir, 'wsl-agent-hook-relay.js'))
writeFileSync(join(outDir, '.version'), `${RELAY_VERSION}+${hookHash}`)
console.log(`Built WSL hook relay → ${outDir}/wsl-agent-hook-relay.js`)

const browserNetworkHash = await bundleWslRelay(
  WSL_BROWSER_NETWORK_ENTRY,
  join(outDir, 'wsl-browser-network-relay.js')
)
writeFileSync(join(outDir, '.browser-network-version'), `${RELAY_VERSION}+${browserNetworkHash}`)
console.log(`Built WSL browser network relay → ${outDir}/wsl-browser-network-relay.js`)

console.log('Relay build complete.')
