#!/usr/bin/env node
// Local-only fork gate: fails when cloud egress, cloud SDKs, publish/deep-link config, or wildcard binds reappear (e.g. after an upstream merge).
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { isDirectInvocation } from './script-entry-detection.mjs'

export const FORBIDDEN_HOSTS = [
  'onorca.dev',
  'posthog.com',
  'api.github.com',
  'uploads.github.com',
  'github.com/stablyai/orca',
  'gitlab.com/api',
  'api.bitbucket.org',
  'dev.azure.com',
  'atlassian.net',
  'api.linear.app',
  'api.anthropic.com',
  'console.anthropic.com',
  'chatgpt.com/backend-api',
  'api.openai.com',
  'nodejs.org/dist',
  'storage.googleapis.com'
]
// Entries ending in '/' or '-' are prefixes; every other entry matches the bare name or a subpath.
export const FORBIDDEN_MODULES = [
  'posthog-node',
  'posthog-js',
  'electron-updater',
  '@octokit/',
  '@sentry/',
  'ssh2',
  'ssh2-',
  'tweetnacl'
]
export function isForbiddenModule(name) {
  return FORBIDDEN_MODULES.some((m) =>
    m.endsWith('/') || m.endsWith('-') ? name.startsWith(m) : name === m || name.startsWith(`${m}/`)
  )
}
const SCANNED_ROOTS = ['src']
const SCANNED_EXTENSIONS = /\.(?:ts|tsx|mts|cts|js|mjs|cjs)$/
const SKIPPED_FILE = /(?:\.(?:test|spec)\.[cm]?[jt]sx?|-test-harness\.tsx?)$/
const SKIPPED_DIRS = new Set([
  'node_modules',
  'out',
  'dist',
  'build',
  '__fixtures__',
  '__mocks__',
  '__tests__',
  '.git'
])
// Bind contexts only: '::' alone is a common id separator in this codebase.
const WILDCARD_BIND =
  /(?:\b(?:host|hostname|bindHost|address)\s*[:=]\s*|\.(?:listen|bind)\([^)]*,\s*)['"](?:0\.0\.0\.0|::)['"]/
const MODULE_SPECIFIER = /(?:from\s*|import\(\s*|require\(\s*)['"]([^'"]+)['"]/g
// `import type … from 'x'` is erased by TypeScript and loads nothing at runtime. The specifier
// clause is matched exactly (`* as x`, an identifier, or one brace block) so a multi-line type
// import is recognised without letting the match run into a later value import.
const TYPE_ONLY_IMPORT =
  /\b(?:import|export)\s+type\s+(?:\*\s+as\s+\w+|\w+|\{[^}]*\})\s*from\s*['"]([^'"]+)['"]/g

function typeOnlyImportKeys(text) {
  const keys = new Set()
  for (const match of text.matchAll(TYPE_ONLY_IMPORT)) {
    const line = text.slice(0, match.index + match[0].length).split('\n').length
    keys.add(`${line}:${match[1]}`)
  }
  return keys
}

function collect(dir, found) {
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return found
  }
  for (const entry of entries) {
    if (SKIPPED_DIRS.has(entry.name)) {
      continue
    }
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      collect(full, found)
    } else if (SCANNED_EXTENSIONS.test(entry.name) && !SKIPPED_FILE.test(entry.name)) {
      found.push(full)
    }
  }
  return found
}

function scanSource(rootDir, file) {
  const rel = path.relative(rootDir, file).split(path.sep).join('/')
  const violations = []
  const source = readFileSync(file, 'utf8')
  const typeOnly = typeOnlyImportKeys(source)
  source.split('\n').forEach((text, index) => {
    const line = index + 1
    for (const host of FORBIDDEN_HOSTS) {
      if (text.includes(host)) {
        violations.push({ file: rel, line, rule: 'forbidden-host', match: host })
      }
    }
    for (const [, specifier] of text.matchAll(MODULE_SPECIFIER)) {
      if (typeOnly.has(`${line}:${specifier}`)) {
        continue
      }
      if (isForbiddenModule(specifier)) {
        violations.push({ file: rel, line, rule: 'forbidden-import', match: specifier })
      }
    }
    const wildcard = WILDCARD_BIND.exec(text)
    if (wildcard) {
      violations.push({ file: rel, line, rule: 'wildcard-bind', match: wildcard[0] })
    }
  })
  return violations
}

function scanPackage(rootDir) {
  const pkg = JSON.parse(readFileSync(path.join(rootDir, 'package.json'), 'utf8'))
  const names = Object.keys({
    ...pkg.dependencies,
    ...pkg.devDependencies,
    ...pkg.optionalDependencies
  })
  return names
    .filter((name) => isForbiddenModule(name))
    .map((name) => ({ file: 'package.json', line: 0, rule: 'forbidden-dependency', match: name }))
}

function scanBuilders(rootDir) {
  return readdirSync(path.join(rootDir, 'config'))
    .filter((name) => /^electron-builder.*\.config\.cjs$/.test(name))
    .flatMap((name) => scanBuilder(rootDir, `config/${name}`))
}

function scanBuilder(rootDir, rel) {
  const violations = []
  readFileSync(path.join(rootDir, rel), 'utf8')
    .split('\n')
    .forEach((text, index) => {
      if (/^\s*publish\s*:(?!\s*null\b)/.test(text)) {
        violations.push({ file: rel, line: index + 1, rule: 'builder-publish', match: 'publish' })
      }
      if (/^\s*protocols\s*:/.test(text)) {
        violations.push({
          file: rel,
          line: index + 1,
          rule: 'builder-protocols',
          match: 'protocols'
        })
      }
    })
  return violations
}

export function readAllowlist(rootDir) {
  let text = ''
  try {
    text = readFileSync(path.join(rootDir, 'config/local-only-allowlist.txt'), 'utf8')
  } catch {
    return new Set()
  }
  return new Set(
    text
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#'))
  )
}

export function scanLocalOnly({ rootDir, allowlist }) {
  const sources = SCANNED_ROOTS.flatMap((root) => collect(path.join(rootDir, root), []))
  return [
    ...sources.flatMap((file) => scanSource(rootDir, file)),
    ...scanPackage(rootDir),
    ...scanBuilders(rootDir)
  ].filter(
    (v) => !allowlist.has(`${v.file}:${v.rule}`) && !allowlist.has(`${v.file}:${v.rule}:${v.match}`)
  )
}

export function main(rootDir = process.cwd()) {
  const violations = scanLocalOnly({ rootDir, allowlist: readAllowlist(rootDir) })
  for (const v of violations) {
    console.error(`${v.file}:${v.line} [${v.rule}] ${v.match}`)
  }
  if (violations.length > 0) {
    console.error(
      `\ncheck-local-only: ${violations.length} violation(s). See docs/reference/local-only-upstream-sync.md.`
    )
    process.exitCode = 1
  } else {
    console.log('check-local-only: clean')
  }
}

if (isDirectInvocation(import.meta.url, process.argv[1])) {
  main()
}
