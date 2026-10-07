import type { CommandSpec } from '../args'
import { GLOBAL_FLAGS } from '../args'

export const SKILL_COMMAND_SPECS: CommandSpec[] = [
  {
    path: ['skills', 'installed'],
    summary: 'List installed skill selectors',
    usage: 'orca skills installed [--json]',
    allowedFlags: [...GLOBAL_FLAGS],
    notes: ['Lists discovery IDs and names without reading skill contents into the CLI.']
  },
  {
    path: ['skills', 'list'],
    summary: 'List version-matched skill guides bundled with this Orca CLI',
    usage: 'orca skills list [--json]',
    allowedFlags: [...GLOBAL_FLAGS],
    notes: [
      'Reads bundled guide metadata locally without contacting the Orca runtime.',
      'With --json, prints a topics array of canonical names and one-line descriptions.',
      'Use `orca skills get <name>` for the compact guide, or `--full` for its full reference package.'
    ]
  },
  {
    path: ['skills', 'get'],
    aliases: [['skills', 'show']],
    summary: 'Print a version-matched skill guide as Markdown',
    usage: 'orca skills get <topic> [--full | --reference <name>] [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'topic', 'full', 'reference', 'references'],
    positionalArgs: ['topic'],
    notes: [
      'Reads bundled guide content locally without contacting the Orca runtime.',
      'Prints the compact guide by default. Use --full to print the full guide with bundled references when provided.',
      'Use --reference <name> to print one bundled reference alone, which is what an action gate in the compact guide needs; --references lists the available names.',
      'A reference name may be given bare (recovery-and-cleanup) or as the guide spells it (references/recovery-and-cleanup.md).',
      'Use --json for a deterministic object containing canonical topic metadata and content.'
    ],
    examples: [
      'orca skills get orca-cli',
      'orca skills get orchestration --full',
      'orca skills get orchestration --references',
      'orca skills get orchestration --reference recovery-and-cleanup'
    ]
  }
]
