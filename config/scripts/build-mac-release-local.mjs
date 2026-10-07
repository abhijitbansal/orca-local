#!/usr/bin/env node
// Signed + notarized macOS release from this machine: Developer ID Application cert
// from the login keychain, notarization via the App Store Connect API key in
// ~/.app-store-connect/ (AuthKey_<KEY_ID>.p8 + `config` with KEY_ID= and ISSUER_ID=).
// No credential value is read into the repo or printed.

import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, realpathSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const DEVELOPER_ID_PREFIX = 'Developer ID Application:'
const IDENTITY_LINE = /^\s*\d+\)\s+([0-9A-F]{40})\s+"([^"]+)"/
// Why strip: electron-builder prefers Apple ID notarization whenever either var is set, and imports
// a CSC_LINK .p12 into a temp keychain that would hide the login-keychain identity we pass.
const CONFLICTING_ENV = [
  'APPLE_ID',
  'APPLE_APP_SPECIFIC_PASSWORD',
  'APPLE_TEAM_ID',
  'CSC_LINK',
  'CSC_KEY_PASSWORD'
]

function unquote(value) {
  return /^(["']).*\1$/.test(value) ? value.slice(1, -1) : value
}

export function parseAscConfig(text) {
  const values = {}
  for (const line of text.split('\n')) {
    const trimmed = line.trim().replace(/^export\s+/, '')
    if (!trimmed || trimmed.startsWith('#')) {
      continue
    }
    const separator = trimmed.indexOf('=')
    if (separator > 0) {
      values[trimmed.slice(0, separator).trim()] = unquote(trimmed.slice(separator + 1).trim())
    }
  }
  for (const key of ['KEY_ID', 'ISSUER_ID']) {
    if (!values[key]) {
      throw new Error(`${key} is not set in the App Store Connect config file.`)
    }
  }
  return { keyId: values.KEY_ID, issuerId: values.ISSUER_ID }
}

/** Why the hash: electron-builder rejects a CSC_NAME carrying the cert-type prefix, and the bare
 *  "Name (TEAM)" form is ambiguous to codesign when an Apple Distribution cert shares it. */
export function pickDeveloperIdIdentity(findIdentityOutput) {
  const byHash = new Map()
  for (const line of findIdentityOutput.split('\n')) {
    const match = IDENTITY_LINE.exec(line)
    if (match && match[2].startsWith(DEVELOPER_ID_PREFIX)) {
      byHash.set(match[1], match[2])
    }
  }
  if (byHash.size === 0) {
    throw new Error(
      [
        'No "Developer ID Application" certificate in the keychain.',
        'Apple only lets the Account Holder create one, so the API key cannot:',
        '  Xcode > Settings > Accounts > (your team) > Manage Certificates > + > Developer ID Application',
        'Apple Distribution certificates are App Store only and cannot sign a DMG.'
      ].join('\n')
    )
  }
  if (byHash.size > 1) {
    throw new Error(
      'Several Developer ID Application certificates found; set CSC_NAME to the SHA-1 hash of the one to use.'
    )
  }
  const [[hash, name]] = byHash
  return { hash, name }
}

function resolveNotarizationEnv(ascDir) {
  const configPath = join(ascDir, 'config')
  if (!existsSync(configPath)) {
    throw new Error(`Missing ${configPath} (KEY_ID= and ISSUER_ID=).`)
  }
  const { keyId, issuerId } = parseAscConfig(readFileSync(configPath, 'utf8'))
  const keyPath = join(ascDir, `AuthKey_${keyId}.p8`)
  if (!existsSync(keyPath)) {
    throw new Error(`Missing ${keyPath}.`)
  }
  return { APPLE_API_KEY: keyPath, APPLE_API_KEY_ID: keyId, APPLE_API_ISSUER: issuerId }
}

export function isNotarizationAccepted(notarytoolJson) {
  try {
    return JSON.parse(notarytoolJson).status === 'Accepted'
  } catch {
    return false
  }
}

/** Why: electron-builder notarizes only the .app; a signed + stapled DMG is also assessed
 *  (and tamper-checked) when a recipient mounts it, not just when the app first runs. */
function signAndNotarizeDmgs(distDir, signingIdentity, notarizationEnv) {
  const dmgs = readdirSync(distDir).filter((name) => /^orca-macos-.+\.dmg$/.test(name))
  if (dmgs.length === 0) {
    throw new Error(`No orca-macos-*.dmg in ${distDir}.`)
  }
  for (const name of dmgs) {
    const dmgPath = join(distDir, name)
    console.log(`[build:mac:release:local] signing and notarizing ${name}`)
    execFileSync('codesign', ['--force', '--sign', signingIdentity, '--timestamp', dmgPath], {
      stdio: 'inherit'
    })
    const verdict = execFileSync(
      'xcrun',
      [
        'notarytool',
        'submit',
        dmgPath,
        '--key',
        notarizationEnv.APPLE_API_KEY,
        '--key-id',
        notarizationEnv.APPLE_API_KEY_ID,
        '--issuer',
        notarizationEnv.APPLE_API_ISSUER,
        '--wait',
        '--output-format',
        'json'
      ],
      { encoding: 'utf8' }
    )
    if (!isNotarizationAccepted(verdict)) {
      throw new Error(`Notarization of ${name} was not accepted: ${verdict.trim()}`)
    }
    execFileSync('xcrun', ['stapler', 'staple', dmgPath], { stdio: 'inherit' })
  }
}

function main() {
  if (process.platform !== 'darwin') {
    throw new Error('macOS release builds must run on macOS.')
  }
  const ascDir = process.env.ORCA_ASC_DIR ?? join(homedir(), '.app-store-connect')
  const notarizationEnv = resolveNotarizationEnv(ascDir)
  let signingIdentity = process.env.CSC_NAME
  if (!signingIdentity) {
    const identity = pickDeveloperIdIdentity(
      execFileSync('security', ['find-identity', '-v', '-p', 'codesigning'], { encoding: 'utf8' })
    )
    console.log(`[build:mac:release:local] signing with ${identity.name}`)
    signingIdentity = identity.hash
  }
  const childEnv = { ...process.env, ...notarizationEnv, CSC_NAME: signingIdentity }
  for (const key of CONFLICTING_ENV) {
    delete childEnv[key]
  }
  // Why --dmg-only: re-run just the DMG step after a notary hiccup without repackaging.
  if (!process.argv.includes('--dmg-only')) {
    const result = spawnSync('pnpm', ['run', 'build:mac:release'], {
      env: childEnv,
      stdio: 'inherit'
    })
    if (result.error) {
      throw result.error
    }
    if (result.status !== 0) {
      process.exitCode = result.status ?? 1
      return
    }
  }
  signAndNotarizeDmgs(join(process.cwd(), 'dist'), signingIdentity, notarizationEnv)
}

// Why realpath: a symlinked invocation must still run the gate, never silently skip it.
if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(import.meta.filename)) {
  try {
    main()
  } catch (error) {
    console.error(
      `[build:mac:release:local] ${error instanceof Error ? error.message : String(error)}`
    )
    process.exitCode = 1
  }
}
