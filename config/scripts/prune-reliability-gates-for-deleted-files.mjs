#!/usr/bin/env node
/**
 * Prune config/reliability-gates.jsonc after test files were deleted: drop the dead
 * testFiles/assertionRefs/commands/evidenceRuns, and delete a gate once no test file
 * is left. `providers`/`coveredProviders` are never touched. Comments survive.
 */
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { applyEdits, modify, parse } from 'jsonc-parser'

const ROOT = join(import.meta.dirname, '..', '..')
const MANIFEST = join(ROOT, 'config', 'reliability-gates.jsonc')
const FORMAT = { formattingOptions: { insertSpaces: true, tabSize: 2, eol: '\n' } }
const PATH_TOKEN = /^[\w@./-]+\.(?:ts|tsx|mjs|cjs|js|json|jsonc|yml|yaml|md)$/

const isFile = (path) => existsSync(join(ROOT, path)) && statSync(join(ROOT, path)).isFile()
const pathTokens = (command) => command.split(/\s+/).filter((token) => PATH_TOKEN.test(token))

// Why: a command that still runs surviving files must keep running them, so only the missing
// paths come out; a command left with no surviving test file is dropped whole.
function pruneCommand(command, survivingFiles) {
  const missing = pathTokens(command).filter((token) => token.includes('/') && !isFile(token))
  if (missing.length === 0) {
    return command
  }
  const trimmed = command
    .split(/\s+/)
    .filter((token) => !missing.includes(token))
    .join(' ')
  return pathTokens(trimmed).some((token) => survivingFiles.includes(token)) ? trimmed : null
}

function pruneGate(gate) {
  const testFiles = gate.testFiles.filter(isFile)
  const commandMap = new Map()
  for (const command of gate.commands) {
    commandMap.set(command, pruneCommand(command, testFiles))
  }
  const commands = [...commandMap.values()].filter((command) => command !== null)
  const evidenceRuns = gate.evidenceRuns
    .map((run) => ({
      ...run,
      command: commandMap.has(run.command) ? commandMap.get(run.command) : run.command
    }))
    .filter((run) => run.command === undefined || commands.includes(run.command))
  const assertionRefs = gate.assertionRefs.filter((ref) => testFiles.includes(ref.file))
  return { testFiles, commands, evidenceRuns, assertionRefs }
}

// Why: partial/active protection is only honest while an assertion and a passing run back it.
const PROTECTED_LEVELS = new Set(['partial', 'active'])

function isUnprotected(gate, pruned) {
  if (pruned.testFiles.length === 0 || pruned.commands.length === 0) {
    return true
  }
  return (
    PROTECTED_LEVELS.has(gate.protection) &&
    (pruned.assertionRefs.length === 0 ||
      !pruned.evidenceRuns.some((run) => run.result === 'passed'))
  )
}

let text = readFileSync(MANIFEST, 'utf8')
const manifest = parse(text, [], { allowTrailingComma: true })
const gatesKey = Object.keys(manifest).find(
  (key) => Array.isArray(manifest[key]) && manifest[key][0]?.testFiles
)
if (!gatesKey) {
  throw new Error('config/reliability-gates.jsonc has no gate list')
}

const changed = []
// Why: bottom-up, so a deletion never shifts the index of a gate still to be visited.
for (let index = manifest[gatesKey].length - 1; index >= 0; index -= 1) {
  const gate = manifest[gatesKey][index]
  const pruned = pruneGate(gate)
  if (
    JSON.stringify(pruned) ===
    JSON.stringify({
      testFiles: gate.testFiles,
      commands: gate.commands,
      evidenceRuns: gate.evidenceRuns,
      assertionRefs: gate.assertionRefs
    })
  ) {
    continue
  }
  if (isUnprotected(gate, pruned)) {
    text = applyEdits(text, modify(text, [gatesKey, index], undefined, FORMAT))
    changed.push(`deleted ${gate.id}`)
    continue
  }
  for (const field of ['testFiles', 'commands', 'evidenceRuns', 'assertionRefs']) {
    text = applyEdits(text, modify(text, [gatesKey, index, field], pruned[field], FORMAT))
  }
  changed.push(`trimmed ${gate.id}`)
}

writeFileSync(MANIFEST, text)
console.log(changed.toReversed().join('\n') || 'no reliability gate changed')
