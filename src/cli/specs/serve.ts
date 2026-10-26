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
  },
  {
    path: ['serve', 'restore', 'resume'],
    summary: 'Resume automatic terminal restores that this host paused',
    usage: 'orca serve restore resume [--json]',
    allowedFlags: [...GLOBAL_FLAGS],
    notes: [
      'After its terminal host stops unexpectedly, or while it is overloaded, Orca keeps restored agent sessions asleep instead of starting them all at once. Each one resumes when you open it.',
      'This clears that pause so automatic restores start again, within the normal limits. It talks to the Orca running on this machine and never starts a server.',
      'It also lists restores from an older Orca client that this host refused, with the command that resumes each one.'
    ],
    examples: ['orca serve restore resume', 'orca serve restore resume --json']
  }
]
