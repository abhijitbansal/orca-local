import type { OrcadOptions } from './orcad-entry'

/**
 * orcad's flags. Pinned by orcad-launch-contract.test.ts.
 */
export function parseArgs(argv: string[]): OrcadOptions {
  const options: OrcadOptions = {}
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--json') {
      options.json = true
    } else {
      throw new Error(`Unknown argument: ${arg}`)
    }
  }
  return options
}
