import process from 'node:process'
import { pathToFileURL } from 'node:url'

const isProductSource = (file) => !/\.test\.tsx?$/.test(file)

// Why config/patches: the xterm fork owns the helper textarea an input method attaches to, so a
// patch edit can break composition without touching a file named "ime".
const NATIVE_IME_PRODUCT_SOURCE =
  /^(?:config\/patches\/|src\/shared\/terminal-unicode-provider\.ts$|src\/renderer\/src\/lib\/pane-manager\/terminal-ime-|src\/renderer\/src\/components\/terminal-pane\/(?:terminal-ime-|terminal-ios-hangul-|xterm-bypass-policy))/

/** The harness itself: the session runner, the boundary probes, and the native specs. */
const NATIVE_IME_HARNESS =
  /^(?:config\/scripts\/focus-nested-wayland-terminal\.sh$|config\/scripts\/(?:run-terminal-ibus-hangul-e2e|terminal-ime-engagement-receipt)\.mjs$|tests\/e2e\/terminal-ime-(?:boundary-probe|byte-reader|engagement-receipt)\.ts$|tests\/e2e\/terminal-(?:ibus-hangul|hangul-terminating-digit|macos-2set-korean)-native\.spec\.ts$)/

export const PR_E2E_SOURCE_ROUTES = [
  {
    id: 'terminal.windows-wsl-launch-and-paste',
    specs: [
      'tests/e2e/golden-tab-bar-agent-launch.spec.ts',
      'tests/e2e/terminal-windows-shell-paste-ownership.spec.ts'
    ],
    matches: (file) =>
      isProductSource(file) &&
      /^(?:config\/scripts\/(?:verify-wsl-e2e-participation|verify-playwright-participation)\.mjs$|src\/main\/(?:wsl[/-]|pty\/.*wsl|providers\/wsl)|src\/shared\/(?:wsl-|windows-terminal-shell)|src\/renderer\/src\/.*(?:terminal-paste|pty-paste)|tests\/e2e\/(?:golden-tab-bar-agent-launch\.spec|terminal-windows-shell-paste-ownership\.spec|helpers\/(?:wsl-golden-stub-agent|golden-stub-agent))|\.github\/(?:actions\/setup-wsl-test-runtime\/|workflows\/windows-wsl-e2e\.yml))/.test(
        file
      )
  },
  {
    id: 'terminal-input.ime-and-synthetic-forwarding',
    specs: [
      'tests/e2e/terminal-cjk-ime-committed-text.spec.ts',
      'tests/e2e/terminal-hangul-wrap-boundary-bytes.spec.ts',
      'tests/e2e/terminal-ime-exact-byte.spec.ts',
      'tests/e2e/terminal-korean-composing-chord-order.spec.ts',
      'tests/e2e/terminal-korean-endofrow-preedit-cell-span.spec.ts',
      'tests/e2e/terminal-korean-midline-preedit-occlusion.spec.ts',
      'tests/e2e/terminal-korean-preedit-visibility.spec.ts'
    ],
    matches: (file) =>
      isProductSource(file) &&
      /^(?:config\/patches\/|src\/renderer\/src\/components\/terminal-pane\/(?:terminal-ime-|use-terminal-pane-lifecycle|xterm-bypass-policy|terminal-option-shortcut-policy))/.test(
        file
      )
  },
  {
    // Why a route beside terminal-input.ime-and-synthetic-forwarding rather than more specs on
    // it: that route selects the CDP-synthetic specs, which drive composition through
    // Input.imeSetComposition and so prove Orca's handling without an input method existing.
    // This one names the surface only a real ibus-hangul session can judge, and is the sole
    // trigger that puts the real-IME lane on a PR.
    id: 'terminal-ime.native-input-method',
    specs: ['tests/e2e/terminal-ibus-hangul-native.spec.ts'],
    matches: (file) =>
      (isProductSource(file) && NATIVE_IME_PRODUCT_SOURCE.test(file)) ||
      NATIVE_IME_HARNESS.test(file)
  },
  {
    id: 'terminal-startup.quick-command-pre-bind-recovery',
    specs: ['tests/e2e/terminal-quick-command-pre-bind-recovery.spec.ts'],
    matches: (file) =>
      isProductSource(file) &&
      /^(?:src\/renderer\/src\/components\/tab-bar\/TabBarQuickCommandsMenu\.tsx|src\/renderer\/src\/hooks\/use-terminal-quick-command-hosts\.ts|src\/renderer\/src\/components\/terminal-pane\/(?:pty-connection|pty-transport|terminal-pty-pre-spawn-e2e-barrier)\.ts|src\/renderer\/src\/components\/terminal-pane\/pty-connection\/(?:connect-pane-pty|fresh-spawn-start|pane-pty-visibility-bind|pty-input-recovery)\.ts|src\/renderer\/src\/components\/terminal-pane\/(?:TerminalPane|use-terminal-pane-lifecycle)\.tsx?|src\/renderer\/src\/store\/slices\/terminals\.ts)$/.test(
        file
      )
  },
  {
    // Why a route of its own: every other terminal-pane route names what BINDS a pane — the pty
    // transports, the reconnect ledgers, the park watchers. Nothing named what unbinds one,
    // so the close/retire lifecycle reached main with e2e skipped outright. Unbinding is the half
    // that can strand a PTY or leave a retired leaf mounted as a blank pane.
    //
    // Deliberately absent: src/renderer/src/runtime/runtime-rpc-client.ts, the transport these
    // retirements call out through. It carries no close decision and churns ~3x these files, so
    // routing on it would run this lane on unrelated runtime work.
    id: 'terminal-pane.close-and-retirement',
    specs: [
      // Closing a tab whose pane is parked (never mounted) must retire that exact PTY.
      'tests/e2e/terminal-parked-close-retirement.spec.ts',
      // Closing one leaf of a split must leave root leaves, leaf→pty bindings, and live panes
      // agreeing — the ghost-blank-pane shape a bad unbind produces.
      'tests/e2e/terminal-pane-close-layout-consistency.spec.ts'
    ],
    matches: (file) =>
      isProductSource(file) &&
      /^(?:src\/renderer\/src\/components\/terminal-pane\/(?:retire-unbound-(?:ipc|runtime)-terminal-pane|terminal-pane-(?:close-admission|close-identity|lifecycle-close|pane-closed|retirement-ownership)|use-terminal-pane-close-actions)|src\/renderer\/src\/store\/(?:terminals\/terminal-tab-close(?:-providers)?|slices\/(?:terminal-tab-retirement|terminal-retirement-teardown-reservation|retired-terminal-tab-state-sweep)))\.ts$/.test(
        file
      )
  },
  {
    id: 'terminal-session.parked-cli-split',
    specs: ['tests/e2e/terminal-parked-cli-split.spec.ts'],
    matches: (file) =>
      isProductSource(file) &&
      /^(?:src\/main\/window\/attach-main-window-services\.ts|src\/preload\/(?:index|api\/ui-command-event-api)\.ts|src\/renderer\/src\/components\/terminal-pane\/(?:terminal-pane-split-request-routing|use-terminal-pane-lifecycle|use-terminal-tab-cold-parking)\.ts|src\/renderer\/src\/hooks\/ipc-events\/terminal-ui-routing-ipc-bridge\.ts)$/.test(
        file
      )
  }
]

export function selectPrE2eSpecs(changedPaths, reportRoute = () => undefined) {
  const specs = new Set(changedPaths.filter((file) => /^tests\/e2e\/.*\.spec\.ts$/.test(file)))
  for (const route of PR_E2E_SOURCE_ROUTES) {
    const matchedFiles = changedPaths.filter(route.matches)
    if (matchedFiles.length === 0) {
      continue
    }
    route.specs.forEach((spec) => specs.add(spec))
    reportRoute(`[pr-e2e] ${route.id}: ${route.specs.join(', ')}`)
  }
  return [...specs].sort((left, right) => left.localeCompare(right))
}

/** Routes whose authorities a real input method can judge, and so require the native IME lane. */
export const NATIVE_IME_SOURCE_ROUTE_IDS = ['terminal-ime.native-input-method']

// Why derived from the routes: the native lane must trigger on IME
// source, not on the native spec surviving in some route's spec list.
export function hasNativeImeSourceChange(changedPaths) {
  return PR_E2E_SOURCE_ROUTES.filter((route) =>
    NATIVE_IME_SOURCE_ROUTE_IDS.includes(route.id)
  ).some((route) => changedPaths.some(route.matches))
}

export function shouldRunReusablePrE2e(changedPaths) {
  // Native IME has its own workflow.
  return selectPrE2eSpecs(changedPaths).some(
    (spec) => spec !== 'tests/e2e/terminal-ibus-hangul-native.spec.ts'
  )
}

export function hasWslSourceChange(changedPaths) {
  const route = PR_E2E_SOURCE_ROUTES.find(
    (candidate) => candidate.id === 'terminal.windows-wsl-launch-and-paste'
  )
  return changedPaths.some(route.matches)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let input = ''
  process.stdin.setEncoding('utf8')
  for await (const chunk of process.stdin) {
    input += chunk
  }
  const changedPaths = input.split(/\r?\n/).filter(Boolean)
  if (process.argv.includes('--reusable-workflow')) {
    process.stdout.write(`${shouldRunReusablePrE2e(changedPaths)}\n`)
  } else if (process.argv.includes('--wsl-source')) {
    process.stdout.write(`${hasWslSourceChange(changedPaths)}\n`)
  } else if (process.argv.includes('--native-ime-source')) {
    process.stdout.write(`${hasNativeImeSourceChange(changedPaths)}\n`)
  } else {
    const specs = selectPrE2eSpecs(changedPaths, (message) => console.error(message))
    process.stdout.write(`${JSON.stringify(specs)}\n`)
  }
}
