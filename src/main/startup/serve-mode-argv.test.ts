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

  it('skips a space-separated Chromium switch value while locating serve', () => {
    const argv = ['/AppRun', '--disable-features', 'Vulkan', 'serve', '--project-root', '/srv/repo']
    expect(findServeSubcommandIndex(argv)).toBe(3)
    expect(normalizeServeModeArgv(argv)).toEqual([
      '/AppRun',
      '--disable-features',
      'Vulkan',
      '--serve',
      '--serve-project-root',
      '/srv/repo'
    ])
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
    expect(argvRequestsServeMode(['/AppRun', 'serve', '--project-root', 'help'])).toBe(true)
    // Past an operator's terminator nothing is reinterpreted, help flags included.
    expect(argvRequestsServeMode(['/AppRun', 'serve', '--', '--help'])).toBe(true)
  })

  it('does not turn `--recipe-json=false` into recipe-json', () => {
    // Why: the CLI reads serve booleans as `=== true`, so `=false` is not recipe-json there either.
    expect(normalizeServeModeArgv(['/AppRun', 'serve', '--recipe-json=false'])).toEqual([
      '/AppRun',
      '--serve',
      '--recipe-json=false'
    ])
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

  it('rewrites CLI-form serve flags into --serve* form', () => {
    expect(
      normalizeServeModeArgv([
        '/AppRun',
        'serve',
        '--json',
        '--recipe-json',
        '--project-root',
        '/srv/repo'
      ])
    ).toEqual([
      '/AppRun',
      '--serve',
      '--serve-json',
      '--serve-recipe-json',
      '--serve-project-root',
      '/srv/repo'
    ])
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

  it('leaves already-normalized argv unchanged', () => {
    // Why every value flag: the CLI's own `orca serve` spawns the app with exactly this shape
    // (serveOrcaApp), and the rewrite runs over it too — a bad mapping would drop a flag here.
    const argv = [
      'orca',
      '--serve',
      '--serve-json',
      '--serve-recipe-json',
      '--serve-project-root',
      '/srv/repo'
    ]
    expect(normalizeServeModeArgv(argv)).toEqual(argv)
  })

  it('splits `--flag=value` CLI form, which getServeOptions cannot read', () => {
    expect(normalizeServeModeArgv(['/AppRun', 'serve', '--project-root=/srv/repo'])).toEqual([
      '/AppRun',
      '--serve',
      '--serve-project-root',
      '/srv/repo'
    ])
  })

  it('keeps equals-form values that start with a flag marker intact', () => {
    expect(normalizeServeModeArgv(['/AppRun', 'serve', '--project-root=--odd'])).toEqual([
      '/AppRun',
      '--serve',
      '--serve-project-root=--odd'
    ])
  })

  it('translates serve flags in the mixed `--serve --project-root` form', () => {
    expect(normalizeServeModeArgv(['orca', '--serve', '--project-root', '/srv/repo'])).toEqual([
      'orca',
      '--serve',
      '--serve-project-root',
      '/srv/repo'
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
      normalizeServeModeArgv(['/AppRun', 'serve', '--json', '--', '--project-root', '1'])
    ).toEqual(['/AppRun', '--serve', '--serve-json', '--', '--project-root', '1'])
  })

  it('never disagrees with itself about whether a launch is serve mode', () => {
    // Why exhaustive: index.ts asks `argvRequestsServeMode` and then reads `--serve` out of the
    // rewrite. If the two halves consume values differently one can swallow the `serve` token the
    // other is rewriting, and the launch boots a desktop window with every serve flag dropped —
    // #12677 again. Found by fuzzing `--project-root --project-root serve` and `--project-root -- serve`.
    const alphabet = [
      'serve',
      '--serve',
      '--project-root',
      '--json',
      '--pairing-code',
      '--user-data-dir',
      '--',
      '-h',
      'help',
      'value',
      '--project-root=1',
      '--recipe-json=false'
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
