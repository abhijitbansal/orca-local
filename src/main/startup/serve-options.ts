export type ServeOptions = {
  json: boolean
}

function optionsBeforeTerminator(argv: readonly string[]): readonly string[] {
  const terminatorIndex = argv.indexOf('--')
  return terminatorIndex === -1 ? argv : argv.slice(0, terminatorIndex)
}

function optionName(token: string): string {
  const equalsIndex = token.indexOf('=')
  return equalsIndex === -1 ? token : token.slice(0, equalsIndex)
}

function hasFlag(argv: readonly string[], flags: readonly string[]): boolean {
  const flagNames = new Set(flags)
  return argv.some((token) => flagNames.has(optionName(token)))
}

export function getServeOptions(argv: readonly string[]): ServeOptions {
  const optionsArgv = optionsBeforeTerminator(argv)
  return {
    // The CLI uses `flags.has('json')`, so even `--json=false` enables JSON output.
    json: hasFlag(optionsArgv, ['--serve-json', '--json'])
  }
}
