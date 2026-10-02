import type { CommandSpec } from './args'
import { findCommandSpec, isCommandGroup, matches, supportsBrowserPageFlag } from './args'
import { unknownCommandData } from './command-suggestion'
import { formatCommandScopedFlagHelp } from './command-scoped-flag-help'
import { FLAG_HELP_TEXT } from './flag-help-text'
import { ROOT_HELP_TEXT_PRIMARY } from './root-help-text-primary'
import { ROOT_HELP_TEXT_SECONDARY } from './root-help-text-secondary'

const ROOT_HELP_TEXT = [ROOT_HELP_TEXT_PRIMARY, ROOT_HELP_TEXT_SECONDARY].join('\n')

export function printHelp(specs: CommandSpec[], commandPath: string[] = []): void {
  const exactSpec = findCommandSpec(specs, commandPath)
  if (exactSpec) {
    console.log(formatCommandHelp(exactSpec))
    return
  }

  if (isCommandGroup(specs, commandPath)) {
    console.log(formatGroupHelp(specs, commandPath))
    return
  }

  if (commandPath.length > 0) {
    const { nextSteps } = unknownCommandData(specs, commandPath)
    const recovery = nextSteps.map((step) => `Next step: ${step}`).join('\n')
    console.log(`Unknown command: ${commandPath.join(' ')}${recovery ? `\n${recovery}` : ''}\n`)
  }

  console.log(ROOT_HELP_TEXT)
}

export function formatCommandHelp(spec: CommandSpec): string {
  const lines = [`orca ${spec.path.join(' ')}`, '', `Usage: ${spec.usage}`, '', spec.summary]
  const displayedFlags =
    spec.argumentMode === 'passthrough'
      ? []
      : supportsBrowserPageFlag(spec.path)
        ? [...spec.allowedFlags, 'page']
        : spec.allowedFlags

  if (displayedFlags.length > 0) {
    lines.push('', 'Options:')
    for (const flag of displayedFlags) {
      lines.push(`  ${formatCommandFlagHelp(flag, spec.path)}`)
    }
  }

  if (spec.notes && spec.notes.length > 0) {
    lines.push('', 'Notes:')
    for (const note of spec.notes) {
      lines.push(`  ${note}`)
    }
  }

  if (spec.examples && spec.examples.length > 0) {
    lines.push('', 'Examples:')
    for (const example of spec.examples) {
      lines.push(`  $ ${example}`)
    }
  }

  return lines.join('\n')
}

export function formatGroupHelp(specs: CommandSpec[], groupPath: string[]): string {
  const group = groupPath.join(' ')
  const lines = [`orca ${group}`, '', `Usage: orca ${group} <command> [options]`, '', 'Commands:']
  for (const spec of specs) {
    if (
      spec.hidden === true ||
      spec.path.length <= groupPath.length ||
      !matches(spec.path.slice(0, groupPath.length), groupPath)
    ) {
      continue
    }
    lines.push(`  ${spec.path.slice(groupPath.length).join(' ').padEnd(18)} ${spec.summary}`)
  }
  lines.push('', `Run \`orca ${group} <command> --help\` for command-specific usage.`)
  return lines.join('\n')
}

function formatCommandFlagHelp(flag: string, commandPath: string[]): string {
  const command = commandPath.join(' ')
  const scopedHelp = formatCommandScopedFlagHelp(command, flag)
  if (scopedHelp) {
    return scopedHelp
  }
  if (command === 'terminal close' && flag === 'tab') {
    return '--tab                  Close the whole tab and wait for durable persistence'
  }
  if (command === 'orchestration worker-read' && flag === 'cursor') {
    return '--cursor <cursor>      Opaque cursor returned by a previous worker-read page'
  }
  if (command === 'orchestration worker-list' && flag === 'cursor') {
    return '--cursor <cursor>      Opaque page cursor copied from page.nextCursor'
  }
  if (command === 'orchestration worker-list' && flag === 'terminal-state') {
    return '--terminal-state <state> Terminal accounting filter: active, reclaimable, retained, release_pending, release_unknown, or released'
  }
  if (command === 'skills get' && flag === 'full') {
    return '--full                 Print the full guide with bundled references'
  }
  if (command === 'orchestration worker-list' && flag === 'include-remote') {
    return '--include-remote      Include connected-server worker observations'
  }
  if (command === 'worktree create' && flag === 'parent-worktree') {
    return '--parent-worktree <selector> Parent selector such as identity:<identity>, active/current, id:<repo-id>::<path>, branch:<branch>, issue:<number>, path:<path>, folder:<id>, or worktree:<worktreeId>'
  }
  if (command === 'orchestration task-create' && flag === 'task-title') {
    return '--task-title <text>  Concise title for the orchestration task'
  }
  if (command === 'orchestration task-create' && flag === 'display-name') {
    return '--display-name <text> UI label shown for dispatched worker rows'
  }
  // Why: the shared --agent help describes launching a TUI agent in a terminal,
  // which is the wrong meaning here — this selects the account provider.
  if (command === 'account add' && flag === 'agent') {
    return '--agent <id>           Account provider: claude or codex (default claude)'
  }
  if (flag === 'key' && command === 'computer hotkey') {
    return '--key <key-combo>      Modifier chord with one key, e.g. CmdOrCtrl+A'
  }
  if (flag === 'key' && command === 'computer press-key') {
    return '--key <key>            Single key, e.g. Return, Escape, Tab, Left, or PageUp'
  }
  return formatFlagHelp(flag)
}

export function formatFlagHelp(flag: string): string {
  return FLAG_HELP_TEXT[flag] ?? `--${flag}`
}
