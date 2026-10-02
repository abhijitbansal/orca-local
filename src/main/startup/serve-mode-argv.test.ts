import { describe, expect, it } from 'vitest'
import {
  argvRequestsServeMode,
  findServeSubcommandIndex,
  normalizeServeModeArgv
} from './serve-mode-argv'

describe('serve-mode-argv', () => {
  it('detects --serve and bare serve subcommand', () => {
    expect(argvRequestsServeMode(['orca', '--serve'])).toBe(true)
    expect(argvRequestsServeMode(['/AppRun', 'serve'])).toBe(true)
    expect(argvRequestsServeMode(['/AppRun', '--no-sandbox', 'serve', '--json'])).toBe(true)
    expect(argvRequestsServeMode(['orca'])).toBe(false)
  })

  it('does not treat serve as a subcommand when it is an option value', () => {
    expect(findServeSubcommandIndex(['app', '--user-data-dir', 'serve'])).toBe(-1)
    expect(argvRequestsServeMode(['app', '--user-data-dir', 'serve'])).toBe(false)
    expect(normalizeServeModeArgv(['app', '--user-data-dir', 'serve'])).toEqual([
      'app',
      '--user-data-dir',
      'serve'
    ])
    // The value is skipped, not the subcommand after it.
    expect(findServeSubcommandIndex(['app', '--user-data-dir', '/tmp/x', 'serve'])).toBe(3)
  })

  it('refuses a help launch instead of starting a server', () => {
    // Why: `--help` is not a serve flag, so it used to be swallowed and the launch started a
    // runtime server. The AppImage redirect routes help to the CLI.
    for (const argv of [
      ['/AppRun', 'serve', '--help'],
      ['/AppRun', 'serve', '-h'],
      ['/AppRun', '--help', 'serve'],
      ['/AppRun', 'help', 'serve'],
      // Bare `help` too — the AppImage redirect's own help set includes it.
      ['/AppRun', 'serve', 'help']
    ]) {
      expect(argvRequestsServeMode(argv), argv.join(' ')).toBe(false)
      expect(normalizeServeModeArgv(argv)).toEqual(argv)
    }
    // A directory named `help` is a value, not a help request.
    expect(argvRequestsServeMode(['/AppRun', 'serve', '--user-data-dir', 'help'])).toBe(true)
    // Past an operator's terminator nothing is reinterpreted, help flags included.
    expect(argvRequestsServeMode(['/AppRun', 'serve', '--', '--help'])).toBe(true)
  })

  it('leaves real GUI launch argv alone', () => {
    // Why: a false positive here is the expensive direction — the window never opens and a runtime
    // server binds instead. These are the argv shapes the desktop actually receives.
    for (const argv of [
      ['/Applications/Orca.app/Contents/MacOS/Orca', '-psn_0_123456'],
      ['C:\\Program Files\\Orca\\Orca.exe', '--squirrel-firstrun'],
      ['C:\\Program Files\\Orca\\Orca.exe', 'orca://worktree/serve'],
      ['/opt/orca/orca-ide', '/home/u/serve'],
      // `--pairing-code` takes the next token, so its value is never the subcommand.
      ['/opt/orca/orca-ide', '--pairing-code', 'serve'],
      ['/opt/orca/orca-ide', '--environment=serve'],
      ['/opt/orca/orca-ide', '--', 'serve'],
      ['/opt/orca/orca-ide', 'Serve']
    ]) {
      expect(argvRequestsServeMode(argv), argv.join(' ')).toBe(false)
      expect(normalizeServeModeArgv(argv)).toEqual(argv)
    }
  })

  it('does not treat a later positional serve as the subcommand after another command', () => {
    expect(findServeSubcommandIndex(['app', 'status', 'serve'])).toBe(-1)
    expect(argvRequestsServeMode(['app', 'status', 'serve'])).toBe(false)
  })

  it('keeps Electron-injected Chromium switches while normalizing direct serve', () => {
    expect(
      normalizeServeModeArgv([
        '/opt/orca/orca-ide',
        '--disable-features=FedCm,DirectSockets',
        'serve',
        '--json'
      ])
    ).toEqual([
      '/opt/orca/orca-ide',
      '--disable-features=FedCm,DirectSockets',
      '--serve',
      '--serve-json'
    ])
  })

  it('leaves a non-serve launch untouched', () => {
    const argv = ['orca', '--no-sandbox', '/home/u/project']
    expect(argvRequestsServeMode(argv)).toBe(false)
    expect(normalizeServeModeArgv(argv)).toEqual(argv)
  })

  it('does not splice prototype members onto argv for stray positionals', () => {
    expect(normalizeServeModeArgv(['/AppRun', 'serve', 'toString'])).toEqual([
      '/AppRun',
      '--serve',
      'toString'
    ])
  })

  it('passes args after `--` through verbatim', () => {
    expect(
      normalizeServeModeArgv(['/AppRun', 'serve', '--json', '--', '--user-data-dir', '1'])
    ).toEqual(['/AppRun', '--serve', '--serve-json', '--', '--user-data-dir', '1'])
  })

  it('never disagrees with itself about whether a launch is serve mode', () => {
    // Why exhaustive: index.ts asks `argvRequestsServeMode` and then reads `--serve` out of the
    // rewrite. If the two halves consume values differently one can swallow the `serve` token the
    // other is rewriting, and the launch boots a desktop window with every serve flag dropped —
    // #12677 again. Found by fuzzing `--user-data-dir --user-data-dir serve` and `--user-data-dir -- serve`.
    const alphabet = [
      'serve',
      '--serve',
      '--json',
      '--pairing-code',
      '--user-data-dir',
      '--',
      '-h',
      'help',
      'value',
      '--user-data-dir=1'
    ]
    const disagreements: string[][] = []
    const walk = (tail: string[]): void => {
      const argv = ['/AppRun', ...tail]
      if (argvRequestsServeMode(argv) !== normalizeServeModeArgv(argv).includes('--serve')) {
        disagreements.push(argv)
      }
      if (tail.length === 4) {
        return
      }
      for (const token of alphabet) {
        walk([...tail, token])
      }
    }
    walk([])

    expect(disagreements).toEqual([])
  })
})
