import type { CommandSpec } from '../args'
import { GLOBAL_FLAGS } from '../args'

export const SERVE_COMMAND_SPECS: CommandSpec[] = [
  {
    path: ['serve'],
    summary: 'Start an Orca runtime server without opening a desktop window',
    usage: 'orca serve [--project-root <path>] [--recipe-json] [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'project-root', 'recipe-json'],
    notes: [
      'Runs in the foreground until stopped with Ctrl+C. This build has no network listener; connect with the orca CLI on this machine.',
      'Use --recipe-json with --project-root from VM recipes to print the recipe result JSON and leave the server running.'
    ],
    examples: ['orca serve', 'orca serve --json']
  }
]
