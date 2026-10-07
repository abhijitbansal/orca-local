#!/usr/bin/env node

import { realpathSync } from 'node:fs'

// Why alternatives: CI ships a .p12 + Apple ID; a local release uses a keychain
// identity + App Store Connect API key (config/scripts/build-mac-release-local.mjs).
const SIGNING_ALTERNATIVES = [['CSC_NAME'], ['CSC_LINK', 'CSC_KEY_PASSWORD']]
const NOTARIZATION_ALTERNATIVES = [
  ['APPLE_API_KEY', 'APPLE_API_KEY_ID', 'APPLE_API_ISSUER'],
  ['APPLE_ID', 'APPLE_APP_SPECIFIC_PASSWORD', 'APPLE_TEAM_ID']
]

function isSet(env, key) {
  const value = env[key]
  return typeof value === 'string' && value.trim().length > 0
}

function describeMissingGroup(label, alternatives, env) {
  if (alternatives.some((keys) => keys.every((key) => isSet(env, key)))) {
    return null
  }
  return `${label}: ${alternatives.map((keys) => keys.join(' + ')).join(', or ')}`
}

export function findMissingMacReleaseEnv(env) {
  return [
    describeMissingGroup('signing', SIGNING_ALTERNATIVES, env),
    describeMissingGroup('notarization', NOTARIZATION_ALTERNATIVES, env)
  ].filter((entry) => entry !== null)
}

// Why realpath: a symlinked invocation must still run the gate, never silently skip it.
if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(import.meta.filename)) {
  const missing = findMissingMacReleaseEnv(process.env)
  if (missing.length > 0) {
    // Why: local developers still need ad-hoc builds for validation, but the
    // production release path must fail fast instead of silently shipping an
    // unsigned, unnotarized app that only looked successful in CI logs.
    console.error('Missing required macOS release signing environment variables:')
    for (const entry of missing) {
      console.error(`- ${entry}`)
    }
    console.error('')
    console.error('Use `pnpm build:mac` for local ad-hoc builds, or')
    console.error('`pnpm build:mac:release:local` to sign with your keychain Developer ID')
    console.error('certificate and notarize with ~/.app-store-connect.')
    process.exit(1)
  }
}
