import type { CommandSpec } from '../args'
import { GLOBAL_FLAGS } from '../args'

export const SERVE_COMMAND_SPECS: CommandSpec[] = [
  {
    path: ['serve'],
    summary: 'Start an Orca runtime server without opening a desktop window',
    usage: 'orca serve [--json]',
    allowedFlags: [...GLOBAL_FLAGS],
    notes: [
      'Runs in the foreground until stopped with Ctrl+C. This build has no network listener; connect with the orca CLI on this machine.'
    ],
    examples: ['orca serve', 'orca serve --json']
  }
]
