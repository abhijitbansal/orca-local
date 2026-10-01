# Local-only Orca — Spec A Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove every Orca-owned cloud egress and network ingress path (telemetry upload, updater, cloud account, mobile/relay/push, WebSocket listener/web client/serve network mode, sharing/deep links/registry installs, vendor usage polling, git-provider APIs, renderer remote loads), keep telemetry local, and add a guard so upstream merges stay mechanical.

**Architecture:** This is hard removal. Whole files and directories are deleted (Tier 1). In shared registration files, lines are deleted, never rewritten (Tier 2). A new `check-local-only` guard script, wired into `pnpm lint`, turns any regression after an upstream merge into a named lint failure (Tier 3). The telemetry transport becomes a JSONL file through the existing `observability/local-file-sink.ts`.

**Tech Stack:** Electron, electron-vite, React, TypeScript, vitest, oxlint, pnpm 12 (`npx -y pnpm@12.0.0` when pnpm is not on PATH).

**Spec:** `docs/local-only/2026-10-01-local-only-spec-a-design.md`

## Global Constraints

- Branch `local-only/spec-a`. Each task is one commit and leaves `pnpm tc` green. A task must add no test-file failures beyond the 24 recorded in `notes/local-only/before/failing-files.txt`.
- Commit trailer (verbatim): `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` and `Claude-Session: https://claude.ai/code/session_01PskLbdTqJNXxJ7KRnDoDoD`. Commits are authorized. Pushing is NOT authorized for implementer agents.
- Keep: local terminals, agents, worktrees, folder workspaces, the git CLI (fetch/push/clone), the embedded browser pane (unrestricted), the Mobile Emulator dev tool (`src/main/emulator`), local usage stats from session files, local crash capture, speech-model and scrcpy downloads, WSL, and SSH. SSH is Spec B; do not remove it here.
- Never add `max-lines` disables. Never delete ratchet tests; update their counts or entries instead (`global-fetch-call-site-audit.test.ts`, `websocket-server-loopback-bind.test.ts`, `config/reliability-gates.jsonc`, `config/max-lines-baseline.txt`).
- Line numbers in tasks were read at commit `2a31641ee3`. Earlier tasks shift them. Before deleting, always re-anchor on the quoted content with `rg -n`, and delete bottom-up within a file.
- Localization: after removing renderer strings, run `pnpm run verify:localization-catalogs`, `verify:localization-extraction` and `verify:localization-coverage`. If they fail on keys that are now orphaned or extra, prune those keys from all six locale JSONs with the snippet in the U1/U2/U4/U9 conventions block, then run `pnpm run sync:localization-runtime-catalog`. If the gates pass, leave the catalogs alone.
- RPC contract edits: run `pnpm run generate:rpc-params-catalog`, then `pnpm run verify:rpc-params-catalog`.
- Verification per task: `pnpm tc`, then `pnpm test <listed paths>`, then `pnpm run check:code-quality:changed`, then `pnpm run check:local-only`. The violation count must not rise.
- Run apps and e2e only with `ORCA_BACKGROUND_LAUNCH=1`. Never show or focus windows.
- A task named as an owner in Review Focus must add the test that item names, in that task's own commit.

## Review Focus

1. **Upgrading from an upstream build with persisted state.** A persisted `activeView` of `'artifacts'`/`'tasks'`, `cloud-linked` profiles, `starNag*` and update UI fields, `groupBy: 'pr'`, and mobile pairing settings must all hydrate without a crash and fall back to defaults. Owners: U8.4 (artifacts view), U5.1 (cloud-linked profiles), U10.1 (tasks view, PR grouping). Each owner adds a hydration test that feeds the legacy value and asserts the fallback.
2. **Startup with the WebSocket listener gone.** The app must boot, and the `orca` CLI must work over the Unix socket or named pipe (`orca status` reports the app version). The `ORCA_APP_VERSION` env must be set in plain-Node orcad as well. Owners: U7.2 and U3.1. Run `ORCA_BACKGROUND_LAUNCH=1` app launch plus `orca status` in the Z.3 acceptance step.
3. **CSP versus real renderer features.** Monaco workers, pdf.js wasm, vscode-oniguruma, mermaid, xterm and dev-mode React refresh must keep working, and the `<webview>` browser pane must be unaffected. Owner: U11.3, whose runtime check is repeated in Z.3.
4. **Telemetry consent off.** When consent is off, nothing is written to `telemetry.ndjson`. When consent is on, records go to the file and the file is size-capped by the sink. Owner: U1.1, which includes the consent-off test.
5. **SSH stays functional until Spec B.** U7.3 makes `orca serve --recipe-json` and the SSH orcad deploy paths runtime-dead. The SSH terminal and file features that do not use orcad must still work. Owner: U7.3, which documents the dead paths in the Z.4 summary.

## Execution order

Tasks are grouped below by planner group, but they MUST run in this global order, which encodes the cross-unit dependencies the planners reported:

| # | Task | Why here |
|---|---|---|
| 1 | Task 0 (guard) | Baseline measurement for all later tasks |
| 2 | U12.1 (`cloud/`, cloud CI) | Independent; whole-dir delete |
| 3–6 | U3.1 → U3.2 → U3.3 → U3.4 (updater) | Must land before U4/U6/U7 (shared quit/preflight/menu edits) and before U10.4 (`gh-rate-limit-breaker` importer) |
| 7 | U7.1 (web client) | Makes later web-stub steps no-ops; must land before U11 (`web-index.html`) |
| 8–11 | U6.1 → U6.2 → U6.3 → U6.4 (mobile) | Unwire pairing consumers before U7.2; must land before U5 |
| 12–13 | U7.3 → U7.2 (serve network mode, then the WS listener) | U7.3 replaces callers before U7.2 deletes them |
| 14–16 | U1.1 → U1.2 → U1.3 (telemetry) | U1.2 must precede U2.1 (`electron.vite.config.ts`) |
| 17–18 | U2.1 → U2.2 (feedback/diagnostics) | Must land before U10.1 (`gh.viewer` callers) |
| 19–20 | U4.1 → U4.2 (star nag) | Must land before U10 (`github/client` star calls) |
| 21–24 | U9.3 → U9.1 → U9.2 → U9.4 (vendor usage) | U9.3 removes the last caller of the reset-credit method |
| 25–28 | U8.1 → U8.2 → U8.3 → U8.4 (sharing/deep links/plugins) | U8.3 before U8.4 (`artifact-cloud-config` importers) |
| 29–31 | U5.1 → U5.2 → U5.3 (Orca Cloud account) | After U6 and U8, which import profile-cloud modules |
| 32–35 | U10.1 → U10.2 → U10.3 → U10.4 (provider APIs) | Consumers first, providers last |
| 36–38 | U11.1 → U11.2 → U11.3 (renderer remote loads, CSP) | After U10 (avatar code gone) and U7.1 |
| 39–42 | Z.1 → Z.2 → Z.3 → Z.4 | Clean guard into lint, docs, after-scans, summary |

---

### Task 0: Local-only guard script (`check-local-only`)

The guard comes first so every later task can measure progress against it. It is NOT wired into `pnpm lint` until Task Z.1, when the tree is clean.

**Files:**
- Create: `config/scripts/check-local-only.mjs`
- Create: `config/scripts/check-local-only.test.mjs`
- Create: `config/local-only-allowlist.txt`
- Modify: `package.json` (scripts: add `"check:local-only": "node config/scripts/check-local-only.mjs"`; it does not join `lint` yet)

**Interfaces:**
- Consumes: none
- Produces: `scanLocalOnly({ rootDir, allowlist }) => Violation[]`, where `Violation = { file: string, line: number, rule: 'forbidden-host'|'forbidden-import'|'forbidden-dependency'|'builder-publish'|'builder-protocols'|'wildcard-bind', match: string }`; `readAllowlist(rootDir) => Set<string>` (entries `path:rule`); `main()` prints violations and sets `process.exitCode = 1` when any remain. Every later task runs `pnpm run check:local-only` and expects the violation count to fall.

- [ ] **Step 1: Write the failing test**

```js
// config/scripts/check-local-only.test.mjs
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { scanLocalOnly } from './check-local-only.mjs'

const roots = []
function fixture(files) {
  const root = mkdtempSync(path.join(tmpdir(), 'orca-local-only-'))
  roots.push(root)
  for (const [rel, body] of Object.entries(files)) {
    const target = path.join(root, rel)
    mkdirSync(path.dirname(target), { recursive: true })
    writeFileSync(target, body)
  }
  return root
}
const minimalPackage = JSON.stringify({ dependencies: {}, devDependencies: {} })
const minimalBuilder = 'module.exports = { appId: "x" }\n'
function base(extra) {
  return fixture({ 'package.json': minimalPackage, 'config/electron-builder.config.cjs': minimalBuilder, ...extra })
}
afterEach(() => { for (const r of roots.splice(0)) rmSync(r, { recursive: true, force: true }) })

describe('scanLocalOnly', () => {
  it('returns no violations for a clean tree', () => {
    expect(scanLocalOnly({ rootDir: base({ 'src/main/a.ts': 'const x = "http://127.0.0.1:1"\n' }), allowlist: new Set() })).toEqual([])
  })

  it('flags an Orca cloud hostname in source', () => {
    const v = scanLocalOnly({ rootDir: base({ 'src/main/a.ts': 'x\nconst u = "https://api.onorca.dev/v1"\n' }), allowlist: new Set() })
    expect(v).toEqual([{ file: 'src/main/a.ts', line: 2, rule: 'forbidden-host', match: 'onorca.dev' }])
  })

  it('ignores test files and fixtures', () => {
    const root = base({ 'src/main/a.test.ts': 'https://us.i.posthog.com', 'src/main/__fixtures__/b.ts': 'https://onorca.dev' })
    expect(scanLocalOnly({ rootDir: root, allowlist: new Set() })).toEqual([])
  })

  it('flags forbidden imports and dependencies', () => {
    const root = fixture({
      'package.json': JSON.stringify({ dependencies: { 'posthog-node': '1' }, devDependencies: {} }),
      'config/electron-builder.config.cjs': minimalBuilder,
      'src/main/u.ts': "import { autoUpdater } from 'electron-updater'\n"
    })
    const rules = scanLocalOnly({ rootDir: root, allowlist: new Set() }).map((v) => v.rule).sort()
    expect(rules).toEqual(['forbidden-dependency', 'forbidden-import'])
  })

  it('flags electron-builder publish and protocols blocks', () => {
    const root = base({})
    writeFileSync(path.join(root, 'config/electron-builder.config.cjs'), 'module.exports = {\n  publish: [],\n  protocols: [{ schemes: ["orca"] }]\n}\n')
    const rules = scanLocalOnly({ rootDir: root, allowlist: new Set() }).map((v) => v.rule).sort()
    expect(rules).toEqual(['builder-protocols', 'builder-publish'])
  })

  it('flags wildcard bind literals', () => {
    const v = scanLocalOnly({ rootDir: base({ 'src/main/s.ts': "server.listen(0, '0.0.0.0')\n" }), allowlist: new Set() })
    expect(v.map((x) => x.rule)).toEqual(['wildcard-bind'])
  })

  it('honours path:rule allowlist entries', () => {
    const root = base({ 'src/main/a.ts': 'https://onorca.dev' })
    expect(scanLocalOnly({ rootDir: root, allowlist: new Set(['src/main/a.ts:forbidden-host']) })).toEqual([])
  })
})
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `pnpm test config/scripts/check-local-only.test.mjs`
Expected: FAIL. The output says `Failed to load url ./check-local-only.mjs` or `Cannot find module`.

- [ ] **Step 3: Write the minimal implementation**

```js
#!/usr/bin/env node
// Local-only fork gate: fails when cloud egress, cloud SDKs, publish/deep-link config, or wildcard binds reappear (e.g. after an upstream merge).
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

export const FORBIDDEN_HOSTS = [
  'onorca.dev',
  'posthog.com',
  'api.github.com',
  'uploads.github.com',
  'github.com/stablyai/orca',
  'gitlab.com/api',
  'api.bitbucket.org',
  'dev.azure.com',
  'atlassian.net',
  'api.linear.app',
  'api.anthropic.com',
  'console.anthropic.com',
  'chatgpt.com/backend-api'
]
export const FORBIDDEN_MODULES = ['posthog-node', 'posthog-js', 'electron-updater', '@octokit/', '@sentry/']
const SCANNED_ROOTS = ['src']
const SCANNED_EXTENSIONS = /\.(?:ts|tsx|mts|cts|js|mjs|cjs)$/
const SKIPPED_FILE = /\.(?:test|spec)\.[cm]?[jt]sx?$/
const SKIPPED_DIRS = new Set(['node_modules', 'out', 'dist', 'build', '__fixtures__', '__mocks__', '.git'])
const WILDCARD_BIND = /['"](?:0\.0\.0\.0|::)['"]/

function collect(dir, found) {
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return found
  }
  for (const entry of entries) {
    if (SKIPPED_DIRS.has(entry.name)) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) collect(full, found)
    else if (SCANNED_EXTENSIONS.test(entry.name) && !SKIPPED_FILE.test(entry.name)) found.push(full)
  }
  return found
}

function scanSource(rootDir, file) {
  const rel = path.relative(rootDir, file).split(path.sep).join('/')
  const violations = []
  readFileSync(file, 'utf8').split('\n').forEach((text, index) => {
    const line = index + 1
    for (const host of FORBIDDEN_HOSTS) {
      if (text.includes(host)) violations.push({ file: rel, line, rule: 'forbidden-host', match: host })
    }
    const specifier = /(?:from\s*|import\(\s*|require\(\s*)['"]([^'"]+)['"]/.exec(text)?.[1]
    const module = specifier && FORBIDDEN_MODULES.find((m) => specifier === m || specifier.startsWith(m.endsWith('/') ? m : `${m}/`))
    if (module) violations.push({ file: rel, line, rule: 'forbidden-import', match: specifier })
    if (WILDCARD_BIND.test(text)) violations.push({ file: rel, line, rule: 'wildcard-bind', match: WILDCARD_BIND.exec(text)[0] })
  })
  return violations
}

function scanPackage(rootDir) {
  const pkg = JSON.parse(readFileSync(path.join(rootDir, 'package.json'), 'utf8'))
  const names = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies, ...pkg.optionalDependencies })
  return names
    .filter((name) => FORBIDDEN_MODULES.some((m) => name === m || (m.endsWith('/') && name.startsWith(m))))
    .map((name) => ({ file: 'package.json', line: 0, rule: 'forbidden-dependency', match: name }))
}

function scanBuilder(rootDir) {
  const rel = 'config/electron-builder.config.cjs'
  const violations = []
  readFileSync(path.join(rootDir, rel), 'utf8').split('\n').forEach((text, index) => {
    if (/^\s*publish\s*:/.test(text)) violations.push({ file: rel, line: index + 1, rule: 'builder-publish', match: 'publish' })
    if (/^\s*protocols\s*:/.test(text)) violations.push({ file: rel, line: index + 1, rule: 'builder-protocols', match: 'protocols' })
  })
  return violations
}

export function readAllowlist(rootDir) {
  let text = ''
  try {
    text = readFileSync(path.join(rootDir, 'config/local-only-allowlist.txt'), 'utf8')
  } catch {
    return new Set()
  }
  return new Set(text.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#')))
}

export function scanLocalOnly({ rootDir, allowlist }) {
  const sources = SCANNED_ROOTS.flatMap((root) => collect(path.join(rootDir, root), []))
  return [...sources.flatMap((file) => scanSource(rootDir, file)), ...scanPackage(rootDir), ...scanBuilder(rootDir)].filter(
    (v) => !allowlist.has(`${v.file}:${v.rule}`)
  )
}

export function main(rootDir = process.cwd()) {
  const violations = scanLocalOnly({ rootDir, allowlist: readAllowlist(rootDir) })
  for (const v of violations) console.error(`${v.file}:${v.line} [${v.rule}] ${v.match}`)
  if (violations.length > 0) {
    console.error(`\ncheck-local-only: ${violations.length} violation(s). See docs/reference/local-only-upstream-sync.md.`)
    process.exitCode = 1
  } else {
    console.log('check-local-only: clean')
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main()
```

`config/local-only-allowlist.txt` starts with only a header:

```
# path:rule entries exempt from config/scripts/check-local-only.mjs.
# Every entry needs a one-line justification comment above it. Keep this list short.
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `pnpm test config/scripts/check-local-only.test.mjs`
Expected: PASS (7 tests).

- [ ] **Step 5: Record the starting violation count**

Run: `pnpm run check:local-only 2>&1 | tail -1 | tee notes/local-only/before/check-local-only.txt`
Expected: `check-local-only: N violation(s)` with N > 0. That is the baseline, and each later task lowers it.

- [ ] **Step 6: Commit**

```bash
git add config/scripts/check-local-only.mjs config/scripts/check-local-only.test.mjs config/local-only-allowlist.txt package.json
git commit -m "feat(local-only): add check-local-only guard script

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01PskLbdTqJNXxJ7KRnDoDoD"
```

---

## Planner group: U11-U12-U3

## Unit U3 — Auto-updater (hard removal)

Cut boundary (decided after reading the code, see Risks for the reasoning):
- Deleted in U3: the main-process updater engine and every fetcher, the updater IPC and RPC handlers, the Linux package-recovery helpers, the local-build feed, the preload `updater` API, the renderer update UI and UI-store update state, `release-channel.ts`, `dev-app-update.yml`, `Casks/`, the electron-builder `publish` block and the `electron-updater` dependency.
- Kept for U7/Spec B (hand-off, listed in orderingDependencies): the renderer *client* for updating a remote Orca server (`src/renderer/src/runtime/remote-server-*`, `store/slices/remote-server-updates.ts`, `settings/RemoteServerUpdate*`, `GeneralRemoteServerUpdates.tsx`, `status-bar/RemoteServerUpdateStatusSegment.tsx`, `shared/remote-server-update.ts`, `lib/update-check-click-options.ts`) and the app-restart plumbing that still carries updater-named constants (`shared/updater-renderer-events.ts`, `shared/renderer-restart-preparation.ts`, `preload/renderer-restart-wiring.ts`, `preload/preload-runtime-support.ts`, `renderer/src/lib/updater-beforeunload.ts`). None of these opens a socket; the remote client talks only over Orca's own RPC to a host that no longer registers `updater.*`.
- `src/shared/update-status-types.ts` survives trimmed (its `UpdateStatus` type is still consumed by the restart relay and the remote-server client).

### Task U3.1: Delete the main-process updater engine, fetchers, IPC/RPC handlers and the menu/tray/quit entry points
**Files:**
Delete (Tier 1, `git rm`):
- `src/main/updater.ts`
- `src/main/updater/` (whole dir: updater-build-selection.ts, updater-check-failure.ts, updater-check-state.ts, updater-download-install.ts, updater-install-execution.ts, updater-install-support.ts, updater-menu-checks.ts, updater-nudge.ts, updater-package-recovery.ts, updater-release-feed.ts, updater-remote-status.ts, updater-scheduling.ts, updater-setup.ts, updater-state.ts, updater-status.ts, updater-types.ts)
- `src/main/updater-changelog.ts`, `src/main/updater-changelog.test.ts`, `src/main/updater-events.ts`, `src/main/updater-events.test.ts`, `src/main/updater-fallback.ts`, `src/main/updater-lifecycle-diagnostics.ts`, `src/main/updater-lifecycle-diagnostics.test.ts`, `src/main/updater-linux-package-recovery-actions.test.ts`, `src/main/updater-mac-install.ts`, `src/main/updater-net-request.fixture.ts`, `src/main/updater-nudge.ts`, `src/main/updater-nudge.test.ts`, `src/main/updater-prerelease-feed.ts`, `src/main/updater-prerelease-feed.test.ts`, `src/main/updater-prerelease-feed-readiness.test.ts`, `src/main/updater-prerelease-feed-reproduction.fixture.ts`, `src/main/updater-release-api-token.ts`, `src/main/updater-release-api-token.test.ts`, `src/main/updater-release-build-cache.ts`, `src/main/updater-release-build-cache.test.ts`, `src/main/updater-release-builds.ts`, `src/main/updater-release-builds.test.ts`, `src/main/updater-test-harness.ts`, `src/main/updater-test-module-loader.ts`, `src/main/updater-test-module-loader.test.ts`, `src/main/updater-test-timer-tracking.ts`
- `src/main/updater.build-channel-selection.test.ts`, `src/main/updater.check-failure.test.ts`, `src/main/updater.check-preflight.test.ts`, `src/main/updater.check-settlement.test.ts`, `src/main/updater.fallback.test.ts`, `src/main/updater.feed-attempt-lifetime.test.ts`, `src/main/updater.headless-serve-install.test.ts`, `src/main/updater.install-failure-cause.test.ts`, `src/main/updater.linux-externally-managed.test.ts`, `src/main/updater.linux-root-package-install.test.ts`, `src/main/updater.mac-install.test.ts`, `src/main/updater.nudge-campaign.test.ts`, `src/main/updater.prerelease-fallback.test.ts`, `src/main/updater.publishing-window-feed.test.ts`, `src/main/updater.quit-and-install.test.ts`, `src/main/updater.startup-scheduling.test.ts`
- `src/main/electron-updater-loader.ts`
- `src/main/window/main-window-updater.ts`, `src/main/window/updater-package-recovery-ipc.test.ts`
- `src/main/runtime/rpc/methods/updater.ts`, `src/main/runtime/rpc/methods/updater.test.ts`, `src/main/runtime/remote-server-updater.ts`, `src/main/runtime/remote-server-updater.test.ts`
- `src/shared/rpc-contract/updater-params.ts`
- `src/main/local-builds/` (whole dir: local-build-candidate.ts, local-build-candidate.test.ts, local-build-compatibility.ts, local-build-compatibility-contract.test.ts, local-build-feed-server.ts, local-build-feed-server.test.ts, local-build-switch.ts) — the loopback local-build feed only ever fed electron-updater
- `src/main/linux-package-update-recovery.ts`, `src/main/linux-package-update-recovery.test.ts`, `src/main/linux-package-install-diagnostic.ts`, `src/main/linux-package-install-diagnostic.test.ts`, `src/main/linux-update-package-type.ts`, `src/main/linux-update-package-type.test.ts`, `src/main/linux-package-install-command.ts`, `src/main/linux-package-install-command.test.ts`, `src/main/linux-package-downloaded-status.ts` (verified: no importer outside the updater cluster)
- `src/main/update-install-exit-watchdog.ts`, `src/main/update-install-exit-watchdog.test.ts`
Modify (Tier 2, line deletions only unless stated):
- `src/main/window/attach-main-window-services.ts`:27,38,42,66-68,127
- `src/main/window/attach-main-window-services.test.ts`:23,48,117-123,297-341
- `src/main/startup/main-window-core-services.ts`:5,129-134
- `src/main/startup/main-window-core-services.test.ts`:57,84-113
- `src/main/startup/main-window-lifecycle-flags.ts`:4,21
- `src/main/startup/main-process-quit.ts`:27-28,71-75,117-124
- `src/main/startup/main-process-preflight.ts`:26-33,159-164,172-177
- `src/main/startup/browser-process-user-agent-ordering.test.ts`:87-94
- `src/main/startup/main-window-actions.ts`:2,5,11,49-51,73-76,89-92
- `src/main/startup/main-process-i18n-menu.ts`:13,18,31-34
- `src/main/menu/register-app-menu.ts`:8,31,52,91-114,153,337-338
- `src/main/menu/register-app-menu.test.ts`:40,174-(end of that `it`),407,418
- `src/main/tray/system-tray.ts`:21-22,275-278
- `src/main/tray/system-tray.test.ts`:136,234,244
- `src/main/ipc/register-core-handlers/register-core-handlers.ts`:67,245
- `src/main/runtime/rpc/methods/index.ts`:45,105
- `src/main/runtime/rpc/methods/status.ts`:2,12,16-17
- `src/main/observability/instrumentation.ts`:10,314-330
- `src/main/proxy-guarded-fetch-call-site-audit.test.ts`:11
- `src/shared/rpc-contract/rpc-params-catalog.generated.ts` (regenerated, not hand-edited)
Tests: `pnpm test src/main/window/attach-main-window-services.test.ts src/main/startup/main-window-core-services.test.ts src/main/startup/browser-process-user-agent-ordering.test.ts src/main/menu/register-app-menu.test.ts src/main/tray/system-tray.test.ts src/main/runtime/rpc/methods/status.test.ts src/main/runtime/mobile-rpc-allowlist.test.ts src/main/runtime/rpc/errors.test.ts src/main/proxy-guarded-fetch-call-site-audit.test.ts src/main/global-fetch-call-site-audit.test.ts src/main/crash-reporting/expected-teardown-state.test.ts`
**Interfaces:** Consumes: none. Produces: `status.get` RPC still returns `appVersion` (now from `process.env.ORCA_APP_VERSION`); no `updater.*` RPC methods, no `updater:*` IPC channels (U3.2 relies on both being gone), `SystemTrayOptions` and `RegisterAppMenuOptions` no longer have `onCheckForUpdates`.

- [ ] **Step 1: Delete the whole-file set.** Run from the repo root:
  ```bash
  git rm -r -q src/main/updater.ts src/main/updater src/main/updater-*.ts src/main/updater.*.test.ts src/main/electron-updater-loader.ts src/main/window/main-window-updater.ts src/main/window/updater-package-recovery-ipc.test.ts src/main/runtime/rpc/methods/updater.ts src/main/runtime/rpc/methods/updater.test.ts src/main/runtime/remote-server-updater.ts src/main/runtime/remote-server-updater.test.ts src/shared/rpc-contract/updater-params.ts src/main/local-builds src/main/linux-package-update-recovery.ts src/main/linux-package-update-recovery.test.ts src/main/linux-package-install-diagnostic.ts src/main/linux-package-install-diagnostic.test.ts src/main/linux-update-package-type.ts src/main/linux-update-package-type.test.ts src/main/linux-package-install-command.ts src/main/linux-package-install-command.test.ts src/main/linux-package-downloaded-status.ts src/main/update-install-exit-watchdog.ts src/main/update-install-exit-watchdog.test.ts
  ```
  Expected: `git status` shows ~90 deletions and nothing left matching `ls src/main/updater* src/main/local-builds src/main/linux-package-* src/main/linux-update-*`.
- [ ] **Step 2: `src/main/window/attach-main-window-services.ts`** — delete these exact lines:
  ```ts
  import type { PreQuitCleanupFailureMode, UpdateInstallMode } from '../updater'          // line 27
  import { scheduleMainWindowAutoUpdaterSetup } from './main-window-updater'             // line 38
  export { ensureAutoUpdaterConfigured, registerUpdaterHandlers } from './main-window-updater'  // line 42
      onBeforeUpdateQuit?: () => void | Promise<void>                                     // line 66
      onBeforeUpdateQuitFailure?: PreQuitCleanupFailureMode                               // line 67
      updateInstallMode?: UpdateInstallMode                                               // line 68
    scheduleMainWindowAutoUpdaterSetup(mainWindow, store, options)                        // line 127
  ```
- [ ] **Step 3: `src/main/window/attach-main-window-services.test.ts`** — delete line 23 (`setupAutoUpdaterMock,` in the hoisted destructure), line 48 (`setupAutoUpdaterMock: vi.fn(),`), lines 117-123 (the whole `vi.mock('../updater', () => ({ ... }))` block), and the two tests `it('passes injected update quit cleanup to the auto-updater', ...)` (lines 297-329) and `it('flushes the store before update quit when no cleanup is injected', ...)` (lines 331-341). Keep `it('replaces the TCC handlers when the main window is reattached', ...)` at line 343.
- [ ] **Step 4: `src/main/startup/main-window-core-services.ts`** — delete line 5 `import { resolveUpdateInstallMode } from '../updater'` and lines 129-134:
  ```ts
        onBeforeUpdateQuit: async () => {
          await preserveAgentAuthBeforeRestart({ codexRuntimeHome, claudeRuntimeAuth, store })
          await store.writeLatestProfileStateJsonCompatibilityExportAsync()
        },
        onBeforeUpdateQuitFailure: 'abort',
        updateInstallMode: resolveUpdateInstallMode(state.isServeMode),
  ```
  (`preserveAgentAuthBeforeRestart` stays imported: line 90 still uses it for the app-restart path.) In `src/main/startup/main-window-core-services.test.ts` delete line 57 (`vi.mock('../updater', ...)`) and the whole `it('publishes both recovery forms with one profile checkpoint before an update quit', ...)` block (lines 84-113). Keep the `preserveAgentAuthBeforeRestartMock` hoisted mock (other tests use it).
- [ ] **Step 5: `src/main/startup/main-window-lifecycle-flags.ts`** — delete line 4 `import { isQuittingForUpdate } from '../updater'`; replace line 21 `    isQuittingForUpdate: isQuittingForUpdate(),` with `    isQuittingForUpdate: false,` (the crash-reporting classifier keeps its parameter; no change to `expected-teardown-state.ts`).
- [ ] **Step 6: `src/main/startup/main-process-quit.ts`** — delete lines 27-28 (`import { isQuittingForUpdate } from '../updater'` and `import { recordUpdaterLifecycle } from '../updater-lifecycle-diagnostics'`), lines 71-75 (the `if (isQuittingForUpdate()) { recordUpdaterLifecycle('before_quit_allowed', ...) }` block) and lines 117-124 (`const updateQuitInProgress = isQuittingForUpdate()` through the closing `}` of its `if`).
- [ ] **Step 7: `src/main/startup/main-process-preflight.ts`** — delete lines 26-33:
  ```ts
  import { configureRemoteServerUpdater } from '../runtime/remote-server-updater'
  import {
    getRemoteServerUpdaterSnapshot,
    checkForRemoteServerUpdate,
    downloadRemoteServerUpdate,
    installRemoteServerUpdate,
    isQuittingForUpdate
  } from '../updater'
  ```
  Replace lines 159-164 with one line:
  ```ts
      activateWindow: () => options.focusExistingWindow(),
  ```
  Delete lines 172-177 (`configureRemoteServerUpdater({ ... })`). In `src/main/startup/browser-process-user-agent-ordering.test.ts` delete lines 87-94 (the `vi.mock('../runtime/remote-server-updater', ...)` line and the `vi.mock('../updater', ...)` block).
- [ ] **Step 8: `src/main/startup/main-window-actions.ts`** — delete line 2 (`import type { UpdateCheckOptions } ...`), line 5 (`import { checkForUpdatesFromMenu, isQuittingForUpdate } from '../updater'`), line 11 (`import { ensureAutoUpdaterConfigured } ...`); replace lines 49-51 (`if (!isQuittingForUpdate()) { openWindow() }`) with `  openWindow()`; delete lines 73-76 (`export function runUserInitiatedUpdateCheck(...) {...}`) and lines 89-92 (`onCheckForUpdates: () => { showMainWindowFromTray(); runUserInitiatedUpdateCheck() },`).
- [ ] **Step 9: `src/main/startup/main-process-i18n-menu.ts`** — delete line 13 (`runUserInitiatedUpdateCheck,`), line 18 (`import { ensureAutoUpdaterConfigured } ...`) and lines 31-34 (`onCheckForUpdates: (options) => { ... },`).
- [ ] **Step 10: `src/main/menu/register-app-menu.ts`** — delete line 8 (`import type { UpdateCheckOptions } ...`), line 31 (`onCheckForUpdates: (options: UpdateCheckOptions) => void`), line 52 (`onCheckForUpdates,`), lines 91-114 (the modifier-click comment, `checkForUpdatesClick` and `checkForUpdatesItem`), line 153 (`checkForUpdatesItem,` in the mac app menu), and lines 337-338 (`{ role: 'about' },` + `checkForUpdatesItem`) replacing them with the single line `            { role: 'about' }`. In `src/main/menu/register-app-menu.test.ts` delete line 40 (`onCheckForUpdates: vi.fn(),`), the whole `it('routes Check for Updates modifier clicks to prerelease and perf checks', ...)` block starting at line 174 (through its closing `})`), line 407 (`'Check for Updates...'` in the Help expectation; the preceding line 406 loses its trailing comma) and change line 418 to `expect(appLabels).toEqual(expect.arrayContaining(['Settings']))`.
- [ ] **Step 11: `src/main/tray/system-tray.ts`** — delete lines 21-22 (`/** Run the existing user-initiated update check. */` + `onCheckForUpdates: () => void`) and lines 275-278 (the `{ label: translateMain('menu.checkForUpdates', ...), click: ... },` menu item). In `src/main/tray/system-tray.test.ts` delete line 136 (`onCheckForUpdates: vi.fn(),`), line 234 (`'Check for Updates...',`) and line 244 (`['Check for Updates...', options.onCheckForUpdates],`).
- [ ] **Step 12: Registration files** — `src/main/ipc/register-core-handlers/register-core-handlers.ts`: delete line 67 (`import { registerUpdaterHandlers } from '../../window/attach-main-window-services'`) and line 245 (`registerUpdaterHandlers(store)`). `src/main/runtime/rpc/methods/index.ts`: delete line 45 (`import { UPDATER_METHODS } from './updater'`) and line 105 (`...UPDATER_METHODS`; fix the trailing comma on line 104 if it was the last spread). `src/main/runtime/rpc/methods/status.ts`: delete line 2 and line 12, and replace lines 16-17 with:
  ```ts
          appVersion: process.env.ORCA_APP_VERSION ?? '0.0.0-dev'
  ```
  (`remoteUpdateSupport` is optional in `RuntimeStatus`; the CLI `status.ts`/`client.ts` already spread it conditionally.)
- [ ] **Step 13: `src/main/observability/instrumentation.ts`** — delete line 10 (`//   - Updater operations`) and lines 314-330 (`export type UpdaterSpanArgs` through the closing `}` of `withUpdaterSpan`). `src/main/proxy-guarded-fetch-call-site-audit.test.ts`: delete line 11 (`// Known pre-existing gap outside this repo's reach: electron-updater runs on its own partition.`).
- [ ] **Step 14: Regenerate the RPC params catalog.** `pnpm run generate:rpc-params-catalog` — expected: `src/shared/rpc-contract/rpc-params-catalog.generated.ts` loses line 524 (`import { UpdaterCheckParams } from './updater-params'`) and lines 1169-1172 (`'updater.check'`, `'updater.download'`, `'updater.getStatus'`, `'updater.install'`). Then `pnpm run verify:rpc-params-catalog` passes.
- [ ] **Step 15: Verify.** `pnpm tc:node` → 0 errors. Run the Tests list above → all green. `pnpm run check:code-quality:changed` → clean. (`pnpm tc:web` still passes because the preload `updater` bridge only references IPC channel strings; it goes in U3.2.)
- [ ] **Step 16: Commit.**
  ```
  refactor(local-only): remove the main-process auto-updater engine, fetchers and RPC

  Deletes electron-updater setup, GitHub release/Atom/api.github.com fetchers, onorca.dev nudge and changelog fetches, the local-build feed listener, Linux package-recovery helpers, the updater IPC/RPC handlers and the Check-for-Updates menu/tray entries. status.get keeps appVersion from ORCA_APP_VERSION.

  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01PskLbdTqJNXxJ7KRnDoDoD
  ```

### Task U3.2: Remove the preload updater API, the renderer update UI, the UI-store update state and the localization keys; add `app.getVersion`
**Files:**
Delete:
- `src/preload/api/updater-api.ts`, `src/preload/api/updater-bridge.ts`, `src/preload/updater-package-recovery.test.ts`
- `src/renderer/src/components/UpdateCard.tsx`, `src/renderer/src/components/UpdateCard.test.ts`, `src/renderer/src/components/UpdateCard.error-card.test.tsx`
- `src/renderer/src/components/maintenance/update-card/` (whole dir: update-card-error-model.ts, update-card-error-model.test.ts, update-card-visibility.ts, UpdateAvailableCardContent.tsx, UpdateCardStateContent.tsx, UpdateDownloadCardContent.tsx and any sibling in that dir)
- `src/renderer/src/components/LinuxPackageInstallRecoveryCard.tsx`, `src/renderer/src/components/LinuxPackageInstallRecoveryCard.test.tsx`
- `src/renderer/src/components/settings/GeneralUpdateSettingsSection.tsx`, `src/renderer/src/components/settings/GeneralUpdateSettingsSection.test.tsx`, `src/renderer/src/components/settings/ReleaseChannelSection.tsx`
- `src/renderer/src/components/status-bar/UpdateStatusSegment.tsx`, `src/renderer/src/components/status-bar/UpdateStatusSegment.test.tsx`
- `src/renderer/src/hooks/ipc-events/updater-status-ipc-bridge.ts`, `src/renderer/src/hooks/ipc-events/updater-status-ipc-bridge.test.ts`, `src/renderer/src/hooks/useIpcEvents-updater-status.test.ts`
- `src/renderer/src/web/preload-api/web-updater-api.ts`, `src/renderer/src/web/web-preload-updater-package-recovery.test.ts`
- `src/shared/updater-windows-signature-check.ts`, `src/shared/updater-windows-signature-check.test.ts`
Modify:
- `src/preload/index.ts`:61,160 · `src/preload/api-types.ts`:62,127
- `src/preload/api/app-api.ts` (add 1 line after 18), `src/preload/api/app-bridge.ts` (add 1 line after 16), `src/main/ipc/app.ts` (add 1 line after 251), `src/renderer/src/web/preload-api/web-app-api.ts` (add 1 line after 20)
- `src/renderer/src/lib/client-environment-info.ts`:42 · `src/renderer/src/lib/typing-latency/diagnostic.ts`:196-197 · `src/renderer/src/components/UnexpectedSignoutCard.tsx`:93-94
- `src/renderer/src/app-shell/AppRootSurfaces.tsx`:19,60-62,115-(end of fn),146,151,284-288
- `src/renderer/src/components/settings/GeneralPane.tsx`:7,15,275-277 · `src/renderer/src/components/settings/general-search.ts`:237-254,269
- `src/renderer/src/components/status-bar/StatusBarSurface.tsx`:19,278
- `src/renderer/src/hooks/ipc-events/app-lifetime-ipc-bridge.ts`:31,124
- `src/renderer/src/components/sidebar/SidebarSettingsHelpMenu.tsx`:8,10,37,55-(end of const),104,114,116,123,174-187,329-345
- `src/renderer/src/store/slices/ui/ui-slice-update-actions.ts`:9-58,71-102 · `src/renderer/src/store/slices/ui/ui-slice-contract-preferences.ts`:20-21,171-179,184-191 · `src/renderer/src/store/slices/ui/ui-slice-hydration-actions.ts`:39,201,206-209
- `src/renderer/src/web/web-preload-api.ts`:51,122 · `src/renderer/src/web/web-preload-api-composition.test.ts`:66
- Test harness/mocks (delete the `updater:` mock object or `setUpdateStatus` line at each): `src/renderer/src/hooks/ipc-events-test-harness.ts`:224-228 · `src/renderer/src/hooks/ipc-events-close-routing-test-harness.ts`:80,263-267 · `src/renderer/src/hooks/ipc-events-terminal-create-test-harness.ts`:50 · `src/renderer/src/hooks/ipc-events-agent-status-store-test-fixtures.ts`:139 · `src/renderer/src/hooks/ipc-events-terminal-create-scenario-types.ts`:58 · `src/renderer/src/hooks/ipc-events-harness-store-state.ts`:38 · `src/renderer/src/hooks/useIpcEvents-cli-worktree-activation.test.ts`:50,185-189,326,451-455 · `src/renderer/src/hooks/useIpcEvents-browser-tab-create.test.ts`:32,209-213 · `src/renderer/src/hooks/useIpcEvents-close-routing-browser-pages.test.ts`:48,191-195,273,417-421,497,638-642 · `src/renderer/src/hooks/useIpcEvents-rate-limit-hydration.test.ts`:57,146-150 · `src/renderer/src/hooks/useIpcEvents-ssh-disconnect-cleanup.test.ts`:35,192-196 · `src/renderer/src/hooks/useIpcEvents-lifecycle.test.ts`:250,254,505-511 · `src/renderer/src/components/sidebar/SidebarSettingsHelpMenu.test.tsx`:144-146 and the two `it` blocks that end at 292 and start at 294 · `src/renderer/src/components/settings/GeneralPane.section-lifetime.test.tsx` (keep only `it('preserves an autosave draft until external settings change or the section hides')`) · `src/renderer/src/components/unexpected-signout/unexpected-signout-card.test.tsx`:33,68
- i18n: `src/renderer/src/i18n/locales/{en,es,fr,ja,ko,zh}.json`, `src/renderer/src/i18n/en-runtime-required.json`
Tests (new, TDD): `src/renderer/src/lib/client-environment-info.test.ts` (new or extend if present), `src/preload/api/app-bridge.test.ts` (new)
Tests (run): `pnpm test src/renderer/src/lib/client-environment-info.test.ts src/preload/api/app-bridge.test.ts src/renderer/src/hooks src/renderer/src/components/sidebar/SidebarSettingsHelpMenu.test.tsx src/renderer/src/components/settings/GeneralPane.section-lifetime.test.tsx src/renderer/src/components/unexpected-signout src/renderer/src/web src/renderer/src/store src/renderer/src/app-shell src/renderer/src/components/status-bar`
**Interfaces:** Consumes: U3.1 (no `updater:*` IPC). Produces: `window.api.app.getVersion(): Promise<string>` (IPC `app:getVersion`) — the only renderer app-version source from now on; `PreloadApi` has no `updater` key; `UISlice` has no `updateStatus`/`setUpdateStatus`/`updateChangelog`/`updateUserInitiatedCycle`/`dismissedUpdateVersion`/`dismissUpdate`/`clearDismissedUpdateVersion`/`releaseChannelOverride`/`setReleaseChannelOverride`/`updateCardCollapsed`/`setUpdateCardCollapsed`/`updateReassuranceSeen`/`markUpdateReassuranceSeen`.

- [ ] **Step 1 (RED): write the version-API tests first.** Create `src/preload/api/app-bridge.test.ts`:
  ```ts
  import { describe, expect, it, vi } from 'vitest'

  const invoke = vi.fn()
  vi.mock('electron', () => ({ ipcRenderer: { invoke, on: vi.fn(), removeListener: vi.fn(), sendSync: vi.fn() } }))
  vi.mock('../preload-runtime-support', () => ({ awaitBeforeUnloadCheckpoint: vi.fn(), startupDiagnosticsEnabled: false }))
  vi.mock('../renderer-restart-wiring', () => ({ prepareAndInvokeAppRestart: vi.fn() }))

  describe('appApi.getVersion', () => {
    it('reads the app version over the app:getVersion channel', async () => {
      invoke.mockResolvedValueOnce('1.2.3')
      const { appApi } = await import('./app-bridge')
      await expect(appApi.getVersion()).resolves.toBe('1.2.3')
      expect(invoke).toHaveBeenCalledWith('app:getVersion')
    })
  })
  ```
  Create `src/renderer/src/lib/client-environment-info.test.ts` (or add this case if the file exists):
  ```ts
  import { afterEach, describe, expect, it, vi } from 'vitest'
  import { resolveClientEnvironmentInfo } from './client-environment-info'

  describe('resolveClientEnvironmentInfo', () => {
    afterEach(() => { vi.unstubAllGlobals() })
    it('reads the app version from window.api.app.getVersion', async () => {
      vi.stubGlobal('window', { ...globalThis.window, api: { app: { getVersion: vi.fn().mockResolvedValue('9.9.9') } } })
      await expect(resolveClientEnvironmentInfo()).resolves.toMatchObject({ appVersion: '9.9.9' })
    })
  })
  ```
  Run `pnpm test src/preload/api/app-bridge.test.ts src/renderer/src/lib/client-environment-info.test.ts` — expected: both fail (`getVersion` is not a function / IPC not invoked).
- [ ] **Step 2 (GREEN): add `app.getVersion`.** `src/main/ipc/app.ts` — after line 251 add:
  ```ts
    ipcMain.handle('app:getVersion', (): string => app.getVersion())
  ```
  `src/preload/api/app-api.ts` — after line 18 add `  getVersion: () => Promise<string>`. `src/preload/api/app-bridge.ts` — after line 16 add `  getVersion: (): Promise<string> => ipcRenderer.invoke('app:getVersion'),`. `src/renderer/src/web/preload-api/web-app-api.ts` — after line 20 add `      getVersion: () => Promise.resolve('web'),`. Then switch the three renderer callers: `src/renderer/src/lib/client-environment-info.ts` line 42 → `    const version = await window.api?.app?.getVersion?.()`; `src/renderer/src/lib/typing-latency/diagnostic.ts` lines 196-197 → `  void window.api?.app` / `    ?.getVersion?.()`; `src/renderer/src/components/UnexpectedSignoutCard.tsx` lines 93-94 → `    void window.api.app` / `      .getVersion()`. Update the two test mocks: `unexpected-signout-card.test.tsx` line 33 → `      app: { getVersion: vi.fn().mockResolvedValue('1.4.197') }` and line 68 → `vi.mocked(window.api.app.getVersion).mockResolvedValue('1.4.999')`. Re-run the two new tests → green.
- [ ] **Step 3: Delete the preload/renderer updater files.**
  ```bash
  git rm -r -q src/preload/api/updater-api.ts src/preload/api/updater-bridge.ts src/preload/updater-package-recovery.test.ts src/renderer/src/components/UpdateCard.tsx src/renderer/src/components/UpdateCard.test.ts src/renderer/src/components/UpdateCard.error-card.test.tsx src/renderer/src/components/maintenance/update-card src/renderer/src/components/LinuxPackageInstallRecoveryCard.tsx src/renderer/src/components/LinuxPackageInstallRecoveryCard.test.tsx src/renderer/src/components/settings/GeneralUpdateSettingsSection.tsx src/renderer/src/components/settings/GeneralUpdateSettingsSection.test.tsx src/renderer/src/components/settings/ReleaseChannelSection.tsx src/renderer/src/components/status-bar/UpdateStatusSegment.tsx src/renderer/src/components/status-bar/UpdateStatusSegment.test.tsx src/renderer/src/hooks/ipc-events/updater-status-ipc-bridge.ts src/renderer/src/hooks/ipc-events/updater-status-ipc-bridge.test.ts src/renderer/src/hooks/useIpcEvents-updater-status.test.ts src/renderer/src/web/preload-api/web-updater-api.ts src/renderer/src/web/web-preload-updater-package-recovery.test.ts src/shared/updater-windows-signature-check.ts src/shared/updater-windows-signature-check.test.ts
  ```
  If `src/renderer/src/components/maintenance/` is now empty, `git rm` leaves no trace; confirm with `ls src/renderer/src/components/maintenance 2>&1`.
- [ ] **Step 4: Preload composition.** `src/preload/index.ts`: delete line 61 (`import { updaterApi } from './api/updater-bridge'`) and line 160 (`  updater: updaterApi,`). `src/preload/api-types.ts`: delete line 62 (`import type { UpdaterApi } from './api/updater-api'`) and line 127 (`  updater: UpdaterApi`). `src/renderer/src/web/web-preload-api.ts`: delete line 51 and line 122 (`    updater: createUpdaterApi(),`). `src/renderer/src/web/web-preload-api-composition.test.ts`: delete line 66 (`      'updater',`).
- [ ] **Step 5: Renderer mounts.** `src/renderer/src/app-shell/AppRootSurfaces.tsx`: delete line 19 (`import type { UpdateStatus } ...`), lines 60-62 (the `const UpdateCard = lazy(...)` statement), the whole `function shouldMountUpdateCardForStatus(status: UpdateStatus): boolean { ... }` starting at line 115, line 146 (`const updateStatus = useAppStore((s) => s.updateStatus)`), line 151 (`const shouldMountUpdateCard = ...`) and the JSX block at lines 284-288 (`{shouldMountUpdateCard ? ( <Suspense ...><UpdateCard /></Suspense> ) : null}` — delete from `{shouldMountUpdateCard ? (` through its `) : null}`). Keep the `RemoteServerUpdateDialog` lazy import and mount (U7 hand-off). `src/renderer/src/components/status-bar/StatusBarSurface.tsx`: delete line 19 (`import { UpdateStatusSegment } ...`) and line 278 (`<UpdateStatusSegment compact={compact} iconOnly={segmentsIconOnly} />`). `src/renderer/src/hooks/ipc-events/app-lifetime-ipc-bridge.ts`: delete line 31 and line 124 (`registerUpdaterStatusIpcBridge(unsubs)`).
- [ ] **Step 6: Settings General pane.** `src/renderer/src/components/settings/GeneralPane.tsx`: delete line 7 (`import { GeneralUpdateSettingsSection } ...`), line 15 (`  getGeneralUpdateSearchEntries,`) and lines 275-277 (`matchesSettingsSearch(searchQuery, getGeneralUpdateSearchEntries()) ? ( <GeneralUpdateSettingsSection key="updates" /> ) : null`; the previous array element at line 274 loses its trailing comma). `src/renderer/src/components/settings/general-search.ts`: delete lines 237-254 (`export const getGeneralUpdateSearchEntries = createLocalizedCatalog(() => [ ... ])`) and line 269 (`    ...getGeneralUpdateSearchEntries(),`). `GeneralPane.section-lifetime.test.tsx`: delete lines 42-44 (`vi.mock('@/components/settings/ReleaseChannelSection', ...)`), line 54 (`Object.assign(window, { api: { updater: { getVersion: fake.getVersion } } })`), the tests at lines 101, 123, 164 and 183 (each `it(...)` through its closing `})`) and any `fake.getVersion`/`updateStatus` fixture lines they alone used; keep the autosave test at line 142. Run `pnpm test src/renderer/src/components/settings/GeneralPane.section-lifetime.test.tsx` and delete any now-unused helper the lint flags.
- [ ] **Step 7: Sidebar help menu.** `src/renderer/src/components/sidebar/SidebarSettingsHelpMenu.tsx`: delete line 8 (`  Loader2,`), line 10 (`  RefreshCw,`), line 37 (`import { getUpdateCheckClickOptions, getUpdateCheckHint } ...`), the `const NO_UPDATE_CHECK_MODIFIERS = { ... }` statement starting at line 55, line 104 (`const updateStatus = useAppStore((s) => s.updateStatus)`), line 114 (`const updateCheckModifiersRef = ...`), line 116 (`const updateCheckHint = getUpdateCheckHint()`), line 123 (`updateCheckModifiersRef.current = NO_UPDATE_CHECK_MODIFIERS`), lines 174-187 (`handleCheckForUpdatesPointerDown` and `handleCheckForUpdates`), and lines 329-345 (the `<DropdownMenuSeparator />` + the Check-for-Updates `<DropdownMenuItem ...>...</DropdownMenuItem>`; keep the separator at 346 so Restart keeps its divider). In `SidebarSettingsHelpMenu.test.tsx` delete lines 144-146 (`updater: { check: mocks.updaterCheck }`), the `mocks.updaterCheck` declaration, and the two `it` blocks that assert the update-check hint (ending at line 292) and `it('passes update-check modifier options through the updater bridge', ...)` (starting line 294).
- [ ] **Step 8: UI store.** `src/renderer/src/store/slices/ui/ui-slice-update-actions.ts`: delete lines 9-58 (`updateStatus: { state: 'idle' },` through `dismissedUpdateVersion: null,`), lines 71-102 (`clearDismissedUpdateVersion`, `releaseChannelOverride`, `setReleaseChannelOverride`, `dismissUpdate`, `updateCardCollapsed`, `setUpdateCardCollapsed`, `updateReassuranceSeen`, `markUpdateReassuranceSeen`). Lines 59-70 (unexpected-signout) and 103+ (OSC52, fullscreen, browser defaults) stay; `get` is still used at line 62. `ui-slice-contract-preferences.ts`: delete lines 20-21 (the `ReleaseChannel` and `ChangelogData, UpdateStatus` type imports), lines 171-179 and lines 184-191. `ui-slice-hydration-actions.ts`: delete line 39 (`import { isReleaseChannel } ...`), line 201 (`dismissedUpdateVersion: ui.dismissedUpdateVersion ?? null,`), lines 206-208 (`releaseChannelOverride: isReleaseChannel(...) ? ... : null,` plus the three comment lines 203-205 above it) and line 209 (`updateReassuranceSeen: ui.updateReassuranceSeen ?? false,`). Then delete the `setUpdateStatus: vi.fn(),` / `setUpdateStatus: SpyMock` lines and the `updater: { getStatus..., onStatus..., onClearDismissal... }` mock objects in every harness/test file listed under Modify (line numbers given there); in `useIpcEvents-lifecycle.test.ts` delete line 250, line 254 and lines 505-511 (the post-unmount `updater.onStatus` assertion).
- [ ] **Step 9: Localization catalogs.** Run from the repo root:
  ```bash
  node -e '
  const fs=require("fs");
  const files=["en","es","fr","ja","ko","zh"].map(l=>`src/renderer/src/i18n/locales/${l}.json`).concat(["src/renderer/src/i18n/en-runtime-required.json"]);
  const drop=new Set(["auto.components.UpdateCard","auto.components.LinuxPackageInstallRecoveryCard","auto.components.settings.GeneralUpdateSettingsSection","auto.components.settings.ReleaseChannelSection","auto.components.status.bar.UpdateStatusSegment","auto.components.sidebar.SidebarSettingsHelpMenu.29c56f30ee","menu.checkForUpdates",...["e15af4eb64","79ff46776e","f89a94773c","9e86ccd05c","c9d8c1ce66","e49e739a59"].map(k=>"auto.components.settings.general.search."+k)]);
  function walk(o,path){for(const k of Object.keys(o)){const p=path?path+"."+k:k;if(drop.has(p)){delete o[k];continue}if(o[k]&&typeof o[k]==="object")walk(o[k],p)}}
  for(const f of files){const j=JSON.parse(fs.readFileSync(f,"utf8"));walk(j,"");fs.writeFileSync(f,JSON.stringify(j,null,2)+"\n")}'
  pnpm format
  pnpm run sync:localization-runtime-catalog
  pnpm run verify:localization-catalogs && pnpm run verify:localization-extraction && pnpm run verify:localization-coverage && pnpm run verify:localization-runtime-catalog
  ```
  Expected: `rg -c "UpdateCard|GeneralUpdateSettingsSection|ReleaseChannelSection|checkForUpdates" src/renderer/src/i18n` prints 0 for every file; the four verify scripts exit 0. (Keep every `RemoteServerUpdate*`, `SkillUpdateStatusSegment` and `remoteServerUpdateErrors` key — they belong to surviving components.)
- [ ] **Step 10: Verify.** `pnpm tc` (node + web) → 0 errors. Run the Tests list → green. `pnpm run check:code-quality:changed` → clean. `rg -n "api\.updater|window\.api\?\.updater|'updater:" src` → only `src/preload/renderer-restart-wiring.ts`, `src/preload/preload-runtime-support.ts` and their tests remain (inert relays, U7 hand-off).
- [ ] **Step 11: Commit.**
  ```
  refactor(local-only): remove the renderer update UI, preload updater API and update store state

  Adds app.getVersion so the error footer, typing-latency diagnostic and sign-out card keep showing the app version without the updater bridge.

  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01PskLbdTqJNXxJ7KRnDoDoD
  ```

### Task U3.3: Delete `release-channel.ts`, trim `update-status-types.ts`, drop the release-channel persisted-UI fields
**Files:**
Delete: `src/shared/release-channel.ts`, `src/shared/release-channel.test.ts`
Modify: `src/shared/update-status-types.ts`:1,23-25,28-30,95,97-99 · `src/shared/persisted-ui-state-types.ts`:1,137-140 · `src/shared/rpc-contract/client-ui-params.ts`:11-12,196-201 · `src/shared/rpc-contract/rpc-params-catalog.generated.ts` (regenerated)
Tests: `pnpm test src/shared src/renderer/src/store src/main/persistence-ui-state.test.ts src/main/ipc/ui.test.ts`
**Interfaces:** Consumes: U3.2 (no UI consumer of `ReleaseChannel`). Produces: `UpdateCheckOptions` = `{ includePrerelease?, includePerfPrerelease?, localBuild? }`; `UpdateStatus` without `source`; `PersistedUIState` without `releaseChannelOverride`/`pendingUpdateNudgeId`/`dismissedUpdateNudgeId` (`dismissedUpdateVersion`, `lastUpdateCheckAt`, `updateReassuranceSeen` stay as inert persisted fields so stored profiles keep validating).

- [ ] **Step 1: `src/shared/update-status-types.ts`** — delete line 1 (`import type { DedicatedRepoChannel, ReleaseBuild, ReleaseChannel } from './release-channel'`), lines 23-25 (`/** Dev channel switching ... */`, `channel?: ReleaseChannel`, `targetTag?: string`), lines 28-30 (the `UpdateSource` comment + type), replace line 95 `) & { source?: UpdateSource }` with `)`, delete lines 97-99 (`export type ReleaseBuildListResult = ...`).
- [ ] **Step 2: persisted UI schema.** `src/shared/persisted-ui-state-types.ts`: delete line 1 (`import type { ReleaseChannel } from './release-channel'`) and lines 137-140 (the dev-override comment, `releaseChannelOverride?`, `pendingUpdateNudgeId?`, `dismissedUpdateNudgeId?`). `src/shared/rpc-contract/client-ui-params.ts`: delete lines 11-12 (`import { isReleaseChannel } ...`, `import type { ReleaseChannel } ...`), lines 196-197 (`pendingUpdateNudgeId`, `dismissedUpdateNudgeId`) and lines 198-201 (the predicate comment + `releaseChannelOverride: z.custom<ReleaseChannel>(isReleaseChannel).nullable().optional(),`).
- [ ] **Step 3: delete the module.** `git rm src/shared/release-channel.ts src/shared/release-channel.test.ts`, then `pnpm run generate:rpc-params-catalog` (expected: no diff beyond `ClientUi*` params losing the three fields) and `rg -n "release-channel'" src` → no output.
- [ ] **Step 4: Verify.** `pnpm tc` → 0 errors; run the Tests list → green; `pnpm run check:code-quality:changed` → clean.
- [ ] **Step 5: Commit.**
  ```
  refactor(local-only): drop release channels and the release-channel persisted UI override

  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01PskLbdTqJNXxJ7KRnDoDoD
  ```

### Task U3.4: Remove the electron-updater dependency, the electron-builder publish block, `dev-app-update.yml`, `Casks/`, and retire the updater reliability-gate references
**Files:**
Delete: `config/dev-app-update.yml`, `Casks/orca.rb`, `Casks/orca@rc.rb`
Modify: `package.json`:189 · `config/electron-builder.config.cjs`:231,702-711 · `config/scripts/electron-builder-config.test.mjs`:42 · `config/reliability-gates.jsonc`:4507,4515,4530-4541,4644 · `pnpm-lock.yaml` (via pnpm)
Tests: `pnpm test config/scripts/electron-builder-config.test.mjs config/scripts/check-reliability-gates.test.mjs`; `pnpm run check:reliability-gates`
**Interfaces:** Consumes: U3.1 (no `require('electron-updater')` left). Produces: no `publish` key in the builder config (no `app-update.yml` is generated into Resources), no `electron-updater` in `dependencies`.

- [ ] **Step 1: Dependency.** `pnpm remove electron-updater` — expected: `package.json` line 189 (`"electron-updater": "^6.8.9",`) is gone, `pnpm-lock.yaml` drops the `electron-updater`/`builder-util-runtime` subtree, and `rg -n "electron-updater" src config electron.vite.config.ts` prints nothing (the `EXTERNAL_MAIN_DEPENDENCIES` list in `electron.vite.config.ts` is derived from `package.json`, so it needs no edit).
- [ ] **Step 2: Builder config.** `config/electron-builder.config.cjs`: delete lines 702-711 (`publish: { provider: 'github', owner: 'stablyai', repo: devChannelRepo ?? 'orca', ...comment..., releaseType: ... }`; the `npmRebuild: true,` on line 701 loses its trailing comma) and line 231 (`'!Casks{,/**/*}',` in `files`). `config/scripts/electron-builder-config.test.mjs`: delete line 42 (`'!Casks{,/**/*}',`); if the test around line 380 (`validates each AppImage before electron-builder publishes it`) asserts on `config.publish`, change that assertion to `expect(config.publish).toBeUndefined()`. `git rm config/dev-app-update.yml Casks/orca.rb Casks/orca@rc.rb`.
- [ ] **Step 3: Reliability gate `serve-desktop-activation` block (lines 4496-4560 region).** In `config/reliability-gates.jsonc` line 4507 and line 4644 remove the three tokens ` src/main/updater.headless-serve-install.test.ts src/main/updater.test.ts src/main/updater.mac-install.test.ts` from the command strings; delete line 4515 (`"src/main/updater.headless-serve-install.test.ts",`); delete the `assertionRefs` entry at lines 4530-4541 (`{ "file": "src/main/updater.headless-serve-install.test.ts", "assertions": [ ... ] },`). Run `pnpm run check:reliability-gates` → exit 0 (the checker fails on test files that no longer exist, which is why these lines must go in this commit).
- [ ] **Step 4: Verify packaging stays buildable.** `pnpm tc && pnpm test config/scripts/electron-builder-config.test.mjs config/scripts/check-reliability-gates.test.mjs && pnpm run check:reliability-gates && pnpm run check:code-quality:changed`. Then `node -e "const c=require('./config/electron-builder.config.cjs');console.log('publish' in c, c.files.filter(f=>f.includes('Casks')).length)"` → prints `false 0`.
- [ ] **Step 5: Commit.**
  ```
  build(local-only): drop electron-updater, the GitHub publish block, dev-app-update.yml and the Homebrew casks

  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01PskLbdTqJNXxJ7KRnDoDoD
  ```

## Unit U11 — Renderer remote loads and CSP

### Task U11.1: Remove the Google favicon fallbacks from the agent and open-in-app catalogs
**Files:**
Modify: `src/renderer/src/lib/agent-catalog.tsx`:29,66,91,98,107,114,128,135,157,164,171,184,191,208,215,222,229,236,243,250,261,270,277,290,299,308,315,323,330,337,344,420-434 · `src/renderer/src/lib/open-in-app-catalog.tsx`:12,21,27,33,62-75
Tests (new, TDD): `src/renderer/src/lib/agent-catalog.icon.test.tsx`, `src/renderer/src/lib/open-in-app-catalog.icon.test.tsx`
**Interfaces:** Consumes: none. Produces: `AgentCatalogEntry` and `OpenInAppPreset` no longer have `faviconDomain`; `OpenInApplicationIcon` always renders the `AppWindow` glyph; agents without a bundled PNG (today only `codebuddy`) render `AgentLetterIcon`.

- [ ] **Step 1 (RED).** Create `src/renderer/src/lib/agent-catalog.icon.test.tsx`:
  ```tsx
  import { render } from '@testing-library/react'
  import { describe, expect, it } from 'vitest'
  import { AgentIcon } from './agent-catalog'

  describe('AgentIcon', () => {
    it('never renders an image from a remote host', () => {
      const { container } = render(<AgentIcon agent="codebuddy" size={14} />)
      const remote = [...container.querySelectorAll('img')].filter((img) => /^https?:/.test(img.getAttribute('src') ?? ''))
      expect(remote).toEqual([])
    })
  })
  ```
  (Use the exported icon component name at `agent-catalog.tsx` — the function that contains lines 380-437; adjust the import to that export.) Create `src/renderer/src/lib/open-in-app-catalog.icon.test.tsx` the same way around `OpenInApplicationIcon` with `application={{ command: 'code' }}`. Run both → fail with a `https://www.google.com/s2/favicons?...` src found.
- [ ] **Step 2 (GREEN): `agent-catalog.tsx`.** Delete lines 420-434 (the `if (catalogEntry?.faviconDomain) { ... return <img src={\`https://www.google.com/s2/favicons?...\`} .../> }` block) so the function falls through to `AgentLetterIcon`. Delete line 29 (`faviconDomain?: string`) and every `faviconDomain: '...'` entry line listed above (31 lines; each is a standalone property line, so delete the line and fix the trailing comma of the previous property where it was the last one). Delete the now-stale comment at line 149 (`// Why: no faviconDomain — omp renders ...`).
- [ ] **Step 3 (GREEN): `open-in-app-catalog.tsx`.** Replace lines 62-75 (`const preset = getOpenInAppPreset(application)` + the `if (preset) { return <img src={\`https://www.google.com/s2/favicons?...\`} .../> }` block) with nothing, leaving `return <AppWindow width={size} height={size} />`; delete line 12 (`faviconDomain: string`) and lines 21, 27, 33 (`faviconDomain: 'code.visualstudio.com'`, `'cursor.com'`, `'zed.dev'`). If `getOpenInAppPreset`/`preset.iconClassName`/`cn` become unused, delete those imports/helpers in the same file. Run the two tests → green.
- [ ] **Step 4: Verify.** `pnpm tc:web`, `pnpm test src/renderer/src/lib`, `pnpm run check:code-quality:changed`, and `rg -n "google.com/s2/favicons" src` → only `src/shared/repo-icon.ts` and its tests remain (U11.2).
- [ ] **Step 5: Commit.**
  ```
  refactor(local-only): stop loading agent and editor icons from Google's favicon service

  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01PskLbdTqJNXxJ7KRnDoDoD
  ```

### Task U11.2: Remove remote repo-icon sources (website favicon and GitHub owner avatar)
**Files:**
Delete: `src/renderer/src/components/settings/repository-icon-github.ts`, `src/renderer/src/components/settings/repository-icon-github.test.ts`, `src/renderer/src/components/settings/RepositoryIconPicker.github-avatar-refresh.test.tsx`, `src/main/repo-git-remote-avatar-refresh.test.ts`
Modify: `src/shared/repo-icon.ts`:17-32,34-80,97-112 · `src/shared/repo-icon.test.ts` (favicon/github cases at 73-79,125,172-205) · `src/main/repo-icon-autodetect.ts`:5-10,11,21-49,51-101,103-118,141-152,170-174 · `src/main/repo-icon-autodetect.test.ts` (tests at 104,250,267,299,328) · `src/main/repo-git-remote-identity-enrichment.ts`:8,10,103-128,144-146,153-155 · `src/main/repo-git-remote-identity-enrichment.test.ts` (any `repoIcon` assertion) · `src/renderer/src/components/settings/RepositoryIconPicker.tsx`:16-20,30,50-52,70-79,81-116,121-127,138-170,206,208 · `src/renderer/src/components/settings/RepositoryIconTabs.tsx`:3,5,28,30,37,39,41,68-88,104-123,134-154 · `src/renderer/src/components/settings/RepositoryIconPicker*.test.*` (remaining GitHub cases) · i18n keys `auto.components.settings.RepositoryIconPicker.{39da8a10bf,7da623abcc,03ca1a4e9b,cc1286e263,acf31559a0,4d039317f4,f79972271a,d71df44587}`
Tests (new, TDD): extend `src/shared/repo-icon.test.ts`
Tests (run): `pnpm test src/shared/repo-icon.test.ts src/main/repo-icon-autodetect.test.ts src/main/repo-git-remote-identity-enrichment.test.ts src/renderer/src/components/settings`
**Interfaces:** Consumes: U10 state of `src/main/github/client.ts` (`getRepoSlug`, `getRepoUpstream`) and the `github.repoSlug`/`github.repoUpstream` RPC methods — if U10 already deleted them, the corresponding call sites below are already gone and only the shared helper + picker edits remain. Produces: `sanitizeRepoIcon` returns `undefined` for any `image` icon whose `source` is `'favicon'` or `'github'` (persisted remote icons are dropped on hydration and the repo falls back to its default glyph); `RepoIconImageSource` keeps its four literals (type-only, so persisted-state readers do not change); `RepositoryIconTabsProps` loses `loadingGitHub`/`onUseGitHubAvatar`.

- [ ] **Step 1 (RED).** In `src/shared/repo-icon.test.ts` add inside `describe('sanitizeRepoIcon')`:
  ```ts
    it('drops remote image sources entirely', () => {
      expect(sanitizeRepoIcon({ type: 'image', src: 'https://www.google.com/s2/favicons?domain=example.com&sz=64', source: 'favicon' })).toBeUndefined()
      expect(sanitizeRepoIcon({ type: 'image', src: 'https://github.com/acme.png?size=64', source: 'github' })).toBeUndefined()
    })
  ```
  Run `pnpm test src/shared/repo-icon.test.ts` → the new case fails (both currently sanitize to an image icon).
- [ ] **Step 2 (GREEN): `src/shared/repo-icon.ts`.** Delete lines 17-32 (`faviconUrlFromWebsite`), lines 34-80 (`GitHubAvatarSlug` type, `githubAvatarSlug`, `githubAvatarIcon`, `normalizeGitHubAvatarHost`), and replace lines 97-112 (the `let url: URL ... return url.hostname === 'www.google.com' && ...` tail of `computeIsSupportedImageSrc`) with:
  ```ts
    // Why: favicon/github icons were remote loads; a local-only renderer never fetches them.
    return false
  ```
  Then in `repo-icon.test.ts` delete the now-contradicting expectations: the `source: 'favicon'` acceptance at lines 73-79 (and the matching entry around line 125 in `rejects unsupported image urls`), the test `it('builds hosted avatar URLs only from a valid host value')` (172-185) and the whole `describe('githubAvatarSlug')` (187-206); drop `githubAvatarIcon, githubAvatarSlug` from the import on line 3. Run the file → green.
- [ ] **Step 3: `src/main/repo-icon-autodetect.ts`.** Delete `faviconUrlFromWebsite`, `githubAvatarIcon`, `githubAvatarSlug` from the import (lines 5-10 → `import type { RepoIcon } from '../shared/repo-icon'`), delete `WEBSITE_HOSTS_TO_SKIP`, `shouldUseWebsiteFavicon`, `packageHomepageIcon`, `detectLocalPackageHomepageIcon`, `detectRemotePackageHomepageIcon` (lines 21-101) and `detectGitHubAvatarIcon` (103-118); in `detectRepoIcon` delete lines 138-152 (the homepage-icon lookup and the `if (kind === 'git') return detectGitHubAvatarIcon(...)` block) so it returns `fileIcon ?? undefined`; if `getRepoSlug` is now unused delete it from line 11 (`getRepoUpstream` stays: `detectRepoIconAndUpstream` lines 170-174 still resolves fork metadata — leave that to U10). In `repo-icon-autodetect.test.ts` delete the tests at lines 104 (`uses a package homepage favicon ...`), 250 (`falls back to the GitHub owner avatar ...`), 267 (`skips code-host package homepages ...`), 299 (`uses the resolved fork upstream for both metadata and the GitHub avatar`) and 328 (`keeps the renamed fork own owner avatar ...`), and in any surviving test replace a `repoIcon: { type: 'image', source: 'github', ... }` expectation with `repoIcon: undefined`.
- [ ] **Step 4: `src/main/repo-git-remote-identity-enrichment.ts`.** Delete line 8 (`import { githubAvatarIcon, type RepoIcon } from '../shared/repo-icon'`), line 10 (`import { getProjectProviderIdentity } ...` — now unused), lines 103-128 (`getAutomaticGitHubIconRefresh`), lines 144-146 (`const icon = gitRemoteIdentity ? getAutomaticGitHubIconRefresh(...) : undefined`) and lines 153-155 (`if (icon) { return !!update({ ..., repoIcon: icon }) }`); narrow the `updates` type on lines 31 and 150 from `Pick<Partial<Repo>, 'gitRemoteIdentity' | 'repoIcon'>` to `Pick<Partial<Repo>, 'gitRemoteIdentity'>`. `git rm src/main/repo-git-remote-avatar-refresh.test.ts` (it only exercised the avatar refresh); in `repo-git-remote-identity-enrichment.test.ts` delete any `repoIcon` expectation.
- [ ] **Step 5: Renderer picker.** `git rm src/renderer/src/components/settings/repository-icon-github.ts src/renderer/src/components/settings/repository-icon-github.test.ts src/renderer/src/components/settings/RepositoryIconPicker.github-avatar-refresh.test.tsx`. `RepositoryIconPicker.tsx`: delete lines 16-20 (the `repository-icon-github` import), line 30 (`loadingGitHub` state), lines 50-52 (`if (repo.repoIcon.source === 'github') return 'GitHub avatar'`), lines 70-79 (`resolveUpstreamLive`, `resolveGitHubAvatar`), lines 81-116 (`handleUseGitHubAvatar`), replace lines 118-136 (`handleResetToDefault`) with:
  ```ts
    const handleResetToDefault = async () => {
      setResetting(true)
      try {
        updateRepo(repo.id, { repoIcon: null })
      } finally {
        if (mountedRef.current) {
          setResetting(false)
        }
      }
    }
  ```
  delete lines 138-170 (the GitHub identity refresh effect) and the two JSX props at lines 206 and 208 (`loadingGitHub={loadingGitHub}`, `onUseGitHubAvatar={...}`); remove `getActiveRuntimeTarget`, `parseExecutionHostId`, `getRepoExecutionHostId`, `useCallback`, `useEffect`, `useRef`, `runtimeTarget`, `selectedHost`, `activeRuntimeEnvironmentId` if they become unused. `RepositoryIconTabs.tsx`: delete `Github, Link2` from line 3, line 5 (`import { faviconUrlFromWebsite } ...`), the props `loadingGitHub` (28,37) and `onUseGitHubAvatar` (30,39), line 41 (`const [website, setWebsite] = useState('')`), lines 68-88 (`handleUseWebsiteFavicon`), lines 104-123 (the `Use GitHub Avatar` button + its explanatory `<p>`), lines 134-154 (the website `<Input>` + `Favicon` button row); keep the `Upload PNG` button and the size note; drop `Input` from the imports if unused. Delete the eight orphaned `auto.components.settings.RepositoryIconPicker.*` keys listed under Files from all six locale files and `en-runtime-required.json` with the same node snippet as U3.2 step 9, then `pnpm format && pnpm run sync:localization-runtime-catalog`.
- [ ] **Step 6: Verify.** `pnpm tc`, the Tests list, `pnpm run check:code-quality:changed`, the four `verify:localization-*` scripts, and `rg -n "github.com/\\$|\\.png\\?size=|s2/favicons" src --glob '!*.test.*'` → only `src/renderer/src/components/github/github-user-avatar.tsx` and `task-page/github/Avatars.tsx` remain (U10's GitHub panels; the CSP from U11.3 blocks those loads and both components already fall back to initials on `onError`).
- [ ] **Step 7: Commit.**
  ```
  refactor(local-only): drop website-favicon and GitHub-avatar repo icon sources

  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01PskLbdTqJNXxJ7KRnDoDoD
  ```

### Task U11.3: Add a strict Content-Security-Policy to `index.html` and `popout.html` (dev-server relaxation via a serve-only Vite plugin)
**Files:**
Create: `config/build-plugins/renderer-csp.ts`, `config/scripts/renderer-csp.test.ts`
Modify: `src/renderer/index.html`:6 · `src/renderer/popout.html`:6 · `electron.vite.config.ts`:7,320
Tests: `pnpm test config/scripts/renderer-csp.test.ts`
**Interfaces:** Consumes: none (independent of U11.1/U11.2; `web-index.html` is untouched — U7 deletes it). Produces: both native shells carry this meta tag (one line, directives separated by `; `):
```
default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: file:; media-src 'self' data: blob: file:; font-src 'self' data: file:; worker-src 'self' blob:; connect-src 'self' ws://127.0.0.1:* http://127.0.0.1:* ws://localhost:* http://localhost:*; frame-src 'self' data: blob: file: http: https: orca-preview:; object-src 'none'; base-uri 'none'; form-action 'none'
```
Rationale per directive (verified against the renderer): `'wasm-unsafe-eval'` for `vscode-oniguruma` (`monaco-languages/textmate-token-provider.ts:4`) and pdf.js `wasmUrl` (`pdf-js-document-options.ts:7`); `style-src 'unsafe-inline'` because Monaco injects `<style>` nodes at runtime; `worker-src 'self' blob:` for the five Monaco `?worker` imports (`monaco-setup.ts:6-10`) and `pdfjs-dist/build/pdf.worker.min.mjs?url` (`PdfViewer.tsx:18`); `img/media/font file:` for the packaged feature-wall media (`ipc/app.ts:100` returns a `file://` base) and `blob:` for `useLocalImageSrc.ts`, `pet-blob-cache.ts`, `use-emulator-frame-stream.ts`; `connect-src` loopback entries for the Mobile Emulator control socket (`use-emulator-control-stream.ts:99` connects to `ws://127.0.0.1:<port>/ws`) and MJPEG stream, plus Vite HMR in dev; `frame-src` is wide on purpose because the browser-pane `<webview>` (user-driven, exempt by the spec) and the `orca-preview:` doc-preview guest are hosted in an embedder-governed frame, while the only `<iframe>` in the renderer (`IpynbHtmlOutput.tsx:35`) is a `sandbox=""` `srcdoc` frame that inherits this policy and runs no script.

- [ ] **Step 1 (RED).** Create `config/scripts/renderer-csp.test.ts`:
  ```ts
  import { readFileSync } from 'node:fs'
  import { describe, expect, it } from 'vitest'
  import { RENDERER_CSP, rendererCspPlugin } from '../build-plugins/renderer-csp'

  const REQUIRED = ["default-src 'self'", "script-src 'self' 'wasm-unsafe-eval'", "worker-src 'self' blob:", "object-src 'none'", "base-uri 'none'"]

  describe('renderer CSP', () => {
    for (const file of ['src/renderer/index.html', 'src/renderer/popout.html']) {
      it(`${file} carries the strict policy`, () => {
        const html = readFileSync(file, 'utf8')
        expect(html).toContain(`<meta http-equiv="Content-Security-Policy" content="${RENDERER_CSP}" />`)
        for (const directive of REQUIRED) expect(RENDERER_CSP).toContain(directive)
        expect(RENDERER_CSP).not.toMatch(/script-src[^;]*'unsafe-inline'/)
      })
    }
    it('relaxes only script-src for the dev server', () => {
      const plugin = rendererCspPlugin()
      const html = `<meta http-equiv="Content-Security-Policy" content="${RENDERER_CSP}" />`
      const out = (plugin.transformIndexHtml as (h: string) => string)(html)
      expect(out).toContain("script-src 'self' 'wasm-unsafe-eval' 'unsafe-inline'")
      expect(out.split('<meta').length).toBe(html.split('<meta').length)
      expect(plugin.apply).toBe('serve')
    })
  })
  ```
  Run it → fails (module missing).
- [ ] **Step 2 (GREEN): plugin.** Create `config/build-plugins/renderer-csp.ts`:
  ```ts
  import type { Plugin } from 'vite'

  // Why one string: the HTML files carry the literal policy so the packaged renderer never depends on a
  // build step for its CSP; this constant exists so the test and the dev relaxation share the text.
  export const RENDERER_CSP = [
    "default-src 'self'",
    "script-src 'self' 'wasm-unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: file:",
    "media-src 'self' data: blob: file:",
    "font-src 'self' data: file:",
    "worker-src 'self' blob:",
    "connect-src 'self' ws://127.0.0.1:* http://127.0.0.1:* ws://localhost:* http://localhost:*",
    "frame-src 'self' data: blob: file: http: https: orca-preview:",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'"
  ].join('; ')

  // Why serve-only: @vitejs/plugin-react injects an inline refresh preamble in dev; production has no inline scripts.
  export function rendererCspPlugin(): Plugin {
    return {
      name: 'orca-renderer-csp-dev-relaxation',
      apply: 'serve',
      transformIndexHtml(html) {
        return html.replace("script-src 'self' 'wasm-unsafe-eval'", "script-src 'self' 'wasm-unsafe-eval' 'unsafe-inline'")
      }
    }
  }
  ```
  In `src/renderer/index.html` and `src/renderer/popout.html` replace line 6 (`<!-- CSP is relaxed during development; electron-vite injects a stricter policy for production builds -->` — this claim is false: nothing injects one) with the `<meta http-equiv="Content-Security-Policy" content="…" />` line whose content is exactly `RENDERER_CSP`. In `electron.vite.config.ts` add `import { rendererCspPlugin } from './config/build-plugins/renderer-csp'` after line 7 and change line 320 to `plugins: [react(), tailwindcss(), createPdfjsViewerAssetsPlugin(), rendererCspPlugin()],`. Run the test → green.
- [ ] **Step 3: Runtime check (dev and packaged).** `ORCA_BACKGROUND_LAUNCH=1 pnpm dev` and, with the `$electron` skill over CDP on the hidden window, open a Markdown file (Monaco + TextMate wasm), a `.pdf`, a Mermaid block, the Mobile Emulator pane, and the dashboard popout; read the console: expected zero `Refused to … Content Security Policy` lines. Repeat after `pnpm build` on the `file://` renderer. Any violation names the directive to extend; extend `RENDERER_CSP` only with a local scheme/origin, never a remote host.
- [ ] **Step 4: Verify.** `pnpm tc`, `pnpm test config/scripts/renderer-csp.test.ts`, `pnpm run check:code-quality:changed`.
- [ ] **Step 5: Commit.**
  ```
  feat(local-only): ship a strict Content-Security-Policy on the native renderer shells

  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01PskLbdTqJNXxJ7KRnDoDoD
  ```

## Unit U12 — `cloud/` directory and cloud CI

### Task U12.1: Delete `cloud/`, the cloud workflows and action, their ignore/ownership entries, the relay-region docs, and the two unit tests that import the relay workspace
**Files:**
Delete: `cloud/` (whole tree), `.github/workflows/cloud-*.yml` (26 files: cloud-bootstrap-relay-staging-capacity, cloud-deploy-relay-asia-topology, cloud-deploy-relay-fence-broker, cloud-deploy-relay-production-capacity-job, cloud-deploy-relay-production-capacity, cloud-deploy-relay-production-director, cloud-deploy-relay-production-multi-target, cloud-deploy-relay-production-same-cap-job, cloud-deploy-relay-production-same-cap, cloud-deploy-relay-production, cloud-deploy-relay-staging-gce-candidate, cloud-deploy-relay-staging, cloud-monitor-relay-clock-skew, cloud-monitor-relay-production-job, cloud-monitor-relay-production, cloud-operate-relay-asia-admission, cloud-operate-relay-production-rehome-job, cloud-operate-relay-production-rehome, cloud-power-relay-staging, cloud-prove-relay-asia-staging, cloud-prove-relay-staging-capacity, cloud-publish-relay-production, cloud-push-deploy, cloud-recover-relay-staging-c4-image, cloud-requeue-relay-staging-c4-recovery, cloud-verify), `.github/actions/cloud-sql-rollout-lease/`, `docs/relay-region-correction/` (6 files), `tests/e2e/relay-region-correction.unit.test.ts`, `tests/e2e/relay-region-compatibility.unit.test.ts`, `tests/e2e/helpers/relay-execution-process.ts`
Modify: `.oxlintrc.json`:215-216 · `config/oxlint-anti-slop.json`:23 · `config/oxlint-dead-classes.json`:75 · `config/oxlint-design-system.json`:53 · `config/oxlint-react-doctor.json`:28 · `package.json`:330,335 · `.github/CODEOWNERS`:7-10 · `.github/workflows/unit-tests.yml`:97-99,101-115 · `.github/scripts/check-root-directory-entries.mjs`:18 · `config/scripts/check-root-directory-entries.test.mjs`:108-(end of that `it`) · `config/scripts/check-changed-code-quality.mjs`:10 · `config/scripts/check-changed-code-quality.test.mjs`:71 · `config/scripts/pr-code-change-scope.mjs`:331-332 · `config/scripts/pr-code-change-scope.test.mjs`:91-(end of that `it`),453 · `config/scripts/pr-preflight-gates.test.mjs`:56 · `config/scripts/source-tree-walk-benchmark.mjs`:35 · `config/scripts/ci-unit-files.mjs`:33-34 · `config/reliability-gates.jsonc`:3991-4061,21186-21259,21260-21335 · `README.md`:260-261 · `config/performance-audit.md`:7
Tests: `pnpm test config/scripts/check-root-directory-entries.test.mjs config/scripts/check-changed-code-quality.test.mjs config/scripts/pr-code-change-scope.test.mjs config/scripts/pr-preflight-gates.test.mjs config/scripts/check-reliability-gates.test.mjs`; `pnpm run check:reliability-gates`; `pnpm run check:code-quality:changed`
**Interfaces:** Consumes: none (U6 may run before or after; the three gates and two tests removed here are the only ones that reference `cloud/` by path). Produces: no root `cloud` entry; `DESKTOP_IRRELEVANT_PREFIXES` no longer lists cloud paths; `REVIEWED_ROOT_ENTRIES` is empty.

- [ ] **Step 1: Delete the trees.**
  ```bash
  git rm -r -q cloud .github/workflows/cloud-*.yml .github/actions/cloud-sql-rollout-lease docs/relay-region-correction tests/e2e/relay-region-correction.unit.test.ts tests/e2e/relay-region-compatibility.unit.test.ts tests/e2e/helpers/relay-execution-process.ts
  ```
  Expected: `ls cloud .github/actions/cloud-sql-rollout-lease docs/relay-region-correction` all report "No such file"; `ls .github/workflows | rg '^cloud' | wc -l` → 0; `rg -ln "helpers/relay-execution-process" tests src config` → nothing.
- [ ] **Step 2: Lint/format ignore entries.** `.oxlintrc.json`: delete lines 215-216 (`"cloud/**",` and `".github/actions/cloud-sql-rollout-lease/**",`). `config/oxlint-anti-slop.json`: delete line 23 (`"cloud/**",`). In `config/oxlint-dead-classes.json` line 75, `config/oxlint-design-system.json` line 53 and `config/oxlint-react-doctor.json` line 28 remove the `"cloud/**", ` element from the `ignorePatterns` array. `package.json` lint-staged: change line 330 to `"{*.{ts,tsx,js,jsx,mjs,mts,cts},**/*.{ts,tsx,js,jsx,mjs,mts,cts}}": [` and line 335 to `"{*.{json,css},**/*.{json,css}}": [` (the `!(cloud)` extglob only existed to skip the workspace).
- [ ] **Step 3: Ownership, root guard, CI routing.** `.github/CODEOWNERS`: delete lines 7-10 (the relay comment and the three `@Jinwoo-H` lines). `.github/scripts/check-root-directory-entries.mjs` line 18: `const REVIEWED_ROOT_ENTRIES = new Set(['cloud'])` → `const REVIEWED_ROOT_ENTRIES = new Set()`; in `config/scripts/check-root-directory-entries.test.mjs` delete the `it('allows the reviewed cloud workspace directory', ...)` block starting at line 108. `config/scripts/check-changed-code-quality.mjs` line 10: `const ROOT_CODE_QUALITY_IGNORED_PREFIXES = ['cloud/']` → `const ROOT_CODE_QUALITY_IGNORED_PREFIXES = []`; in its test delete line 71. `config/scripts/pr-code-change-scope.mjs`: delete lines 331-332 (`'cloud/',` and `'.github/workflows/cloud-',`); in `pr-code-change-scope.test.mjs` delete the `it('does not start desktop PR Checks for cloud-only diffs', ...)` block starting at line 91 and line 453 (`expect(classifyPrJobs(['cloud/apps/relay/src/index.ts']).static_analysis).toBe(false)`). `config/scripts/pr-preflight-gates.test.mjs` line 56: remove the `['cloud/package.json'], ` element. `config/scripts/source-tree-walk-benchmark.mjs` line 35: `for (const directory of ['src', 'mobile/src', 'cloud/apps'])` → `for (const directory of ['src', 'mobile/src'])` (U6 drops `mobile/src` later). `config/scripts/ci-unit-files.mjs`: delete lines 33-34 (the two `tests/e2e/relay-region-*.unit.test.ts` excludes). `.github/workflows/unit-tests.yml`: delete line 99 (`cloud/pnpm-lock.yaml`) from the `cache-dependency-path` block (leave line 98) and delete lines 101-115 (the comment, the `Install relay integration dependencies` step and the `Test relay integration contracts` step).
- [ ] **Step 4: Reliability gates.** In `config/reliability-gates.jsonc` delete the three whole gate objects, each from its opening `    {` line through its closing `    },` line: `desktop-relay.region-correction-idle-cutover` (lines 3991-4061), `relay.control-activation-ownership` (21186-21259) and `relay.assignment-headroom-scope` (21260-21335). Delete the higher-numbered ranges first so the earlier line numbers stay valid. Run `pnpm run check:reliability-gates` → exit 0 (the checker rejects missing `testFiles`, which is why these cannot be left behind).
- [ ] **Step 5: Docs.** `README.md`: delete lines 260-261 (`The relay that pairs the mobile app ... under [\`cloud/\`](cloud/README.md), with a separate pnpm workspace and setup guide.`) and the blank line that now doubles. `config/performance-audit.md` line 7: `Tests, generated files, \`mobile/\` and \`cloud/\` are outside this source audit.` → `Tests, generated files and \`mobile/\` are outside this source audit.`
- [ ] **Step 6: Verify.** `rg -n "\bcloud/|orca-cloud|cloud-sql-rollout-lease|relay-region-correction" --glob '!node_modules' --glob '!notes' --glob '!docs/local-only/**' .` → remaining hits are only inside `src/main/runtime/relay/**`, `src/main/runtime/push/**`, `src/shared/mobile-push-contract.ts`, `src/renderer/src/components/settings/bitbucket-*` and two `motivatingLinks` URLs in `config/reliability-gates.jsonc` (comments/links owned by U6/U10). Then run the Tests list, `pnpm run check:reliability-gates`, `pnpm run check:readme-local-links`, `pnpm tc`, `pnpm run check:code-quality:changed`.
- [ ] **Step 7: Commit.**
  ```
  chore(local-only): remove the cloud relay workspace, its CI workflows and the relay-region docs

  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01PskLbdTqJNXxJ7KRnDoDoD
  ```

---

## Planner group: U6-U7

## Units U6 and U7 — scope and execution order

Every line number below is from the pristine tree at commit `2a31641ee3` (branch `local-only/spec-a`, read 2026-10-01). Earlier tasks shift later numbers inside shared files (`main-process-runtime-launch.ts`, `pr.yml`, `methods/index.ts`, `package.json`, …): relocate each edit by the quoted identifier or code, never by the number alone, and `sed -n` the range before deleting.

**Execution order (each task is one commit, each commit leaves `pnpm tc` green):**
`U7.1` (browser web client) → `U6.1` (mobile/ tree, CI, bundle build) → `U6.2` (mobile web bundle RPC) → `U6.3` (Orca Mobile UI, preload, `ipc/mobile.ts`) → `U6.4` (push + relay startup wiring) → `U7.3` (`orca serve` / orcad network flags and pairing output) → `U7.2` (WebSocket listener, pairing chain, `runtime/relay/`, `runtime/push/`, E2EE, device registry, E2E widening).

**Kept for Spec B (measured, not deletable here):** `src/main/orcad/` (131-file closure; `src/relay/` SSH relay imports its node-pty diagnosis modules), `src/main/ssh/orcad-*`, the runtime-environments client (`src/main/ipc/runtime-environment*`, `src/shared/remote-runtime-*`, `src/shared/runtime-environment*`, `src/preload/api/runtime-environments-bridge.ts`, renderer `RuntimeEnvironmentsPane` and `src/renderer/src/runtime/web-runtime-*`, `src/main/browser/paired-runtime-browser-*`: 141 seeds / 189 external importers), the CLI remote dial (`src/cli/runtime/websocket-transport.ts`, `runtime-remote-pairing.ts`, `remote-runtime-compat-gate.ts`, `environments.ts`; `client.isRemote` has 40+ consumers), `src/shared/pairing.ts`, `src/shared/mobile-relay-pairing-offer.ts`, `src/shared/mobile-pairing-protocol-limits.ts`, `src/shared/network/pairing-url.ts`, `src/shared/e2ee-crypto.ts`, `src/shared/mobile-e2ee-v2-{framing,contract}.ts` (+ fixtures/tests), `src/shared/pairing-local-ui-fields.ts` (kept RPC `client-ui.ts` imports it), `src/shared/mobile-pairing-custom-address.ts` and the `mobilePairing*`/`showMobileButton` settings keys (settings schema hot files), `src/main/server/serve-readiness.ts`, the headless Electron `--serve` mode itself and the CLI `serve` command skeleton (orcad's browser sidecar spawns `--serve` and talks to it over the unix socket; VM recipes spawn `orca serve --recipe-json`), all `orca-runtime-*mobile-session*` / `runtime-mobile-session-*` projection files (internal state, no network), `src/main/runtime/mobile-notification-dismissal-store*.ts`, `src/main/runtime/mobile-notification-replay.ts`, `src/renderer/src/components/mobile/MobileBrandIcons.tsx` (used by `MobileEmulatorSettingsPane.tsx`), and the `ws` + `tweetnacl` dependencies (CDP proxy, emulator, remote-runtime client).

### Task U7.1: Delete the browser web client (renderer web entry, build, CI)

**Files:**
- Delete: `src/renderer/src/web/` (whole dir, 60+ files incl. `preload-api/`), `src/renderer/web-index.html`, `vite.web.config.ts`, `config/scripts/run-vite-web-build.mjs`, `config/scripts/project-renderer-web-client.mjs`, `config/scripts/project-renderer-web-client.test.mjs`, `config/scripts/verify-web-build.mjs`, `src/renderer/src/hooks/useAutoAckViewedAgent.away.test.ts` (tests the web-client away shim via `createNotificationsApi` at lines 8, 93, 113).
- Modify: `electron.vite.config.ts:339-341`, `package.json` (scripts `dev:web`, `build:web`, `build:web-from-renderer`, `build:desktop`, `build:release`, `build:release:parallel`), `tests/e2e/global-setup.ts:27,35,72-85`, `config/scripts/run-electron-vite-dev.mjs:492-494,519-560`, `.github/workflows/e2e.yml:79-80`, `.github/workflows/terminal-ime-e2e.yml:97`, `.github/workflows/packaged-browser-e2e.yml:60`, `.github/workflows/pr.yml:986-989,1000`, `config/scripts/pr-workflow-parallelism.test.mjs:250-256`.
- Tests: `pnpm test config/scripts/pr-workflow-parallelism.test.mjs src/renderer/src/hooks`, `pnpm tc`.

**Interfaces:** Consumes: none. Produces: `out/web` no longer exists; `getBundledWebClientRoot()` (`src/main/startup/main-process-serve.ts:11-19`) now always returns `undefined` until U7.2 deletes it.

- [ ] **Step 1: Confirm no non-web renderer code imports the web tree.** Run `rg -n "from '(\.\./)+web/|@/web/" src/renderer/src src/preload src/main --glob '!src/renderer/src/web/**'`. Expected: the only hit is `src/renderer/src/hooks/useAutoAckViewedAgent.away.test.ts:8`.
- [ ] **Step 2: Delete the web client sources.**
  ```bash
  git rm -r src/renderer/src/web src/renderer/web-index.html vite.web.config.ts \
    config/scripts/run-vite-web-build.mjs config/scripts/project-renderer-web-client.mjs \
    config/scripts/project-renderer-web-client.test.mjs config/scripts/verify-web-build.mjs \
    src/renderer/src/hooks/useAutoAckViewedAgent.away.test.ts
  ```
- [ ] **Step 3: Drop the `web` rollup input.** In `electron.vite.config.ts` delete line 341 (`web: resolve('src/renderer/web-index.html')`) and the trailing comma on line 340 so the object reads:
  ```ts
        input: {
          index: resolve('src/renderer/index.html'),
          popout: resolve('src/renderer/popout.html')
        }
  ```
- [ ] **Step 4: Remove the web build scripts from `package.json`.** Delete the `dev:web`, `build:web`, `build:web-from-renderer` script lines. In `build:desktop`, `build:release`, `build:release:parallel` delete the ` && pnpm run build:web-from-renderer` segment (keep ` && pnpm run build:mobile-web` for now; U6.1 removes it).
- [ ] **Step 5: Remove the E2E web-client build gate.** In `tests/e2e/global-setup.ts` delete line 27 (`const WEB_E2E_BUILD_TIMEOUT_MS = 300_000`), line 35 (`const outWeb = …`), and the block lines 72-85 (`if (process.env.ORCA_E2E_WEB_CLIENT === '1') { … }`).
- [ ] **Step 6: Remove the dev-server web prepare block.** In `config/scripts/run-electron-vite-dev.mjs` delete the function `getDevWebClientIndexPath` (lines 492-494) and the web-client build block that references `vite.web.config.ts` (lines 519-560: the mtime comparison, the `ORCA_DEV_WEB_PREPARE` early return at 540-546 and the `[viteCli, 'build', '--config', path.join(repoRoot, 'vite.web.config.ts')]` spawn at 549-556). Verify: `rg -n "vite.web|out', 'web'|web client" config/scripts/run-electron-vite-dev.mjs` prints nothing.
- [ ] **Step 7: Remove the CI web-client steps.** Delete `.github/workflows/e2e.yml:79-80` (`- name: Project shared E2E web client` / `run: pnpm run build:web-from-renderer`), `.github/workflows/terminal-ime-e2e.yml:97`, `.github/workflows/packaged-browser-e2e.yml:60` (the `pnpm run build:web-from-renderer` lines), `.github/workflows/pr.yml:986-989` (the `Project web client from renderer build` step) and change `.github/workflows/pr.yml:1000` from `- wait: [linux-package-tools, web-client]` to `- wait: linux-package-tools`.
- [ ] **Step 8: Update the parallelism test.** In `config/scripts/pr-workflow-parallelism.test.mjs` delete the `it(...)` block that contains lines 250-256 (the assertions on `'pnpm run build:web-from-renderer'` and the `build:desktop`/`build:release` `toContain` checks). Run `pnpm test config/scripts/pr-workflow-parallelism.test.mjs`. Expected: passes.
- [ ] **Step 9: Verify.** `pnpm tc` (all three projects green), `pnpm run check:code-quality:changed`, `rg -n 'web-index|build:web' package.json electron.vite.config.ts .github config/scripts tests/e2e --glob '!**/.cross-version-checkouts/**'` → only `config/scripts/*mobile-web*` hits remain (removed in U6.1).
- [ ] **Step 10: Commit.**
  ```
  refactor(local-only): remove the browser web client

  Delete the paired-runtime browser client (src/renderer/src/web, web-index.html,
  vite.web.config.ts), its build/projection scripts and the CI steps that built it.
  The runtime static handler that served it is removed with the WebSocket listener.

  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01PskLbdTqJNXxJ7KRnDoDoD
  ```

### Task U6.1: Delete the `mobile/` tree, mobile CI, and the mobile web bundle build

**Files:**
- Delete: `mobile/` (whole tree; separate pnpm workspace, never imported by `src/`), `.github/workflows/mobile.yml`, `.github/workflows/mobile-ios-release.yml`, `.github/workflows/mobile-android-release.yml`, `.github/actions/install-mobile-dependencies/`, `config/scripts/build-mobile-web-app-bundle.mjs`, `config/scripts/build-mobile-web-app-bundle.test.mjs`, `config/scripts/verify-mobile-web-app-bundle.mjs`, `config/scripts/verify-packaged-mobile-web-bundle.cjs`, `config/scripts/verify-packaged-mobile-web-bundle.test.mjs`, `config/scripts/run-mobile-web-app-checks.mjs`, every `config/scripts/mobile-web-*` file (the 80 files listed by `ls config/scripts | grep -E '^mobile-web'`, including `mobile-web-app-frame-budget-sweep.test.ts`, `mobile-web-bundle-fixture-tree.mjs`, `mobile-web-app-bundle-dependencies.mjs`, `mobile-web-bundle-manifest.mjs`, `mobile-web-page-routes.mjs`, `mobile-web-source-line-endings.mjs`), `config/oxlint-plugins/mobile-pairing-qrcode-import.mjs`, `config/scripts/mobile-pairing-qrcode-import-plugin.test.mjs`.
- Modify: `package.json`, `config/electron-builder.config.cjs:17-20,209,331,335`, `config/scripts/electron-builder-config.test.mjs:7,31,530-545`, `config/knip.json:42`, `.oxlintrc.json:9-12,112`, `.github/workflows/pr.yml` (38-39, 213-220, 744-818, 924-930, 991-995, 1078-1084, 1269, 1307-1308, 1348), `config/scripts/pr-code-change-scope.mjs` (29, 121-142, 422-425, 429-430, 448-451 and `needsMobileDependencies`), `config/scripts/pr-code-change-scope.test.mjs` (cases at 225-250, 315-345, 410-435, 560-575), `config/scripts/pr-workflow-parallelism.test.mjs:5,528,547-561`, the `install-mobile-dependencies` uses and `mobile/pnpm-lock.yaml` cache lines in `hourly-mac-build.yml:182,204-206`, `dev-channel-win-build.yml:208,235-237`, `adhoc-mac-build.yml:202,224-226`, `release-mac-build.yml:66,94-96`, `daily-mac-build.yml:174,198-200`, `win-update-survival-e2e.yml:89,98-101`, `win-crash-survival-e2e.yml:61,74-100,116-119`, `daemon-relocation-spike.yml:60-80`, `windows-signing-rehearsal.yml:62,84-86`, `release-cut.yml:1267-1290,1320,1371-1373`, `config/scripts/websocket-server-loopback-bind.test.ts:32`, `config/scripts/__fixtures__/websocket-server-wildcard-bind-allowlist.txt:12-14`, `config/reliability-gates.jsonc`, `README.md:35-44,233-239,260-261`, `AGENTS.md:28`, `.gitignore:180,199-202`.
- Tests: `pnpm test config/scripts/electron-builder-config.test.mjs config/scripts/pr-code-change-scope.test.mjs config/scripts/pr-workflow-parallelism.test.mjs config/scripts/websocket-server-loopback-bind.test.ts config/scripts/check-max-lines-ratchet.test.mjs`, `pnpm run check:reliability-gates`, `pnpm run check:readme-local-links`.

**Interfaces:** Consumes: none. Produces: `out/mobile-web` is never built; `electron-builder.config.cjs.beforePack(context)` loses its second parameter.

- [ ] **Step 1: Delete the trees.**
  ```bash
  git rm -r -q mobile .github/workflows/mobile.yml .github/workflows/mobile-ios-release.yml \
    .github/workflows/mobile-android-release.yml .github/actions/install-mobile-dependencies \
    config/oxlint-plugins/mobile-pairing-qrcode-import.mjs config/scripts/mobile-pairing-qrcode-import-plugin.test.mjs \
    config/scripts/build-mobile-web-app-bundle.mjs config/scripts/build-mobile-web-app-bundle.test.mjs \
    config/scripts/verify-mobile-web-app-bundle.mjs config/scripts/verify-packaged-mobile-web-bundle.cjs \
    config/scripts/verify-packaged-mobile-web-bundle.test.mjs config/scripts/run-mobile-web-app-checks.mjs
  git rm -q config/scripts/mobile-web-*
  ```
  Expected: `ls config/scripts | grep -c mobile` prints `0`.
- [ ] **Step 2: `package.json`.** Delete the `build:mobile-web` script line. In `build:desktop`, `build:release`, `build:release:parallel` delete the ` && pnpm run build:mobile-web` segment. In `audit:code-quality:native` change `src config tests mobile --deny-warnings` to `src config tests --deny-warnings`; in `audit:anti-slop` change `src config tests mobile --deny-warnings` to `src config tests --deny-warnings`.
- [ ] **Step 3: electron-builder.** In `config/electron-builder.config.cjs` delete lines 17-20 (the `MOBILE_WEB_BUNDLE_DIR, assertMobileWebBundleBuilt` require), line 209 (`'!mobile{,/**/*}',`), change line 331 `beforePack: (context, mobileWebBundleDir = MOBILE_WEB_BUNDLE_DIR) => {` to `beforePack: (context) => {`, delete line 335 (`assertMobileWebBundleBuilt(mobileWebBundleDir)`). In `config/scripts/electron-builder-config.test.mjs` delete line 7 (`writeMobileWebBundleFixtureTree` import), line 31 (`'!mobile{,/**/*}',`), the `beforeAll`/`afterAll` scratch-bundle block at lines 530-543 (comment through `afterAll(...)`) and the `let scratch` / `let bundleDir` declarations, and change line 545 to `electronBuilderConfig.beforePack({ electronPlatformName: process.platform, arch })`.
- [ ] **Step 4: Lint configs.** `config/knip.json:42`: change `"ignore": ["mobile/**", "out/**", ...]` to `"ignore": ["out/**", "dist/**", "node_modules/**", "resources/**"]`. `.oxlintrc.json`: delete the plugin object lines 9-12 (`{ "name": "mobile-pairing", "specifier": "./config/oxlint-plugins/mobile-pairing-qrcode-import.mjs" },`) and line 112 (`"mobile-pairing/no-eager-qrcode-import": "error",`).
- [ ] **Step 5: `pr.yml`.** Delete lines 38-39 (`mobile_dependencies:` and `mobile_web_app:` outputs), 213-220 (the "Mobile installation changes import resolution" comment, `- wait: native-code-quality` stays, delete the comment + `- uses: ./.github/actions/install-mobile-dependencies` + `if:` lines 216-220), the whole `mobile_web_app:` job 744-818, 928-930 (comment + uses), 991-995 (`Build mobile web bundle` step and its comment 991-993), 1082-1084, 1269 (`- mobile_web_app`), 1307-1308 (`MOBILE_WEB_APP` env lines), 1348 (`check_job mobile_web_app …`), and the `mobile/pnpm-lock.yaml` lines under every `cache-dependency-path:` (926, 1080). Apply the same two deletions (`mobile/pnpm-lock.yaml` cache line; the three-line `# Why here…` + `- uses: ./.github/actions/install-mobile-dependencies` block) in `hourly-mac-build.yml`, `dev-channel-win-build.yml`, `adhoc-mac-build.yml`, `release-mac-build.yml`, `daily-mac-build.yml`, `win-update-survival-e2e.yml`, `win-crash-survival-e2e.yml` (also drop the five `mobile/...` entries 96-100 from the cache-key list and the `mobile/**` segment at line 89 of `win-update-survival-e2e.yml`), `daemon-relocation-spike.yml` (70-74 cache-key entries, 77-80 uses), `windows-signing-rehearsal.yml`, `release-cut.yml` (1320 cache line, 1371-1373 uses, and the `Restore composite actions from the workflow ref` step at 1286-1292 whose `required=(.github/actions/install-mobile-dependencies/action.yml)` array would now reference a deleted file — delete that step and the comment 1267-1268).
- [ ] **Step 6: PR scope script.** In `config/scripts/pr-code-change-scope.mjs` delete line 29 (`'mobile_web_app',`), lines 121-142 (`MOBILE_WEB_APP_PREFIXES` and `changesMobileWebApp`), the `needsMobileDependencies` function (find with `rg -n 'function needsMobileDependencies'`), lines 422-425 (the "Why outside should_run" comment + `jobs.mobile_web_app = …`), lines 429-430 (`mobile_dependencies: (shouldRun || jobs.static_analysis) && needsMobileDependencies(changedFiles),`), and lines 448-451 (`case 'mobile_web_app': return changesMobileWebApp` + its comment). In `config/scripts/pr-code-change-scope.test.mjs` delete every `it`/`expect` that references `mobile_web_app` or `mobile_dependencies` (lines 229, 244, 318-341, 410-435, 560-575 as of this read; verify with `rg -n 'mobile' config/scripts/pr-code-change-scope.test.mjs`). In `config/scripts/pr-workflow-parallelism.test.mjs` delete line 5 (`MOBILE_WEB_APP_DEPENDENCIES_REQUIRED_ENV` import), line 528 (`'mobile_web_app',`), lines 547-548, and the `it('makes the mobile_web_app job refuse to skip…')` block at 551-561.
- [ ] **Step 7: WebSocket bind ratchet.** `config/scripts/__fixtures__/websocket-server-wildcard-bind-allowlist.txt`: delete lines 12-14 (the `mobile/scripts/mock-server.ts` entry and its two comment lines). `config/scripts/websocket-server-loopback-bind.test.ts:32`: change `const WILDCARD_BIND_PIN = 1` to `const WILDCARD_BIND_PIN = 0`. Run `pnpm test config/scripts/websocket-server-loopback-bind.test.ts`. Expected: pass (no stale allowlist entry, 0 wildcard binds).
- [ ] **Step 8: Reliability gates.** Run `pnpm run check:reliability-gates`. Expected failures name `mobile/...` test files under gates `agent-session.structured-send-at-most-once`, `mobile-ui.drawer-close-continuity`, `mobile-relay.endpoint-recovery`, `mobile-transport.lifecycle-liveness`, `orchestration.settled-worker-terminal-release`, `terminal-query.mobile-view-authority`, `terminal-runtime.mobile-stream-budget`. In `config/reliability-gates.jsonc`: delete the three gates whose `testFiles` are entirely mobile (`mobile-ui.drawer-close-continuity`, `mobile-relay.endpoint-recovery`, `mobile-transport.lifecycle-liveness`); in the other four delete each `mobile/...` entry from `testFiles`, delete the `commands` entry that is the `pnpm --dir mobile test …` invocation (and any `evidence`/`assertions` objects whose `file` is a `mobile/...` path), keep the gate. Re-run until it reports no failures.
- [ ] **Step 9: Docs.** `README.md`: delete the `### Mobile Companion` table cell (lines 35-44, from `### Mobile Companion` through the closing `</td>` of the gif cell), the `### Mobile Companion — iOS, Android` section (233-239), and lines 260-261 (`The relay that pairs the mobile app…` sentence; U12 deletes `cloud/`). `AGENTS.md:28`: remove the clause `, and never add a per-file \`max-lines\` bump in \`mobile/.oxlintrc.json\``. `.gitignore`: delete lines 180 (`/mobile/.clawpatch/`) and 199-202 (the mobile Gemfile comment + `/mobile/vendor/`). Run `pnpm run check:readme-local-links`.
- [ ] **Step 10: Verify.** `pnpm tc`; `pnpm test config/scripts/electron-builder-config.test.mjs config/scripts/pr-code-change-scope.test.mjs config/scripts/pr-workflow-parallelism.test.mjs config/scripts/check-max-lines-ratchet.test.mjs config/scripts/websocket-server-loopback-bind.test.ts`; `pnpm run check:max-lines-ratchet` (script tolerates the missing `mobile/.oxlintrc.json` via `existsSync` at line 60); `pnpm run check:code-quality:changed`; `rg -n 'install-mobile-dependencies|build:mobile-web|mobile/pnpm-lock' .github package.json config` → no hits.
- [ ] **Step 11: Commit.**
  ```
  refactor(local-only): remove the Orca Mobile app tree and its CI

  Delete mobile/ (separate Expo workspace), the mobile release workflows and
  composite action, the mobile web bundle build/verify scripts, and the
  electron-builder beforePack assertion that required out/mobile-web.

  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01PskLbdTqJNXxJ7KRnDoDoD
  ```

### Task U6.2: Delete the mobile web bundle RPC and runtime capability

**Files:**
- Delete: `src/main/runtime/rpc/methods/mobile-web-bundle.ts`, `mobile-web-bundle.test.ts`, `mobile-web-bundle.test-fixture.ts`, `mobile-web-bundle-asset-reader.ts`, `mobile-web-bundle-range-encoding.ts`, `mobile-web-bundle-range.test.ts`, `mobile-web-bundle-read-admission.ts`, `mobile-web-bundle-read-concurrency.test.ts`, `mobile-web-bundle-window-refusals.test.ts`, `src/main/runtime/bundled-mobile-web-bundle.ts`, `src/main/runtime/orca-runtime-tests/mobile-web-bundle-capability.spec.ts`, `src/shared/mobile-web-bundle/` (6 files).
- Modify: `src/main/runtime/rpc/methods/index.ts:41,99`, `src/main/runtime/orca-runtime-get-status.ts:25-26,110-115`, `src/shared/rpc-contract/rpc-params-catalog.generated.ts` (regenerated).
- Tests: `pnpm test src/main/runtime/orca-runtime-get-status src/main/runtime/rpc/methods/index`, `pnpm run verify:rpc-params-catalog`.

**Interfaces:** Consumes: none. Produces: `ALL_RPC_METHODS` no longer contains `mobileWebBundle.*`; `status.get` capabilities never include `MOBILE_WEB_BUNDLE_CAPABILITY`.

- [ ] **Step 1: Delete.**
  ```bash
  git rm -q src/main/runtime/rpc/methods/mobile-web-bundle*.ts src/main/runtime/bundled-mobile-web-bundle.ts \
    src/main/runtime/orca-runtime-tests/mobile-web-bundle-capability.spec.ts
  git rm -r -q src/shared/mobile-web-bundle
  ```
- [ ] **Step 2: Registry.** In `src/main/runtime/rpc/methods/index.ts` delete line 41 (`import { MOBILE_WEB_BUNDLE_METHODS } from './mobile-web-bundle'`) and line 99 (`...MOBILE_WEB_BUNDLE_METHODS,`).
- [ ] **Step 3: Status capability.** In `src/main/runtime/orca-runtime-get-status.ts` delete lines 25-26 (the two imports) and lines 110-115 (the `// Why not a static capability…` comment and `if (loadBundledMobileWebBundle()) { capabilities.push(MOBILE_WEB_BUNDLE_CAPABILITY) }`).
- [ ] **Step 4: Regenerate the catalog.** `pnpm run generate:rpc-params-catalog` then `pnpm run verify:rpc-params-catalog`. Expected: `rpc-params-catalog.generated.ts` loses the `mobile-web-bundle/bundle-rpc-contract` import and the `mobileWebBundle.*` entries; verify prints OK.
- [ ] **Step 5: Verify.** `pnpm tc`; `pnpm test src/main/runtime/rpc/methods src/main/runtime/orca-runtime-tests`; `rg -n 'mobile-web-bundle|MobileWebBundle|mobileWebBundle' src/ --glob '!src/main/runtime/runtime-rpc/runtime-rpc-mobile-method-allowlist.ts' --glob '!src/main/runtime/runtime-rpc-mobile-method-allowlist*'` → no hits (the allowlist strings go in U7.2).
- [ ] **Step 6: Commit.**
  ```
  refactor(local-only): remove the mobile web bundle RPC surface

  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01PskLbdTqJNXxJ7KRnDoDoD
  ```

### Task U6.3: Delete the Orca Mobile UI, preload API, `ipc/mobile.ts`, and the runtime pairing-link generator

**Files:**
- Delete (renderer): every file in `src/renderer/src/components/mobile/` except `MobileBrandIcons.tsx` (the emulator pane imports it), `src/renderer/src/components/settings/MobilePane.tsx`, `MobilePane.test.tsx`, `MobilePaneAddressSearch.test.tsx`, `MobileSettingsPane.tsx`, `MobilePairingSetupSection.tsx` (+test), `MobilePairingQrSection.tsx` (+test), `MobilePairingConnectionOptions.tsx` (+test), `MobilePairingPathOption.tsx`, `MobilePairedDevicesSection.tsx`, `MobileRelayBetaNotice.tsx`, `MobileAutoRestoreFitSection.tsx`, `mobile-auto-restore-options.ts`, `mobile-network-interface-selection.ts` (+test), `mobile-pairing-device-polling.ts` (+test), `mobile-pane-search.ts` (+test), `mobile-settings-search.ts`, `use-mobile-paired-device-revocation.ts`, `RuntimePairingUrlGenerator.tsx` (+test), `RuntimePairingGeneratorForm.tsx` (+test), `RuntimePairingGeneratedUrlRows.tsx`, `RuntimeAccessGrantList.tsx`, `runtime-pairing-link-state.ts`, `src/renderer/src/components/sidebar/mobile-sidebar-onboarding-badge.ts` (+test), `src/renderer/src/hooks/unpaired-device-auth-notification.ts` (+test). (`src/shared/runtime-pairing-reach.ts` stays until U7.2: `device-registry.ts` and `runtime-rpc-pairing.ts` import it.)
- Delete (main/preload): `src/main/ipc/mobile.ts`, `src/main/ipc/mobile.test.ts`, `src/preload/api/mobile-api.ts`, `src/preload/api/mobile-bridge.ts`.
- Modify: `src/renderer/src/components/sidebar/SidebarNav.tsx` (2, 8, 11, 19-23, 57, 65, 69, 72, 76-78, 214-286), `SidebarNav.test.tsx` (19, 58-60, 93, 132, the `it` blocks at 266, 302, 383), `src/renderer/src/hooks/settings-navigation-capability-sections.ts` (8, 23, 201-214), `src/renderer/src/lib/settings-navigation-types.ts:49`, `src/renderer/src/components/settings/settings-setup-workflow-section-renderers.tsx` (6, 100-118), `settings-page-renderer.tsx` (20, 127), `src/renderer/src/app-shell/AppWorkspaceShell.tsx` (26, 78), `src/renderer/src/store/slices/ui/ui-slice-contract-core.ts` (118, 152, 195-196), `ui-slice-view-actions.ts` (95-104), `ui-slice-task-actions.ts:26`, `src/renderer/src/components/settings/AppearanceWindowSidebarSection.tsx` (287-312), `appearance-sidebar-search.ts` (171-189), `src/main/menu/register-app-menu.ts` (15, 265-270), `src/main/startup/main-process-i18n-menu.ts:92`, `src/renderer/src/hooks/ipc-events/settings-sidebar-ipc-bridge.ts` (4, 60-88), `src/preload/index.ts` (84, 183), `src/preload/api-types.ts` (39, 154), `src/renderer/src/components/settings/RuntimeEnvironmentsPane.tsx` (21, 62, 262-266), `runtime-server-workflow-sections.tsx` (1 `Share2`, 5, 6, 43-53, 100-169), `src/main/startup/main-process-runtime-launch.ts` (10, 97-119), `src/main/startup/main-process-state.ts:93`, `src/main/startup/main-process-runtime-launch-activation.test.ts` (31, 34), the six `src/renderer/src/i18n/locales/*.json`, `src/renderer/src/i18n/en-runtime-required.json`.
- Tests: `pnpm test src/renderer/src/components/sidebar src/renderer/src/components/settings src/renderer/src/store src/renderer/src/hooks src/main/startup/main-process-runtime-launch-activation.test.ts src/renderer/src/i18n`, `pnpm run verify:localization-catalogs`, `pnpm run verify:localization-extraction`, `pnpm run verify:localization-coverage`.

**Interfaces:** Consumes: U7.1 (web tree already gone, so `web-preload-api.ts`/`web-mobile-api.ts` need no edit). Produces: `window.api.mobile` no longer exists; `activeView` union loses `'mobile'`; `SETTINGS_PANE` ids lose `'mobile'`; `AppearanceMenuState` loses `showMobileButton`; `state.pendingUnpairedDeviceAuthFailure` gone. `runtimeRpc.setOnUnpairedDeviceAuthFailure` is no longer called (method deleted in U7.2).

- [ ] **Step 1: Delete the files.**
  ```bash
  cd src/renderer/src/components/mobile && git rm -r -q $(ls | grep -v '^MobileBrandIcons.tsx$') && cd -
  git rm -q src/renderer/src/components/settings/Mobile{Pane,Pane.test,PaneAddressSearch.test,SettingsPane,PairingSetupSection,PairingSetupSection.test,PairingQrSection,PairingQrSection.test,PairingConnectionOptions,PairingConnectionOptions.test,PairingPathOption,PairedDevicesSection,RelayBetaNotice,AutoRestoreFitSection}.tsx
  git rm -q src/renderer/src/components/settings/{mobile-auto-restore-options,mobile-network-interface-selection,mobile-network-interface-selection.test,mobile-pairing-device-polling,mobile-pairing-device-polling.test,mobile-pane-search,mobile-pane-search.test,mobile-settings-search,use-mobile-paired-device-revocation,runtime-pairing-link-state}.ts
  git rm -q src/renderer/src/components/settings/RuntimePairing{UrlGenerator,UrlGenerator.test,GeneratorForm,GeneratorForm.test,GeneratedUrlRows}.tsx src/renderer/src/components/settings/RuntimeAccessGrantList.tsx
  git rm -q src/renderer/src/components/sidebar/mobile-sidebar-onboarding-badge{,.test}.ts src/renderer/src/hooks/unpaired-device-auth-notification{,.test}.ts
  git rm -q src/main/ipc/mobile.ts src/main/ipc/mobile.test.ts src/preload/api/mobile-api.ts src/preload/api/mobile-bridge.ts
  ```
  Expected: `ls src/renderer/src/components/mobile` prints only `MobileBrandIcons.tsx`; `ls src/renderer/src/components/settings | grep -E -i '^mobile|^Mobile' ` prints only the `MobileEmulator*` files and `mobile-emulator-search.ts`.
- [ ] **Step 2: SidebarNav.** In `src/renderer/src/components/sidebar/SidebarNav.tsx`: change line 2 to `import { BookOpen, CalendarClock, Files, Search } from 'lucide-react'`; delete line 8 (`useMobileSidebarOnboardingBadge` import), line 10 (`Button` import) and line 11 (`Tooltip` import) if `rg -c '<Button|<Tooltip' SidebarNav.tsx` prints 0 after the block deletion; delete lines 19-23 (`shouldShowMobileButton`), 57 (`openMobilePage`), 65 (`showMobileButton`), 69 (`mobileActive`), 72 (`mobileOnboardingBadge`), 76-78 (`hideMobileButton` callback), and the mobile block lines 214-286 (`{showMobileButton ? (` … `) : null}` ending just before `</div>` at 287). In `SidebarNav.test.tsx` delete line 19 (`openMobilePage: vi.fn(),`), the `vi.mock('./mobile-sidebar-onboarding-badge', …)` block (58-60), `shouldShowMobileButton` from the `./SidebarNav` import at line 93, line 132 (`openMobilePage: mocks.openMobilePage,`), and the three `it` blocks starting at lines 266, 302 and 383 (`tc:web` typechecks renderer tests, so a stale import fails `pnpm tc`).
- [ ] **Step 3: Settings navigation and section.** `settings-navigation-capability-sections.ts`: delete line 8 (`getMobileSettingsPaneSearchEntries` import), line 23 (`Smartphone,`), lines 201-214 (the `...(showDesktopOnlySettings ? [{ id: 'mobile', … }] : [])` spread). `settings-navigation-types.ts`: delete line 49 (`'mobile',`). `settings-setup-workflow-section-renderers.tsx`: delete line 6 and the `renderMobileSettingsSection` function (lines 100-118 plus the blank line after). `settings-page-renderer.tsx`: delete line 20 and line 127. Run `rg -n "'mobile'" src/renderer/src --glob '!*.test.*' | grep -v emulator` → only the `ui-slice*` lines handled in step 4 remain.
- [ ] **Step 4: Store and shell.** `ui-slice-contract-core.ts`: delete line 118 (`| 'mobile'`), line 152 (`previousViewBeforeMobile: …`), lines 195-196 (`openMobilePage` / `closeMobilePage`). `ui-slice-view-actions.ts`: delete lines 95-104 (`openMobilePage: () => …` through `closeMobilePage: () => set(…)`). `ui-slice-task-actions.ts`: delete line 26 (`previousViewBeforeMobile: 'terminal',`). `AppWorkspaceShell.tsx`: delete line 26 (`const MobilePage = lazy(…)`) and line 78 (`{activeView === 'mobile' ? <MobilePage /> : null}`).
- [ ] **Step 5: Appearance toggle and menu.** `AppearanceWindowSidebarSection.tsx`: delete lines 287-312 (the `<SearchableSetting title=… 'Show Orca Mobile Button'` block through its `</SearchableSetting>`; keep the blank line 313). `appearance-sidebar-search.ts`: delete the entry object at lines 171-189 (title key `auto.components.settings.appearance.search.1de96ec8a6`). `src/main/menu/register-app-menu.ts`: delete line 15 (`showMobileButton: boolean`) and the menu item object at lines 265-270 (`{ label: translateMain('menu.showMobileButton', …) … click: () => onToggleAppearance('showMobileButton') },`). `src/main/startup/main-process-i18n-menu.ts`: delete line 92 (`showMobileButton: settings.showMobileButton !== false,`). The `showMobileButton` setting key stays in `global-settings-types.ts`, `default-global-settings.ts` and `ipc/settings.ts:70` as a dormant key (no schema change).
- [ ] **Step 6: IPC bridge toast.** `src/renderer/src/hooks/ipc-events/settings-sidebar-ipc-bridge.ts`: delete line 4 (`subscribeToUnpairedDeviceAuthNotification` import) and lines 60-88 (the `// Why: a phone stuck…` comment through the closing `)` of that `unsubs.push(...)`). `toast` and `translate` stay imported (used by the other toasts in the file).
- [ ] **Step 7: Preload.** `src/preload/index.ts`: delete line 84 (`import { mobileApi } …`) and line 183 (`mobile: mobileApi,`). `src/preload/api-types.ts`: delete line 39 (`import type { MobileApi } …`) and line 154 (`mobile: MobileApi`).
- [ ] **Step 8: Remote-servers pane share section.** `RuntimeEnvironmentsPane.tsx`: delete line 21 (`RuntimeServerShareSection,`), line 62 (`const [shareServerFormOpen, setShareServerFormOpen] = useState(true)`), lines 262-266 (`{visibleWorkflow === 'share' && canGeneratePairingUrl ? ( <RuntimeServerShareSection … /> ) : null}`). `runtime-server-workflow-sections.tsx`: delete the `RuntimeServerShareSection` function (lines 100-169, from `export function RuntimeServerShareSection({` through its closing `}`), delete lines 5-6 (`RuntimePairingUrlGenerator`, `MachineNameField` imports), change line 1 to `import { ChevronDown } from 'lucide-react'`, and delete the `'share'` workflow tuple at lines 43-53 (`[ 'share', translate(…shareWorkflow…), translate(…shareWorkflowHelp…) ],`). Then `rg -n 'canGeneratePairingUrl' src/renderer --glob '!*.test.*'`: delete the `.filter(([value]) => value !== 'share' || canGeneratePairingUrl)` line (52 before edits) and leave the `canGeneratePairingUrl` prop plumbing in place (harmless, Spec B deletes the pane).
- [ ] **Step 9: Main registration.** `src/main/startup/main-process-runtime-launch.ts`: delete line 10 (`import { registerMobileHandlers } from '../ipc/mobile'`) and lines 97-119 (`registerMobileHandlers(runtimeRpc, { … })` through `runtimeRpc.setOnUnpairedDeviceAuthFailure(() => { … })`). `src/main/startup/main-process-state.ts`: delete line 93 (`pendingUnpairedDeviceAuthFailure: false,`). `main-process-runtime-launch-activation.test.ts`: delete line 31 (`setOnUnpairedDeviceAuthFailure = vi.fn()`) and line 34 (`vi.mock('../ipc/mobile', …)`).
- [ ] **Step 10: Verify imports are closed.** `pnpm tc` must pass. Then `rg -n "api\.mobile|mobile-api|mobile-bridge|MobilePage|MobileSettingsPane|openMobilePage|unpairedDeviceAuthFailure|pendingUnpairedDeviceAuthFailure" src/ --glob '!src/main/runtime/**' --glob '!src/shared/**'` → no hits.
- [ ] **Step 11: Localization catalogs.** Prune the orphaned keys, then verify:
  ```bash
  node -e '
  const fs=require("fs"),cp=require("child_process");
  const dir="src/renderer/src/i18n/locales";const en=JSON.parse(fs.readFileSync(dir+"/en.json","utf8"));
  const flat=(o,p="",out=[])=>{for(const[k,v]of Object.entries(o)){const key=p?p+"."+k:k;typeof v==="string"?out.push(key):flat(v,key,out)}return out};
  const suspect=/mobile|Mobile|RuntimePairing|RuntimeAccessGrant|pairing\.|unpaired|shareWorkflow|advertiseThisApp/;
  const orphan=flat(en).filter(k=>suspect.test(k)&&cp.spawnSync("rg",["-q","-F",k,"src/renderer/src","src/main"]).status!==0);
  const del=(o,path)=>{const[h,...r]=path;if(!(h in o))return;if(r.length===0){delete o[h];return}del(o[h],r);if(Object.keys(o[h]).length===0)delete o[h]};
  for(const f of fs.readdirSync(dir)){const p=dir+"/"+f;const c=JSON.parse(fs.readFileSync(p,"utf8"));for(const k of orphan)del(c,k.split("."));fs.writeFileSync(p,JSON.stringify(c,null,2)+"\n")}
  console.log("pruned",orphan.length,"keys");'
  pnpm run sync:localization-runtime-catalog
  pnpm run verify:localization-catalogs && pnpm run verify:localization-extraction && pnpm run verify:localization-coverage
  pnpm format
  ```
  Expected: `pruned N keys` with N > 0 (the `auto.components.mobile.*`, `auto.components.settings.Mobile*`, `auto.components.settings.RuntimePairing*`, `auto.hooks.useSettingsNavigationMetadata.1cd25673df/95a1886d94`, `auto.components.settings.Settings.c40dadaac8/c6c01ac209`, `auto.components.settings.AppearancePane.9da1020447/61d842eca0`, `auto.components.sidebar.SidebarNav.1b5c41caee/c86d83b5c3`, `auto.hooks.useIpcEvents.ef223fbb6b/11992d0337/6573cfe955` families); `menu.showMobileButton` leaves `en-runtime-required.json`; the three verifiers exit 0; `pnpm test src/renderer/src/i18n` passes.
- [ ] **Step 12: Verify.** `pnpm tc`; `pnpm test src/renderer/src/components/sidebar src/renderer/src/components/settings src/renderer/src/store src/renderer/src/hooks src/main/startup/main-process-runtime-launch-activation.test.ts src/main/menu src/renderer/src/i18n`; `pnpm run check:code-quality:changed`; `pnpm run check:reliability-gates` (if it names a deleted renderer test file, remove that path from the gate's `testFiles` and `commands`).
- [ ] **Step 13: Commit.**
  ```
  refactor(local-only): remove the Orca Mobile desktop UI and pairing IPC

  Delete the Mobile page, Settings > Mobile, the sidebar phone button and its
  appearance/menu toggles, the preload mobile API, ipc/mobile.ts and the
  runtime pairing-link generator in the Remote servers pane.

  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01PskLbdTqJNXxJ7KRnDoDoD
  ```

### Task U6.4: Unwire mobile push and the cloud relay from startup

**Files:**
- Delete: `src/main/startup/main-process-push-startup.ts`, `src/main/startup/main-process-relay-status.ts`, `src/main/orcad/orcad-push-startup.test.ts`, `tests/e2e/relay-region-compatibility.unit.test.ts`, `tests/e2e/relay-region-correction.unit.test.ts`, `tests/tools/relay-bench/` (whole dir), `docs/reference/relay-regional-placement.md`, `docs/relay-region-correction/` (whole dir).
- Modify: `src/main/startup/main-process-runtime-launch.ts` (1, 3-4, 16-17, 39, 165-167, 248-283), `src/main/startup/main-process-state.ts` (16-17, 27, 89-92), `src/main/startup/main-process-quit.ts` (77-78, 111-112), `src/main/startup/main-window-core-services.ts` (18, 89, 96-100), `src/main/orca-profiles/profile-cloud-auth-config.ts` (6, 103-113), `src/main/orcad/orcad-entry.ts` (169-170, 307-313), `src/main/startup/main-process-runtime-launch-activation.test.ts` (42-46, 81), `config/scripts/ci-unit-files.mjs:33-34`, `config/reliability-gates.jsonc` (gates `desktop-relay.region-correction-idle-cutover`, `mobile-push.headless-startup-and-policy`).
- Tests: `pnpm test src/main/startup src/main/orcad/orcad-entry.test.ts src/main/orca-profiles`, `pnpm run check:reliability-gates`.

**Interfaces:** Consumes: U6.3 (runtime-launch lines already shifted). Produces: `DesktopRelayService`, `DesktopPushService`, `RelayRevokeOutbox`, `PushUnregisterOutbox` are constructed nowhere outside `src/main/runtime/` (the directories themselves are deleted in U7.2); `getOrcaPushGatewayUrl` no longer exists (U5 must not depend on it; if U5 runs first it must leave `resolvePushGatewayOrigin`'s importer intact until this task).

- [ ] **Step 0: Confirm the cluster does not import the startup modules.** `rg -l 'main-process-relay-status|main-process-push-startup|main-process-state' src/main/runtime/relay src/main/runtime/push` must print nothing (verified clean at `2a31641ee3`); if it ever hits, move that file's deletion into U7.2.
- [ ] **Step 1: Delete files.**
  ```bash
  git rm -q src/main/startup/main-process-push-startup.ts src/main/startup/main-process-relay-status.ts \
    src/main/orcad/orcad-push-startup.test.ts tests/e2e/relay-region-compatibility.unit.test.ts tests/e2e/relay-region-correction.unit.test.ts \
    docs/reference/relay-regional-placement.md
  git rm -r -q tests/tools/relay-bench docs/relay-region-correction
  ```
- [ ] **Step 2: Startup launch file.** In `src/main/startup/main-process-runtime-launch.ts` (line numbers as after U6.3): change line 1 to `import { app, type BrowserWindow } from 'electron'` (drop `powerMonitor`); delete line 3 (`getOrcaCloudAuthConfig` import), line 4 (`getProfileUserDataPath` import), lines 16-17 (`main-process-relay-status` and `DesktopRelayService` imports), line 39 (`startDesktopPushService` import); in `launchServeMode` delete the comment + call `startDesktopPushService(runtimeRpc)` (the three lines `// Why: a phone paired to a headless host…` through `startDesktopPushService(runtimeRpc)`); in `launchDesktopMode` delete the block from the comment `// Why after the proxy await: the push gateway client…` through the closing `}` of `if (cloudAuth.configured) { … }` (original lines 252-283), keeping `await state.initialProxyApplicationReady` and the `win.once('show', …)` block.
- [ ] **Step 3: State, quit, window services.** `main-process-state.ts`: delete lines 16-17 (`DesktopRelayService`, `DesktopPushService` type imports), line 27 (`RelayBrokerStatus` import), lines 89-92 (`desktopRelayService`, `desktopPushService`, `desktopRelayStatus`, `desktopRelayCellUrl`). `main-process-quit.ts`: delete lines 77-78 (`state.desktopRelayService?.fenceAndCloseNow()` / `state.runtimeRpc?.setMobileRelayPairingProvider(null)`) and 111-112 (`// A renderer can veto before-quit; push must survive…` / `state.desktopPushService?.stop()`). `main-window-core-services.ts`: delete line 18 (`RELAY_HOST_CLOSE_REASON` import), line 89 (`state.desktopRelayService?.fenceAndCloseNow()`), lines 96-100 (`onOrcaProfileAuthMutation: …`, the two comment lines, `onBeforeOrcaProfileSignOut: …`; both options are optional in `register-core-handlers.ts:103-104`).
- [ ] **Step 4: Cloud auth config and orcad.** `profile-cloud-auth-config.ts`: delete line 6 (`resolvePushGatewayOrigin` import) and lines 103-113 (the JSDoc + `getOrcaPushGatewayUrl`). `orcad-entry.ts`: delete lines 169-170 (`DesktopPushService` / `resolvePushGatewayOrigin` dynamic imports) and lines 307-313 (`const pushService = DesktopPushService.create({…})` through `getAppEnvironment().onWillQuit(() => pushService?.stop())`).
- [ ] **Step 5: Tests and unit excludes.** `main-process-runtime-launch-activation.test.ts`: delete the `vi.mock('./main-process-relay-status', …)` block (42-45), line 46 (`vi.mock('../runtime/relay/desktop-relay-service', …)`), line 81 (`vi.mock('./main-process-push-startup', …)`). `config/scripts/ci-unit-files.mjs`: delete lines 33-34 (the two `tests/e2e/relay-region-*.unit.test.ts` excludes).
- [ ] **Step 6: Reliability gates.** Run `pnpm run check:reliability-gates`; delete gate `desktop-relay.region-correction-idle-cutover` (its only test file is gone) and remove `src/main/orcad/orcad-push-startup.test.ts` from `mobile-push.headless-startup-and-policy` (`testFiles`, the matching `commands` entry and its `assertions` object); re-run until clean. (The remaining push/relay gates are removed in U7.2 with their test files.)
- [ ] **Step 7: Verify.** `pnpm tc`; `pnpm test src/main/startup src/main/orcad/orcad-entry.test.ts src/main/orca-profiles`; `rg -n 'desktopRelayService|desktopPushService|DesktopRelayService|DesktopPushService|startDesktopPushService|getDesktopRelayStatus' src/ --glob '!src/main/runtime/**'` → no hits; `pnpm run check:code-quality:changed`.
- [ ] **Step 8: Commit.**
  ```
  refactor(local-only): stop starting the mobile push and relay services

  Remove the desktop/orcad startup wiring for DesktopPushService and
  DesktopRelayService, the relay status publisher, the relay-region wire tests
  and bench tools. The runtime/push and runtime/relay trees are deleted with
  the WebSocket listener.

  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01PskLbdTqJNXxJ7KRnDoDoD
  ```

### Task U7.3: Strip the network mode from `orca serve` and orcad (flags, pairing output, port/bind)

**Files:**
- Delete: `src/main/orcad/orcad-bind-address.ts`, `src/main/orcad/orcad-bind-address.test.ts`, `config/scripts/runtime-serve-terminal-smoke.mjs`, `config/scripts/orcad-terminal-smoke-change-scope.mjs` (+ `.test.mjs` if present), `docs/reference/headless-linux-server.md`.
- Modify: `src/main/startup/serve-options.ts` (8-11, 99-107, 112-120), `src/shared/serve-option-validation.ts` (4-5, 11-19, 26-35, 38-41), `src/main/startup/main-process-serve.ts` (4, 21-34, 53-71, 75-76, 79-89), `src/cli/specs/serve.ts` (9, 12-15, 20-21, 23-24, 30-31), `src/cli/handlers/core.ts` (46-59, 102-104, 105-113 partially, 114-115, 118-121), `src/cli/runtime/launch.ts` (82-86, 95-104), `src/main/orcad/electron-serve-browser-process.ts` (2, 34-54, 104, 109-110, 112), `src/main/orcad/orcad-entry.ts` (18, 89-94, 294, 303-304, 314, 316-330, 334-335, 339-349), `src/main/orcad/orcad-command-arguments.ts` (12-19, 22-37), `src/main/orcad/orcad-launch-contract.test.ts` (13, 19-32), `src/main/startup/serve-options.test.ts`, `src/shared/serve-option-validation.test.ts`, `src/cli/index-serve-command.test.ts` (cases at 61-75, 76-95, 96-120, 137-155, 156-171, 172-187, 188-203), `src/cli/runtime/launch.test.ts` (serve flag cases), `src/cli/serve-electron-flag-parity.test.ts`, `src/main/orcad/electron-serve-browser-process.test.ts`, `package.json` (`smoke:serve-terminal`, `smoke:orcad-terminal`), `.github/workflows/pr.yml:294-305`, `tests/e2e/headless-serve-desktop-activation.spec.ts:138`, `README.md:221`.
- Tests: `pnpm test src/main/startup/serve-options.test.ts src/shared/serve-option-validation.test.ts src/cli/index-serve-command.test.ts src/cli/runtime/launch.test.ts src/cli/serve-electron-flag-parity.test.ts src/main/orcad src/main/server`, `pnpm tc`, `pnpm run check:readme-local-links`.

**Interfaces:** Consumes: U6.4 (orcad-entry push lines already gone). Produces: `ServeOptions = { json, recipeJson, projectRoot }`; `ServeOptionValidationInput = { recipeJson, projectRoot }`; `OrcadOptions = { json? }`; `ServeReadiness.boundEndpoint`/`advertisedEndpoint` are always `null` and `pairing` is always `{ available: false, reason: 'disabled_by_operator', … }`; the recipe-json publish path (`ServeReadinessPublisher.publish` mode `'recipe-json'`, `serve-readiness.ts:69-71`) now throws at runtime, which is the expected Spec B state for VM recipes. `runtimeRpc.getWebSocketEndpoint()` / `createPairingOffer()` are no longer called anywhere (deleted in U7.2).

- [ ] **Step 1: serve-options.** In `src/main/startup/serve-options.ts` delete type members lines 8-11 (`wsPort?`, `pairingAddress`, `noPairing`, `mobilePairing`), the port parse lines 99-107 (`const rawPort = …` through `}` after `wsPort = parsedPort`), and lines 112-120 (`...(wsPort !== undefined ? { wsPort } : {}),` through `mobilePairing: …`). The remaining object literal is `{ json: hasFlag(optionsArgv, ['--serve-json', '--json']), recipeJson: lastBooleanValue(optionsArgv, ['--serve-recipe-json', '--recipe-json']), projectRoot: valueAfter(…) }`. `src/shared/serve-option-validation.ts`: delete lines 4-5 (`noPairing`, `mobilePairing`), 11-19 (the three pairing checks), 27-30 and 33-34 (the pairing entries of `SERVE_SECURITY_FLAG_NAMES`, leaving `'--recipe-json'`, `'--serve-recipe-json'`), 38-41 (`'--port'`, `'--serve-port'`, `'--pairing-address'`, `'--serve-pairing-address'` in `SERVE_VALUE_FLAG_NAMES`; keep `--project-root`, `--serve-project-root`, `--pairing-code`, `--environment`).
- [ ] **Step 2: Serve readiness output.** In `src/main/startup/main-process-serve.ts` delete line 4 (`resolveAdvertisedPairingEndpoint` import), lines 21-34 (`renderTerminalPairingQr`), lines 53-71 (`const boundEndpoint = …` through `const pairingQr = …`), and replace lines 72-94 with:
  ```ts
    await state.serveReadinessPublisher.publish(
      {
        runtimeId: runtime.getRuntimeId(),
        boundEndpoint: null,
        advertisedEndpoint: null,
        // Why: the WSL reconciliation barrier fails open, so 'pending' warns a WSL PTY launch may still race a repair.
        managedWslCliReconciliation: state.managedWslCliReconciliationStatus,
        pairing: {
          available: false,
          reason: 'disabled_by_operator',
          guidance: 'This build has no network listener; connect with the orca CLI on this machine.'
        }
      },
      options.recipeJson
        ? { mode: 'recipe-json', projectRoot: options.projectRoot! }
        : { mode: options.json ? 'json' : 'human' }
    )
  ```
  `runtimeRpc` is then unused in `printServeReady`: delete `const runtimeRpc = state.runtimeRpc` and change the guard to `if (!runtime) { throw new Error('Runtime must be initialized before printing serve readiness') }`.
- [ ] **Step 3: CLI `serve` flags.** `src/cli/specs/serve.ts`: line 9 usage → `'orca serve [--project-root <path>] [--recipe-json] [--json]'`; delete lines 12-15 (`'port'`, `'pairing-address'`, `'mobile-pairing'`, `'no-pairing'`), notes lines 20-21 and 23-24 (keep only the `--recipe-json` note), examples lines 30-31. `src/cli/handlers/core.ts`: delete `getOptionalServePort` (46-59), lines 102-103 (`noPairing`, `mobilePairing` consts), the `noPairing, mobilePairing,` arguments inside `getServeOptionValidationError({…})`, lines 114-115 (`const port = …`, `const pairingAddressValue = …`), and the `port, pairingAddress: …, noPairing, mobilePairing,` properties in the `serveOrcaApp({…})` call. `src/cli/runtime/launch.ts`: delete the `port?`, `pairingAddress?`, `noPairing?`, `mobilePairing?` members (82-85) and the four `if (args.port) … if (args.mobilePairing) {…}` pushes (95-106). Delete the CLI test cases that exercised those flags: `src/cli/index-serve-command.test.ts` blocks starting at lines 61 (edit: drop `'--port','6768','--pairing-address','100.64.1.20','--no-pairing'` from the argv and the `port/pairingAddress/noPairing/mobilePairing` keys from the expectation), 76-95, 96-120 (keep only if it tests `--recipe-json` without pairing flags; otherwise delete), 137-155, 156-171, 172-187, 188-203; `src/cli/runtime/launch.test.ts`: delete every `it` that passes `port`, `pairingAddress`, `noPairing` or `mobilePairing` to `serveOrcaApp` (find with `rg -n 'pairingAddress|mobilePairing|noPairing|port:' src/cli/runtime/launch.test.ts`); `src/cli/serve-electron-flag-parity.test.ts`: run it; it compares `SERVE_COMMAND_SPECS.allowedFlags` with `normalizeServeModeArgv` — update its expected flag list to `['project-root', 'recipe-json']` if it enumerates flags. `src/main/startup/serve-options.test.ts`: delete the `it` blocks at 91 (`accepts an equals-form value that resembles a pairing flag`), 106 (`rejects recipe JSON without runtime pairing…`, replace with a check that only `--project-root` is required), 150 (`requires a port value`), and the `--port`/`--pairing-address`/`--no-pairing`/`--mobile-pairing` tokens inside the remaining cases (lines 6-90). `src/shared/serve-option-validation.test.ts`: delete the pairing cases.
- [ ] **Step 4: orcad sidecar and orcad args.** `src/main/orcad/electron-serve-browser-process.ts`: delete line 104 (`const port = await reserveLoopbackPort()`), lines 109-110 (`'--serve-port', String(port),`), line 112 (`'--serve-no-pairing',`), the `reserveLoopbackPort` function (34-54) and `createServer, type AddressInfo` from line 2 if unused elsewhere in the file. In `electron-serve-browser-process.test.ts` delete assertions on `--serve-port`/`--serve-no-pairing` (find with `rg -n 'serve-port|serve-no-pairing' src/main/orcad/electron-serve-browser-process.test.ts`). `src/main/orcad/orcad-command-arguments.ts`: delete the `--port` branch (12-19), the `--no-pairing` branch (22-23), the `--bind` branch (24-30) and the `--pairing-address` branch (31-37), leaving only `--json`. `src/main/orcad/orcad-entry.ts`: delete line 18 (`describeOrcadBindExposure, resolveOrcadBindHost` import), the `port?`, `noPairing?`, `pairingAddress?`, `bind?` members of `OrcadOptions` (lines 89-94 keep only `json?: boolean`), line 125 (`resolveAdvertisedPairingEndpoint` dynamic import), line 294 (`const bindHost = …`), lines 303-304 (`pinnedBindHost: bindHost,` and the `...(options.port !== undefined ? …)` spread — leave `enableWebSocket: true` for U7.2 to delete), line 314 (`console.error(\`[orcad] ${describeOrcadBindExposure(bindHost)}\`)`), lines 316-330 (`boundEndpoint`, `advertised`, `offer`), and replace the readiness fields `boundEndpoint, advertisedEndpoint: …, pairing: offer.available ? {…} : offer,` with:
  ```ts
      boundEndpoint: null,
      advertisedEndpoint: null,
      pairing: {
        available: false,
        reason: 'disabled_by_operator',
        guidance: 'This build has no network listener; connect with the orca CLI on this machine.'
      },
  ```
  `git rm src/main/orcad/orcad-bind-address.ts src/main/orcad/orcad-bind-address.test.ts`. `orcad-launch-contract.test.ts`: delete line 13 and the `it` blocks at 19-32 (`accepts --bind…`, `rejects --bind with no value…`), plus any case passing `--port`/`--pairing-address` (`rg -n "'--port'|pairing-address|bind" src/main/orcad/*.test.ts`). Run `pnpm test src/main/orcad` and delete any further case that asserts `readiness.boundEndpoint`, `readiness.pairing.available === true` or `pairing.url`.
- [ ] **Step 5: Smoke scripts and docs.** `git rm config/scripts/runtime-serve-terminal-smoke.mjs config/scripts/orcad-terminal-smoke-change-scope.mjs docs/reference/headless-linux-server.md` (and `config/scripts/orcad-terminal-smoke-change-scope.test.mjs` if present). `package.json`: delete the `smoke:orcad-terminal` and `smoke:serve-terminal` scripts. `.github/workflows/pr.yml`: delete the `Boot orcad and round-trip a terminal` step (lines 294-305). `tests/e2e/headless-serve-desktop-activation.spec.ts:138`: change `args: [...getOrcaElectronLaunchArgs(mainPath, false), '--serve', '--serve-no-pairing'],` to `args: [...getOrcaElectronLaunchArgs(mainPath, false), '--serve'],`. `README.md`: delete line 221 (the `orca serve` / headless guide bullet). `pnpm run check:readme-local-links` → passes.
- [ ] **Step 6: Verify.** `pnpm tc`; the test list above; `rg -n 'serve-port|serve-pairing-address|serve-no-pairing|serve-mobile-pairing|pairingAddress|noPairing|mobilePairing' src/ config/ .github --glob '!**/.cross-version-checkouts/**'` → no hits outside `src/main/runtime/` (those go in U7.2); `pnpm run check:code-quality:changed`.
- [ ] **Step 7: Commit.**
  ```
  refactor(local-only): remove the network mode from orca serve and orcad

  Drop --port/--pairing-address/--no-pairing/--mobile-pairing, the bind-address
  option, the pairing offer and QR in the readiness payload, and the smoke
  scripts that drove a serve host over a pairing code. The headless --serve
  mode and the CLI serve command stay (orcad's browser sidecar and VM recipes).

  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01PskLbdTqJNXxJ7KRnDoDoD
  ```

### Task U7.2: Delete the runtime WebSocket listener, pairing chain, E2EE, device registry, `runtime/relay/`, `runtime/push/`, and the E2E wide-bind path

**Files:**
- Delete (transport and chain): `src/main/runtime/rpc/ws-transport.ts`, `node-websocket-lifecycle.ts`, `static-web-client-handler.ts`, `mobile-socket-wiring.ts`, `e2ee-channel.ts`, `e2ee-crypto.ts` (re-export, no remaining importer), `relay-transport.ts`, `websocket-transport-limits.ts`, `unpaired-device-auth-throttle.ts`, `ws-fallback-port-store.ts`, `remote-runtime-server-heartbeat.ts`, the ten `src/main/runtime/rpc/mobile-e2ee-*.ts`, `src/main/runtime/rpc/methods/pairing.ts`, `src/main/runtime/runtime-rpc/runtime-rpc-network-exposure.ts`, `runtime-rpc-pairing.ts`, `runtime-rpc-mobile-pairing.ts`, `runtime-rpc-websocket-dispatch.ts`, `runtime-rpc-binary-routing.ts`, `runtime-rpc-mobile-method-allowlist.ts`, `src/main/runtime/device-registry.ts`, `e2ee-keypair.ts`, `host-challenge-envelope.ts`, `runtime-binary-message-router.ts`, `mobile-pairing-qr.ts`, `mobile-pairing-files.ts`, `pairing-endpoint.ts`, `pairing-network-interfaces.ts`, `windows-mobile-firewall.ts`, `windows-firewall-remote-scope.ts`, `runtime-rpc-mobile-method-allowlist-fixtures.ts`, `runtime-rpc-mobile-ws-test-harness.ts`, `paired-client-navigation-test-harness.ts`, `src/main/runtime/relay/` (56 files), `src/main/runtime/push/` (31 files).
- Delete (shared): `src/shared/mobile-push-contract.ts` (+test), `mobile-relay-status.ts`, `mobile-relay-close-codes.ts` (+test), `mobile-relay-mint-failure.ts` (+test), `mobile-relay-phone-protocol.ts` (+test), `mobile-relay-credential-contract.ts`, `mobile-pairing-connection-mode.ts` (+test), `pairing-address-auto-selection.ts` (+test), `windows-mobile-firewall.ts`, `relay-host-close-reason.ts`, `mobile-e2ee-legacy-fixtures.ts`, `runtime-pairing-reach.ts`.
- Delete (main tests): `src/main/runtime/rpc/{e2ee-channel,e2ee-channel-v2,e2ee-channel-text-backpressure,e2ee-integration,ws-transport,ws-transport-accept-order,ws-transport-static-web,ws-transport-transient-packet-loss,mobile-socket-wiring,mobile-auth-acl-critical-path,relay-transport,static-web-client-handler-stream,unpaired-device-auth-throttle,ws-fallback-port-store}.test.ts`, `src/main/runtime/rpc/methods/pairing.test.ts`, `src/main/runtime/{runtime-rpc-device-revocation,runtime-rpc-mobile-terminal-streaming,runtime-rpc-mobile-unknown-method-scope-refusal,runtime-rpc-pairing-mode-persistence,runtime-rpc-pairing-offer,runtime-rpc-websocket-bind-host,runtime-rpc-relay-pairing,runtime-rpc-required-ws-port,runtime-rpc-request-authorization,runtime-rpc-browser-host-admission,runtime-rpc-websocket-long-poll-caps,mobile-rpc-allowlist,mobile-pairing-userdata-path,mobile-pairing-qr,pairing-endpoint,windows-mobile-firewall,windows-firewall-remote-scope,runtime-binary-message-router,remote-browser-screencast-frame-admission}.test.ts`, `src/main/runtime/{multi-client-navigation-isolation,external-worktree-paired-client-discovery,browser-network-tunnel-paired-runtime,remote-agent-session-host-authority,remote-runtime-close-intent,remote-runtime-request-connection}.integration.test.ts`.
- Delete (E2E, not part of `pnpm tc`/`pnpm test` except `*.unit.test.ts`): `tests/e2e/cross-version-wire/` (22 files), `tests/e2e/helpers/{paired-electron-client,paired-client-runtime-environment,paired-client-runtime-environment.unit.test,headless-paired-runtime-host,headless-paired-runtime-serve-readiness,headless-paired-runtime-serve-readiness.unit.test,nested-runtime-same-id-pairing,nested-runtime-ssh-client-route,nested-runtime-ssh-filesystem-route,nested-runtime-ssh-relay-lifecycle,nested-runtime-ssh-state,nested-runtime-ssh-terminal-creation,nested-runtime-proxy-jump-fixture,nested-runtime-proxy-jump-fixture.unit.test,client-hosted-browser-fixture,client-hosted-browser-fixture.unit.test,client-hosted-browser-observer,client-hosted-runtime-relaunch,paired-browser-placement-fixture,paired-client-host-session,paired-client-window-reveal,paired-client-window-reveal.unit.test,paired-host-terminal,paired-html-preview-inventory,paired-quick-open-large-tree-fixture,paired-terminal-cold-activation-observation,paired-terminal-cold-activation-oracle,paired-terminal-hidden-output-oracle,paired-terminal-parking-fixture,paired-terminal-parking-oracle,paired-terminal-restart-renderer-probes,paired-terminal-title-fanout-oracle,paired-web-client-url,paired-web-filesystem-route}.ts`, and the specs: `tests/e2e/{add-project-error-toast-stacking,client-hosted-browser-tooltip-preview,desktop-published-split-orientation-legacy-leaf,headless-paired-remote-terminal-retention-memory,headless-paired-remote-terminal-stall-recovery,headless-serve-cli-terminal-retention-parity,headless-serve-focused-terminal-create,host-parked-pane-remote-viewer,landing-preflight-runtime-routing,markdown-literal-save-reopen,nested-runtime-ssh-lifecycle,nested-runtime-ssh-routing,packaged-mixed-version-browser-placement,paired-browser-create-navigation-deadline,paired-browser-creation-reconciliation-failure,paired-cli-terminal-graph-sync-tab-retention,paired-client-hosted-browser-cookie-survival,paired-client-hosted-browser-double-restart,paired-client-hosted-browser-ghost-close,paired-client-hosted-browser-host-strip,paired-client-hosted-browser-markup,paired-client-hosted-browser-quit-survival,paired-client-hosted-browser-restart-survival,paired-client-hosted-browser-title-hold,paired-client-hosted-browser,paired-cmd-j-host-qualified-tabs,paired-external-worktree-discovery,paired-preview-address-bar-convergence,paired-quick-open-large-tree,paired-remote-browser-ghost-subscriber-rejoin,paired-remote-browser-link-open-routing,paired-remote-browser-stream-reconnect,paired-remote-html-preview-local-render,paired-remote-pane-layout-retry,paired-remote-split-pane-focus,paired-remote-split-pane-host-retired-ghost,paired-remote-terminal-browser-link,paired-remote-terminal-client-restart-survival,paired-remote-terminal-host-restart-background-sync,paired-remote-terminal-lossy-initial-snapshot,paired-remote-terminal-materialization-reconnect,paired-remote-terminal-parked-reveal-interactivity,paired-remote-terminal-parked-scrollback-restart,paired-remote-terminal-parked-scrollback-survives,paired-remote-terminal-probe-gap-recovery,paired-remote-terminal-retention-memory,paired-remote-terminal-serve-restart-binding,paired-remote-terminal-stall-recovery,paired-remote-terminal-truncated-tail-first-paint,paired-skill-installation,paired-startup-exec-readiness,paired-two-client-emptied-workspace-reseed,paired-web-add-project-unavailable-host,pr11346-selected-runtime-add,remote-agent-session-focus-authority,remote-session-bulk-open-freeze-repro,runtime-file-browser-windows-drives,runtime-host-status-recovery,ssh-client-hosted-browser-drop-reconnect,staging-skill-sharing,terminal-inline-images-paired-runtime,multi-client-navigation-isolation}.spec.ts`, `tests/e2e/paired-runtime-rejected-input-remount.unit.test.ts`, `config/scripts/run-multi-client-navigation-e2e.mjs`.
- Modify: `src/main/runtime/runtime-rpc/runtime-rpc-state.ts`, `runtime-rpc-lifecycle.ts`, `runtime-rpc-shutdown.ts`, `runtime-rpc-request-admission.ts`, `runtime-rpc-pairing-types.ts`, `src/main/runtime/runtime-rpc.ts:9`, `src/main/runtime/rpc/core.ts` (5-10, 15-18, 110), `src/main/runtime/rpc/dispatcher-stream-options.ts:14`, `src/main/runtime/rpc/rpc-streaming-dispatcher.ts` (150, 198), `src/main/startup/main-process-serve.ts` (11-19), `src/main/runtime/rpc/methods/index.ts` (44, 104), `src/main/runtime/rpc/methods/notifications.ts` (5, 76-111), `src/shared/rpc-contract/notifications-params.ts` (2, 38-57), `src/main/runtime/runtime-mobile-notification-controller.ts` (3-7, 45-50, 56, 69-88), `src/main/runtime/runtime-service-command-surface.ts` (39-42, 130-133), `src/main/startup/main-process-runtime-launch.ts` (5-8, 18, 66-95), `src/main/orcad/orcad-entry.ts` (`enableWebSocket: true` line), `src/main/persistence.ts:5`, `src/main/persistence/loading-store/user-data-path.ts` (6, 70-112), `src/main/runtime/rpc/orchestration-session-caller.test.ts` (8, 162-204), `src/main/runtime/runtime-rpc-metadata-lifecycle.test.ts` (9, 156-207, every `enableWebSocket: false` line), `src/main/runtime/runtime-metadata.test.ts` (12-13, 179-180, 193-194, 203-268), `src/main/runtime/unreadable-secret-store-preservation.win32.test.ts` (105-154, 203-236), `src/main/native-chat/agent-session-wire/structured-agent-session-wire-admission.test.ts` (11, the `it` containing line 147), `src/main/runtime/rpc/methods/orchestration/worker/worker-release-mobile-report.test.ts` (112-123), `src/main/global-fetch-call-site-audit.test.ts:27-32`, `config/scripts/websocket-server-loopback-bind.test.ts:41`, `config/scripts/ci-unit-files.mjs:35`, `tests/e2e/helpers/orca-restart.ts` (69-82, 145, 178, 184, 218, 226), `.github/workflows/pr.yml` (48, 819-898, 1270, 1309-1310, 1349), `config/scripts/pr-code-change-scope.mjs` (30, 145-146, the `case 'cross-version-wire'`), `config/scripts/pr-code-change-scope.test.mjs` (26, 370-380), `package.json` (`qrcode`, `@types/qrcode`), `pnpm-lock.yaml` (via `pnpm remove`), `config/reliability-gates.jsonc`, `src/shared/rpc-contract/rpc-params-catalog.generated.ts` (regenerated).
- Tests (TDD for the surviving chain): write first, then make green: `src/main/runtime/runtime-rpc-unix-only.test.ts` (new, see step 2).

**Interfaces:** Consumes: U6.3, U6.4, U7.3 (no remaining caller of `createPairingOffer`, `getWebSocketEndpoint`, `setMobileRelayPairingProvider`, `setOnUnpairedDeviceAuthFailure`, `getDeviceRegistry`, `getE2EEKeypair`, `getMobileSocketWiring`, `getRelayRevokeOutbox`, `getPushUnregisterOutbox`, `setOnPushUnregisterQueued`, `setMobileRelayBinding`, `revokeMobileDevice`, `revokeRuntimeAccess`, `createMobilePairingOffer`, `ensureNetworkExposure` outside the deleted set; verify in step 1). Produces: `OrcaRuntimeRpcServerOptions = { runtime, userDataPath, pid?, platform?, keepaliveIntervalMs?, longPollCap?, metadataOwnershipPollMs?, methods? }`; `OrcaRuntimeRpcServer` chain is `RuntimeRpcState → RuntimeRpcRequestAdmission → RuntimeRpcLifecycle → RuntimeRpcShutdown`; the only transport is `UnixSocketTransport`; `RuntimeMetadata.transports` only ever contains `{ kind: 'unix' | 'named-pipe' }` (type in `src/shared/runtime-bootstrap.ts` unchanged); `RpcContext.pairing` removed; `notifications.registerPush/testPush/unregisterPush` RPCs removed; `pnpm test` no longer runs any `tests/e2e/cross-version-wire` file.

- [ ] **Step 1: Prove the cut is closed before deleting.** Run
  ```bash
  rg -n 'createPairingOffer|getWebSocketEndpoint|setMobileRelayPairingProvider|setOnUnpairedDeviceAuthFailure|getDeviceRegistry|getE2EEKeypair|getMobileSocketWiring|getRelayRevokeOutbox|getPushUnregisterOutbox|setOnPushUnregisterQueued|setMobileRelayBinding|revokeMobileDevice|revokeRuntimeAccess|createMobilePairingOffer|ensureNetworkExposure|enableWebSocket|pinnedBindHost|exposeNetworkByDefault|webClientRoot|wsPort' src/ --glob '!src/main/runtime/relay/**' --glob '!src/main/runtime/push/**' --glob '!src/main/runtime/runtime-rpc/**' --glob '!src/main/runtime/rpc/**' --glob '!*.test.ts' --glob '!*harness*'
  ```
  Expected hits only: `src/main/startup/main-process-runtime-launch.ts` (the `installRuntimeRpc` options) and `src/main/orcad/orcad-entry.ts` (`enableWebSocket: true`). Anything else is a missed caller: handle it in this task before step 3.
- [ ] **Step 2: Write the failing test for the surviving server (TDD).** Create `src/main/runtime/runtime-rpc-unix-only.test.ts`:
  ```ts
  import { mkdtempSync } from 'node:fs'
  import { tmpdir } from 'node:os'
  import { join } from 'node:path'
  import { afterEach, describe, expect, it } from 'vitest'
  import { OrcaRuntimeService } from './orca-runtime'
  import { OrcaRuntimeRpcServer } from './runtime-rpc'
  import { readRuntimeMetadata } from './runtime-metadata'

  describe('OrcaRuntimeRpcServer (local-only)', () => {
    const servers: OrcaRuntimeRpcServer[] = []
    afterEach(async () => {
      await Promise.all(servers.splice(0).map((server) => server.stop()))
    })

    it('publishes exactly one unix-socket or named-pipe transport and never a websocket', async () => {
      const userDataPath = mkdtempSync(join(tmpdir(), 'orca-local-only-rpc-'))
      const server = new OrcaRuntimeRpcServer({ runtime: new OrcaRuntimeService(), userDataPath })
      servers.push(server)
      await server.start()
      const metadata = readRuntimeMetadata(userDataPath)
      expect(metadata?.transports.map((transport) => transport.kind)).toEqual([
        process.platform === 'win32' ? 'named-pipe' : 'unix'
      ])
    })

    it('rejects the removed WebSocket options at the type level', () => {
      // @ts-expect-error enableWebSocket no longer exists on OrcaRuntimeRpcServerOptions
      const options = { runtime: new OrcaRuntimeService(), userDataPath: '/tmp/x', enableWebSocket: true }
      expect(options.enableWebSocket).toBe(true)
    })
  })
  ```
  Run `pnpm test src/main/runtime/runtime-rpc-unix-only.test.ts`. Expected: the second case fails typecheck under vitest (`@ts-expect-error` unused) or the suite fails on `pnpm tc` — RED. (If `new OrcaRuntimeService()` needs constructor arguments in this tree, copy the construction used by `src/main/runtime/runtime-rpc-metadata-lifecycle.test.ts:29-47`.)
- [ ] **Step 3: Delete the cluster.**
  ```bash
  git rm -r -q src/main/runtime/relay src/main/runtime/push tests/e2e/cross-version-wire
  git rm -q src/main/runtime/rpc/{ws-transport,node-websocket-lifecycle,static-web-client-handler,mobile-socket-wiring,e2ee-channel,e2ee-crypto,relay-transport,websocket-transport-limits,unpaired-device-auth-throttle,ws-fallback-port-store,remote-runtime-server-heartbeat}.ts src/main/runtime/rpc/mobile-e2ee-*.ts src/main/runtime/rpc/methods/pairing.ts src/main/runtime/rpc/methods/pairing.test.ts
  git rm -q src/main/runtime/runtime-rpc/runtime-rpc-{network-exposure,pairing,mobile-pairing,websocket-dispatch,binary-routing,mobile-method-allowlist}.ts
  git rm -q src/main/runtime/{device-registry,e2ee-keypair,host-challenge-envelope,runtime-binary-message-router,mobile-pairing-qr,mobile-pairing-files,pairing-endpoint,pairing-network-interfaces,windows-mobile-firewall,windows-firewall-remote-scope,runtime-rpc-mobile-method-allowlist-fixtures,runtime-rpc-mobile-ws-test-harness,paired-client-navigation-test-harness}.ts
  git rm -q src/shared/{mobile-push-contract,mobile-push-contract.test,mobile-relay-status,mobile-relay-close-codes,mobile-relay-close-codes.test,mobile-relay-mint-failure,mobile-relay-mint-failure.test,mobile-relay-phone-protocol,mobile-relay-phone-protocol.test,mobile-relay-credential-contract,mobile-pairing-connection-mode,mobile-pairing-connection-mode.test,pairing-address-auto-selection,pairing-address-auto-selection.test,windows-mobile-firewall,relay-host-close-reason,mobile-e2ee-legacy-fixtures,runtime-pairing-reach}.ts
  git rm -q src/main/runtime/rpc/{e2ee-channel,e2ee-channel-v2,e2ee-channel-text-backpressure,e2ee-integration,ws-transport,ws-transport-accept-order,ws-transport-static-web,ws-transport-transient-packet-loss,mobile-socket-wiring,mobile-auth-acl-critical-path,relay-transport,static-web-client-handler-stream,unpaired-device-auth-throttle,ws-fallback-port-store}.test.ts
  git rm -q src/main/runtime/{runtime-rpc-device-revocation,runtime-rpc-mobile-terminal-streaming,runtime-rpc-mobile-unknown-method-scope-refusal,runtime-rpc-pairing-mode-persistence,runtime-rpc-pairing-offer,runtime-rpc-websocket-bind-host,runtime-rpc-relay-pairing,runtime-rpc-required-ws-port,runtime-rpc-request-authorization,runtime-rpc-browser-host-admission,runtime-rpc-websocket-long-poll-caps,mobile-rpc-allowlist,mobile-pairing-userdata-path,mobile-pairing-qr,pairing-endpoint,windows-mobile-firewall,windows-firewall-remote-scope,runtime-binary-message-router,remote-browser-screencast-frame-admission}.test.ts
  git rm -q src/main/runtime/{multi-client-navigation-isolation,external-worktree-paired-client-discovery,browser-network-tunnel-paired-runtime,remote-agent-session-host-authority,remote-runtime-close-intent,remote-runtime-request-connection}.integration.test.ts
  git rm -q config/scripts/run-multi-client-navigation-e2e.mjs tests/e2e/paired-runtime-rejected-input-remount.unit.test.ts
  cd tests/e2e/helpers && git rm -q paired-*.ts headless-paired-*.ts nested-runtime-*.ts client-hosted-*.ts && cd -
  cd tests/e2e && git rm -q paired-*.spec.ts headless-paired-*.spec.ts headless-serve-cli-terminal-retention-parity.spec.ts headless-serve-focused-terminal-create.spec.ts nested-runtime-ssh-*.spec.ts add-project-error-toast-stacking.spec.ts client-hosted-browser-tooltip-preview.spec.ts desktop-published-split-orientation-legacy-leaf.spec.ts host-parked-pane-remote-viewer.spec.ts landing-preflight-runtime-routing.spec.ts markdown-literal-save-reopen.spec.ts packaged-mixed-version-browser-placement.spec.ts pr11346-selected-runtime-add.spec.ts remote-agent-session-focus-authority.spec.ts remote-session-bulk-open-freeze-repro.spec.ts runtime-file-browser-windows-drives.spec.ts runtime-host-status-recovery.spec.ts ssh-client-hosted-browser-drop-reconnect.spec.ts staging-skill-sharing.spec.ts terminal-inline-images-paired-runtime.spec.ts multi-client-navigation-isolation.spec.ts && cd -
  ```
  Then `rg -l "helpers/(paired-|headless-paired|nested-runtime|client-hosted)" tests/e2e` → no hits (delete any spec it still names). Keep `tests/e2e/helpers/docker-ssh-relay-*.ts`, `relay-execution-process.ts`, `local-https-test-server.ts` (SSH / local fixtures) and `tests/e2e/headless-serve-desktop-activation.spec.ts` (serve→desktop promotion is a kept local feature; it imports only generic helpers).
- [ ] **Step 4: Collapse `runtime-rpc-state.ts`.** Delete imports lines 7-14 (`WebSocket` type, `DeviceRegistry`, `E2EEKeypair`, `UnpairedDeviceAuthThrottle`, `MobileSocketWiring`, `RelayRevokeOutbox`, `PushUnregisterOutbox`, `RuntimeBinaryMessageRouter`), change lines 24-30 to `import type { OrcaRuntimeRpcServerOptions } from './runtime-rpc-pairing-types'`, delete fields lines 38-51 (`enableWebSocket` … `stopping = false`), 60-65 (`relayRevokeOutbox`, `pushUnregisterOutbox`, `deviceRegistry`, `e2eeKeypair`, `pairingInitializationFailure`, `tlsFingerprint`), 69-88 (`mobileSocketWiring` … `wsDispatchAbortStates`), constructor parameters lines 101-108 (`enableWebSocket = false` … `webClientRoot,`) and assignments 118-125 (`this.enableWebSocket = …` … `this.webClientRoot = …`), and lines 136-137 (`this.relayRevokeOutbox = …`, `this.pushUnregisterOutbox = …`). Keep `browserHostLongPollCapPerDevice` / `activeBrowserHostLongPollsByDevice` (used by `admitLongPoll`).
- [ ] **Step 5: Collapse `runtime-rpc-pairing-types.ts`.** Delete imports lines 3-15 (keep lines 1-2), delete `DEFAULT_WS_PORT`, `WS_BIND_HOST_LOOPBACK`, `WS_BIND_HOST_ALL_INTERFACES`, `formatWsEndpoint` (17-28), the option members `enableWebSocket?` … `webClientRoot?` (35-54), everything from `export type MobilePairingOfferAvailable` (80) through `webClientPathForEndpoint` (147) except keep `PairingOfferUnavailableReason` (64-70) and `PairingOfferUnavailable` (72-78) minus its lines 76-77 (`/** Present when an Anywhere mint… */` and `relayFailure?: MobileRelayMintFailure`, whose type is deleted in this task); `src/main/server/serve-readiness.ts:1,4` still imports both kept types through `runtime-rpc.ts`. Expected file: two imports, `OrcaRuntimeRpcServerOptions` with `runtime, userDataPath, pid?, platform?, keepaliveIntervalMs?, longPollCap?, metadataOwnershipPollMs?, methods?`, and the two pairing-unavailable types.
- [ ] **Step 6: Collapse `runtime-rpc-lifecycle.ts`.** Change line 22 to `export class RuntimeRpcLifecycle extends RuntimeRpcRequestAdmission {` and replace imports 5-16 with `import { RuntimeRpcRequestAdmission } from './runtime-rpc-request-admission'` (keep lines 1-4 and 17-20). Delete lines 73-112 (the `if (this.enableWebSocket) { … }` block including its comment) and lines 148-268 (`resolveInitialWebSocketBindHost`, `startWebSocketTransport`, `ensureMobileSocketWiring`), leaving `start()` ending after the `metadataOwnershipWatch` assignment.
- [ ] **Step 7: Collapse `runtime-rpc-shutdown.ts` and `runtime-rpc-request-admission.ts`, `runtime-rpc.ts`.** `runtime-rpc-shutdown.ts`: line 1 → `import { RuntimeRpcLifecycle } from './runtime-rpc-lifecycle'`, line 3 → `export class RuntimeRpcShutdown extends RuntimeRpcLifecycle {`, delete lines 10-19 (`stopping`/`pendingExposure` block), 25-26 (`this.mobileSocketWiring = null`, `this.detachWebSocketWiring = null`), 30-31 (the `flushPendingLastSeen` comment + call). `runtime-rpc-request-admission.ts`: line 6 → `import { RuntimeRpcState } from './runtime-rpc-state'`, line 9 → `export class RuntimeRpcRequestAdmission extends RuntimeRpcState {`. `runtime-rpc.ts`: delete line 9 (`export type { MobilePairingConnectionContext } …`).
- [ ] **Step 8: RPC core, registry, notifications.** `src/main/runtime/rpc/core.ts`: delete lines 5-10 (the `mobile-relay-credential-contract` import), 15-18 (`PairingRpcContext`), 110 (`pairing?: PairingRpcContext`). `src/main/runtime/rpc/dispatcher-stream-options.ts`: delete line 14 (`pairing?: PairingRpcContext`) and `PairingRpcContext` from its `../core` import. `src/main/runtime/rpc/rpc-streaming-dispatcher.ts`: delete lines 150 and 198 (`pairing: options?.pairing,`). `rpc/methods/index.ts`: delete line 44 (`PAIRING_METHODS` import) and line 104 (`...PAIRING_METHODS,`). `rpc/methods/notifications.ts`: delete line 5 (`NotificationRegisterPushParams,`) and the three `defineMethod({ name: 'notifications.registerPush' … })`, `'notifications.testPush'`, `'notifications.unregisterPush'` entries (lines 76-111, keeping the closing `]`). `src/shared/rpc-contract/notifications-params.ts`: delete line 2 and lines 38-57 (`NotificationPushFilterParams`, `NotificationRegisterPushParams`). `runtime-mobile-notification-controller.ts`: delete lines 3-7 (`mobile-push-contract` import), 45-50 (`MobilePushRegistrar` type + comment), 56 (`private pushRegistrar`), 69-88 (`setPushRegistrar`, `registerPushDevice`, `testPushDevice`, `unregisterPushDevice`). `runtime-service-command-surface.ts`: delete lines 39-42 and 130-133 (the four `*MobilePush*` bindings). `pnpm run generate:rpc-params-catalog`.
- [ ] **Step 9: Startup and orcad.** `main-process-runtime-launch.ts`: delete `migrateMobilePairingDataToCanonicalUserDataPath` from the `../persistence` import (lines 5-8 become `import { getCanonicalUserDataPath } from '../persistence'`) and replace the body of `installRuntimeRpc` from the migration comment through the `webClientRoot` line (original lines 66-95) with:
  ```ts
    const runtimeRpc = new OrcaRuntimeRpcServer({
      runtime,
      // Why: the CLI reads the unix socket path from the stable pre-setName() userData path.
      userDataPath: getCanonicalUserDataPath()
    })
  ```
  then delete the now-unused `serveOptions` parameter of `installRuntimeRpc` (and the `serveOptions` argument at its call site), change line 18 to `import { getServeOptions, printServeReady } from './main-process-serve'`, and delete the `import { is } from '@electron-toolkit/utils'` line if `rg -c '\bis\.' main-process-runtime-launch.ts` prints 0. `main-process-serve.ts`: delete `getBundledWebClientRoot` (lines 11-19 of the pristine file) and the `existsSync`, `join`, `app` imports it alone used (`pnpm run check:code-quality:changed` confirms). `orcad-entry.ts`: delete the `enableWebSocket: true,` line and the `// Why pinned…` comment that preceded `pinnedBindHost` if U7.3 left it. `src/main/persistence.ts`: delete line 5 (`migrateMobilePairingDataToCanonicalUserDataPath`). `src/main/persistence/loading-store/user-data-path.ts`: delete line 6 and the JSDoc + function `migrateMobilePairingDataToCanonicalUserDataPath` (lines 70-112); drop `copyFileSync`, `rmSync`, `hardenExistingSecureFile` from the imports if now unused (`pnpm run check:code-quality:changed` reports them).
- [ ] **Step 10: Surviving tests.** `orchestration-session-caller.test.ts`: delete line 8 and the `it(...)` at 162-204. `runtime-rpc-metadata-lifecycle.test.ts`: delete line 9, the `it('flushes a lastSeen refresh…')` at 156-207, and every `enableWebSocket: false` option line (`rg -n 'enableWebSocket' src/main/runtime/*.test.ts src/main/runtime/rpc/**/*.test.ts` must print nothing afterwards; apply the same deletion in any other kept test it lists). `runtime-metadata.test.ts`: delete imports 12-13, lines 179-180 (`new DeviceRegistry(…).addDevice('phone')`, `loadOrCreateE2EEKeypair(userDataPath)`), the two `join(userDataPath, 'orca-devices.json')` / `'orca-e2ee-keypair.json'` entries (193-194), and the two `it` blocks at 203-257 and 258-268. `unreadable-secret-store-preservation.win32.test.ts`: delete the `it` blocks at 105-154 (two) and 203-236. `structured-agent-session-wire-admission.test.ts`: delete line 11 and the `it` block containing line 147. `worker-release-mobile-report.test.ts`: delete the `it('the report is reachable from a mobile-scoped device token')` block (112-123). `src/main/global-fetch-call-site-audit.test.ts`: delete lines 27-32 (`push-gateway-client`, `relay-http-client`, `relay-region-catalog-fetch`, the comment, `relay-region-preference`, `relay-region-probe`). `config/scripts/websocket-server-loopback-bind.test.ts:41`: run the test; it prints the recognized count (now ≤ 15); set `RECOGNIZED_CONSTRUCTION_FLOOR` to that printed count (lowering the floor is the only allowed direction). `config/scripts/ci-unit-files.mjs`: delete line 35 (`'tests/e2e/cross-version-wire/**'`). `tests/e2e/helpers/orca-restart.ts`: delete `reserveRestartRuntimeWsPort` (69-82), line 145, lines 178 and 218 (`runtimeWsPort ??= …`), lines 184 and 226 (`ORCA_E2E_RUNTIME_WS_PORT: String(runtimeWsPort)`), and `createServer` from its `node:net` import if unused.
- [ ] **Step 11: CI and scope script.** `.github/workflows/pr.yml`: delete line 48 (`cross-version-wire:` output), the `cross-version-wire:` job (819-898), line 1270 (`- cross-version-wire`), lines 1309-1310 (`CROSS_VERSION_WIRE*` env), line 1349 (`check_job cross-version-wire …`). `config/scripts/pr-code-change-scope.mjs`: delete line 30 (`'cross-version-wire',`), the `tests/e2e/cross-version-wire/` entry of `CROSS_VERSION_WIRE_PREFIXES` and the `case 'cross-version-wire':` branch of `jobDetector` (keep the constant and its daemon-protocol/runtime-launcher prefixes). `pr-code-change-scope.test.mjs`: delete line 26 and the expectations at 370-380. Run `pnpm test config/scripts/pr-code-change-scope.test.mjs config/scripts/pr-workflow-parallelism.test.mjs`.
- [ ] **Step 12: Dependencies.** `pnpm remove qrcode @types/qrcode` (last importers were `mobile-pairing-qr.ts` and `main-process-serve.ts`, both gone). Expected: `rg -n 'qrcode' package.json src/` → no hits; `ws` and `tweetnacl` stay (`rg -l "from 'ws'" src/main/browser/cdp-ws-proxy.ts src/main/emulator/emulator-gesture-sender.ts` still hit).
- [ ] **Step 13: Reliability gates.** Run `pnpm run check:reliability-gates`. Delete the gates whose every `testFiles` entry is gone (`mobile-push.headless-startup-and-policy`, `desktop-relay.assignment-backpressure`, `runtime.websocket-heartbeat-cadence` loses 3 of 4 — keep only if its remaining file is a kept test, else delete, `remote-wire.cross-version-terminal-journey`); for partial hits (`runtime.connection-owned-host-status`, `cmd-j-tabs.host-qualified-candidate-ownership`, `terminal-session.shell-ready-exec-prompt-fallback`, `git-worktree.refresh-event-semantics`, `runtime.headless-desktop-promotion-continuity`, `runtime.renderer-graph-reload-termination`, `runtime.streaming-subscription-close-delivery`, `browser-session.remote-terminal-link-ownership`, `browser-session.remote-html-preview-ownership`, `browser-client-host.activated-placement`, `browser-stream.bounded-reconnect`, `terminal-session.shell-owned-mode-recovery`, `terminal-session.explicit-close-retirement`, `terminal-session.daemon-generation-reconnect-safety`, `runtime-routing.active-server-preference`, `terminal-performance.remote-hidden-retention-budget`, `terminal-provider.ssh-remote-reattach-contract`, `terminal-input.remote-write-rejection-recovery`, `terminal-input.ime-and-synthetic-forwarding`, `runtime-files.watcher-process-isolation`, `quick-open.paired-host-path-search`, `terminal-session.host-cold-park-stream-continuity`, `terminal-session.remote-pane-layout-retry`, `agent-session.remote-host-authority`) remove each missing path from `testFiles`, from the `commands` string that lists it, and any `assertions`/`evidence` object keyed by that `file`. Repeat until the checker exits 0.
- [ ] **Step 14: Verify.** `pnpm test src/main/runtime/runtime-rpc-unix-only.test.ts` → GREEN; `pnpm tc`; `pnpm test src/main/runtime src/main/startup src/main/orcad src/main/persistence src/shared config/scripts/websocket-server-loopback-bind.test.ts src/main/global-fetch-call-site-audit.test.ts`; `pnpm run verify:rpc-params-catalog`; `pnpm run check:code-quality:changed`; `npx tsx -e "import('./config/scripts/websocket-server-bind-scan.ts').then(m => console.log(m.formatSites(m.scanWebSocketServerBinds(process.cwd()).wildcardBound)))"` → prints nothing; `rg -n "new WebSocketServer\(" src/ --glob '!*.test.ts' --glob '!*fixture*'` → only `src/main/browser/cdp-ws-proxy.ts` (loopback, `host: '127.0.0.1'`); `rg -n 'ORCA_E2E_RUNTIME_WS_PORT|exposeNetworkByDefault|0\.0\.0\.0' src/ tests/e2e --glob '!**/.cross-version-checkouts/**'` → no hits in `src/`.
- [ ] **Step 15: Commit.**
  ```
  refactor(local-only): remove the runtime WebSocket listener and pairing

  Delete ws-transport, the static web-client handler, mobile socket wiring,
  E2EE channel/keypair, the device registry, the pairing/network-exposure
  chain, runtime/relay and runtime/push, the push notification RPCs, the E2E
  wide-bind path, and every test and e2e spec that drove a paired client.
  The unix socket / named pipe transport for the orca CLI is the only
  runtime transport left.

  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01PskLbdTqJNXxJ7KRnDoDoD
  ```
---

## Planner group: U1-U2-U4-U9

# Plan: U1, U2, U4, U9 (local-only Spec A)

Conventions used in every task below:
- `DEL` = delete whole file (Tier 1). `LINES` = delete only the listed lines in a shared file (Tier 2); never reflow surrounding code.
- Line numbers are anchors taken from the pre-unit tree (`local-only/spec-a` at `2a31641ee3`). Before deleting, confirm the quoted content is on that line; when a file is edited by more than one task (`electron.vite.config.ts`, `register-core-handlers.ts`, `rate-limits-bridge.ts`, `api-types.ts`, `preload/index.ts`), delete bottom-up within the file so earlier anchors stay valid.
- Execution order inside this plan: U1.1 → U1.2 → U1.3 → U2.1 → U2.2 → U4.1 → U4.2 → U9.3 → U9.1 → U9.2 → U9.4 (U9.3 must precede U9.1: it removes the last main-side caller of `rateLimits.consumeCodexRateLimitResetCredit`).
- Locale catalogs: `src/renderer/src/i18n/locales/{en,es,fr,ja,ko,zh}.json`. A key removed from `en.json` must be removed from every locale (`extraInLocale` fails `verify:localization-catalog`), and orphaned `en.json` keys become *required* in `en-runtime-required.json` (a key with no literal call site is "required"), so every task that deletes renderer strings runs the catalog-prune snippet below and then `pnpm run sync:localization-runtime-catalog`.
- Reworded copy always gets a NEW key (`auto.<path-with-dots>.<sha1(filePath:text).slice(0,10)>`; compute with `node -e "console.log(require('crypto').createHash('sha1').update(process.argv[1]).digest('hex').slice(0,10))" 'src/renderer/src/components/X.tsx:New text'`), then `pnpm run sync:localization-catalog` adds it to `en.json`. Never keep an old key with a new fallback (the catalog value wins at runtime).
- Catalog prune snippet (run from repo root; `PATHS` are dotted subtree keys):

```bash
node -e '
const fs = require("fs");
const paths = process.argv.slice(1);
for (const locale of ["en","es","fr","ja","ko","zh"]) {
  const file = `src/renderer/src/i18n/locales/${locale}.json`;
  const catalog = JSON.parse(fs.readFileSync(file, "utf8"));
  for (const path of paths) {
    const parts = path.split("."); let cursor = catalog;
    for (const part of parts.slice(0, -1)) { cursor = cursor?.[part]; if (!cursor) break; }
    if (cursor) delete cursor[parts.at(-1)];
  }
  fs.writeFileSync(file, JSON.stringify(catalog, null, 2) + "\n");
}' PATHS...
```
- Every task ends with: `pnpm tc && pnpm test <listed tests> && pnpm run check:code-quality:changed && pnpm run verify:localization-catalogs && pnpm run verify:localization-extraction && pnpm run verify:localization-coverage` then the commit. Commit trailer (verbatim, both lines):

```
Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01PskLbdTqJNXxJ7KRnDoDoD
```

---

## Unit U1 — Telemetry transport becomes the local JSONL sink

### Task U1.1: Replace the PostHog transport in `client.ts` with `local-file-sink` (TDD)
**Files:**
- Modify: `src/main/telemetry/client-test-harness.ts` (rewrite), `src/main/telemetry/client.test.ts` (rewrite assertions), `src/main/telemetry/client-lifecycle.test.ts` (rewrite), `src/main/telemetry/client.ts` (rewrite), `src/main/observability/architecture.test.ts:70-79` (carve-out), `src/shared/telemetry-event-classification.ts:132`, `src/main/usage/agent-token-usage-reporter.test.ts:6,86-88`, `src/main/startup/main-process-observers.ts:58`, `src/main/telemetry/validator.test.ts:6`, `src/main/daemon/daemon-lifecycle-event.test.ts:56,60`, `src/main/daemon/daemon-folder-access-mismatch.test.ts:426`, `src/main/daemon/daemon-adoption-telemetry-event.test.ts:131,297`, `src/main/observability/index.ts:225`, `src/main/observability/bundle.ts:32`, `src/main/observability/bundle.test.ts:238,259`
- Test: `src/main/telemetry/client.test.ts`, `src/main/telemetry/client-lifecycle.test.ts`, `src/main/observability/architecture.test.ts`, `src/main/usage/agent-token-usage-reporter.test.ts`, `src/main/ipc/telemetry.test.ts`, `src/shared/telemetry-common-props.test.ts`

**Interfaces:**
- Consumes: `createLocalFileSink`/`LocalFileSink` from `src/main/observability/local-file-sink.ts`; `getAppEnvironment`/`hasAppEnvironment` from `src/shared/app-environment`.
- Produces (unchanged public API, every importer keeps compiling): `initTelemetry(store)`, `track(name, props): boolean`, `isTelemetryEnabled()`, `setOptIn(via, optedIn)`, `persistBannerAcknowledgeWithoutEmitting()`, `trackAppOpenedOnce()`, `shutdownTelemetry()`; test hooks `_setSinkForTests(sink | null)` (replaces `_setPostHogClientForTests` + `_enableTransportForTests`), `_setCommonPropsForTests`, `_setStoreForTests`, `_setShuttingDownForTests`, `_resetFirstAppOpenedFiredForTests`. New: `getTelemetryFilePath(): string` (`<userData>/logs/telemetry.ndjson`). Record shape on disk: `{ type: 'telemetry-event', event, distinct_id, timestamp, properties: { ...CommonProps, ...validatedProps } }`.

- [ ] **Step 1: Add the `'local'` channel so a non-CI build has a legal `orca_channel`.** Edit `src/shared/telemetry-event-classification.ts:132` from `orca_channel: z.enum(['stable', 'rc'])` to `orca_channel: z.enum(['stable', 'rc', 'local'])`. Run `pnpm test src/shared/telemetry-common-props.test.ts` — passes (it uses `'stable'`; no test asserts rejection of other channels — verified with `rg -n "orca_channel" src --glob '**/*.test.ts'`).
- [ ] **Step 2: Rewrite the harness around a mock sink (RED).** Replace `src/main/telemetry/client-test-harness.ts` lines 1-30 and 42-75 and 141-158 so the harness is:

```ts
import { vi } from 'vitest'
import type { CommonProps } from '../../shared/telemetry-events'
import type { GlobalSettings } from '../../shared/global-settings-types'
import type { LocalFileSink } from '../observability/local-file-sink'
import type { Store } from '../persistence'
import { resetBurstCapsForSession } from './burst-cap'
import {
  _resetFirstAppOpenedFiredForTests,
  _setCommonPropsForTests,
  _setShuttingDownForTests,
  _setSinkForTests,
  _setStoreForTests
} from './client'

export type MockSink = {
  filePath: string
  push: ReturnType<typeof vi.fn>
  flush: ReturnType<typeof vi.fn>
  close: ReturnType<typeof vi.fn>
}

export type TelemetryClientTestState = {
  mock: MockSink
  store: Store
  settings: GlobalSettings
  envStash: Record<string, string | undefined>
}

export function makeMockSink(): MockSink {
  return { filePath: '/tmp/telemetry.ndjson', push: vi.fn(), flush: vi.fn(), close: vi.fn() }
}
```
(keep `BASE_COMMON`, `makeFakeSettings`, `makeFakeStore`, the consent-env stash helpers unchanged) and in `setupTelemetryClientTest` replace `const mock = makeMockPostHog()` / `_setPostHogClientForTests(mock as unknown as PostHog)` / `_enableTransportForTests(true)` with `const mock = makeMockSink()` / `_setSinkForTests(mock as unknown as LocalFileSink)`; in `cleanupTelemetryClientTest` replace `_enableTransportForTests(false)` + `_setPostHogClientForTests(null)` with `_setSinkForTests(null)`. Change `BASE_COMMON.orca_channel` to `'local'`.
- [ ] **Step 3: Rewrite `client.test.ts` assertions against `mock.push` (RED).** Every `mock.capture` becomes `mock.push`; the first test becomes:

```ts
  it('writes a validated event record with merged common + event props to the local sink', () => {
    track('app_opened', {})
    expect(mock.push).toHaveBeenCalledTimes(1)
    const record = mock.push.mock.calls[0]![0] as {
      type: string; event: string; distinct_id: string; timestamp: string; properties: Record<string, unknown>
    }
    expect(record.type).toBe('telemetry-event')
    expect(record.event).toBe('app_opened')
    expect(record.distinct_id).toBe(BASE_COMMON.install_id)
    expect(typeof record.timestamp).toBe('string')
    for (const key of Object.keys(BASE_COMMON) as (keyof CommonProps)[]) {
      expect(record.properties[key]).toBe(BASE_COMMON[key])
    }
    expect(record.properties.$process_person_profile).toBeUndefined()
  })
```
The drift test's allowed set drops `'$process_person_profile'` and reads `record.properties`. Keep the shutdown-gate, burst-before-consent, 30/min, 1000/session, invalid-drop and `trackAppOpenedOnce` tests (swap `capture`→`push`, `.event` → `.event` on the record). Add one new test: `it('does not write when no sink is installed', () => { _setSinkForTests(null); track('app_opened', {}); expect(mock.push).not.toHaveBeenCalled() })`. Update the header comment: "against a mock local sink".
- [ ] **Step 4: Rewrite `client-lifecycle.test.ts` (RED).** `setOptIn()` block: delete the opt-out-ordering test (lines 34-54) and the `optIn`-ordering test (56-65); replace with `it('writes telemetry_opted_out to the sink when turning off', async () => { await setOptIn('settings', false); expect(mock.push.mock.calls.map(c => (c[0] as {event:string}).event)).toEqual(['telemetry_opted_out']); expect(state.settings.telemetry?.optedIn).toBe(false) })` and `it('writes telemetry_opted_in without app_opened for settings opt-in', async () => { state.settings.telemetry!.optedIn = false; await setOptIn('settings', true); expect(mock.push.mock.calls.map(c => (c[0] as {event:string}).event)).toEqual(['telemetry_opted_in']) })`. Rewrite 'drops telemetry_opted_in silently in non-official builds' as 'persists opt-in but writes nothing when no sink is installed' using `_setSinkForTests(null)` and asserting `state.settings.telemetry?.optedIn === true` and `mock.push` not called. The pending-banner test asserts order `['app_opened', 'telemetry_opted_in']` from `mock.push`. `persistBannerAcknowledgeWithoutEmitting()` test asserts `['app_opened']` and `optedIn === true`. Delete the `shouldOptOutSdkAtInit()` describe (lines 127-144). `shutdownTelemetry()` describe: `it('sets the shutdown gate and flushes + closes the sink', async () => { const mock = makeMockSink(); _setSinkForTests(mock as unknown as LocalFileSink); await shutdownTelemetry(); expect(mock.flush).toHaveBeenCalledTimes(1); expect(mock.close).toHaveBeenCalledTimes(1); expect(mock.push).not.toHaveBeenCalled() })` plus the no-sink no-op test. Imports: drop `posthog-node`, `_enableTransportForTests`, `_setPostHogClientForTests`, `shouldOptOutSdkAtInit`; add `_setSinkForTests`, `makeMockSink`, `type LocalFileSink`.
- [ ] **Step 5: Run RED.** `pnpm test src/main/telemetry/client.test.ts src/main/telemetry/client-lifecycle.test.ts` — expected: both files fail to compile/run (`_setSinkForTests` does not exist).
- [ ] **Step 6: Rewrite `src/main/telemetry/client.ts` (GREEN).** Replace the whole file with:

```ts
// Main-process telemetry transport: one local NDJSON sink, one `track()` entry that every
// event (main + IPC) funnels through. The ordering inside `track()` — shutdown gate, burst cap,
// consent, validator, write — MUST be preserved: burst cap runs before consent so a compromised
// opted-out renderer can't force a settings read per event. Nothing here opens a socket: the sink
// appends to `<userData>/logs/telemetry.ndjson` (rotated by local-file-sink) and no code reads it back.

import { randomUUID } from 'node:crypto'
import { arch as osArch, platform as osPlatform, release as osRelease } from 'node:os'
import { join } from 'node:path'
import { getAppEnvironment, hasAppEnvironment } from '../../shared/app-environment'
import type { CommonProps, EventName, EventProps, OptInVia } from '../../shared/telemetry-events'
import { createLocalFileSink, type LocalFileSink } from '../observability/local-file-sink'
import type { Store } from '../persistence'
import { consumeBurstToken, resetBurstCapsForSession } from './burst-cap'
import { getCohortAtEmit } from './cohort-classifier'
import { resolveConsent } from './consent'
import { commonPropsSchema, validate } from './validator'

export const TELEMETRY_FILE_NAME = 'telemetry.ndjson'
export const TELEMETRY_RECORD_TYPE = 'telemetry-event'

// Module-level singletons — one Store / process / telemetry session.
let sink: LocalFileSink | null = null
let sessionId: string | null = null
let commonProps: CommonProps | null = null
let shuttingDown = false
let storeRef: Store | null = null

// First-launch `app_opened` gate: no events are written until the banner resolves; keep mark+emit atomic.
let appOpenedTrackedThisSession = false

export function getTelemetryFilePath(): string {
  return join(getAppEnvironment().getPath('userData'), 'logs', TELEMETRY_FILE_NAME)
}

function buildCommonProps(installId: string, sid: string): CommonProps {
  // Don't truncate here; the validator's `.max(64)` is authoritative, so an over-long string drops rather than being silently masked.
  return {
    app_version: getAppEnvironment().getVersion(),
    platform: osPlatform(),
    arch: osArch(),
    os_release: osRelease(),
    install_id: installId,
    session_id: sid,
    orca_channel: 'local'
  }
}

export function initTelemetry(store: Store): void {
  // Set unconditionally so `setOptIn` can persist opt-out to disk even when the sink never opens.
  storeRef = store
  resetBurstCapsForSession()
  shuttingDown = false
  // Reset per session: the "no app_opened until banner resolution" invariant is per-launch, not per-install.
  appOpenedTrackedThisSession = false

  // Why: vitest and plain-node entries have no AppEnvironment; there is no userData dir to write under.
  if (!hasAppEnvironment()) {
    return
  }
  const settings = store.getSettings()
  const installId = settings.telemetry?.installId
  if (!installId) {
    // Migration guarantees installId; if missing, don't write with an absent distinct_id.
    console.warn('[telemetry] installId missing after migration; skipping sink init')
    return
  }

  sessionId = randomUUID()
  commonProps = buildCommonProps(installId, sessionId)

  // Fail-closed: a bad `install_id` (e.g. empty from a migration bug) would collapse all events into one distinct_id.
  const parsedCommon = commonPropsSchema.safeParse(commonProps)
  if (!parsedCommon.success) {
    console.warn('[telemetry] common props failed schema validation; skipping sink init')
    commonProps = null
    return
  }

  try {
    sink = createLocalFileSink({ filePath: getTelemetryFilePath() })
  } catch (err) {
    // Telemetry must never block startup; a read-only userData just means no local record.
    console.warn('[telemetry] could not open local telemetry sink (ignored):', err)
    sink = null
  }
}

/** Lets producers avoid preparing usage payloads when nothing would be written. */
export function isTelemetryEnabled(): boolean {
  return (
    !shuttingDown &&
    sink !== null &&
    commonProps !== null &&
    storeRef !== null &&
    resolveConsent(storeRef.getSettings()).effective === 'enabled'
  )
}

function writeRecord(client: LocalFileSink, common: CommonProps, name: EventName, props: object): void {
  client.push({
    type: TELEMETRY_RECORD_TYPE,
    event: name,
    distinct_id: common.install_id,
    timestamp: new Date().toISOString(),
    properties: { ...common, ...props }
  })
}

export function track<N extends EventName>(name: N, props: EventProps<N>): boolean {
  // (1) Shutdown gate: late IPC arrivals must not enqueue against a closing sink.
  if (shuttingDown) {
    return false
  }
  if (!sink || !commonProps || !storeRef) {
    return false
  }
  // (2) Burst cap before consent: the O(1) cap drops floods before the costly settings read, so a compromised opted-out renderer can't burn CPU.
  if (!consumeBurstToken(name)) {
    return false
  }
  // (3) Consent resolve — reads live settings every call so it can't drift from persisted state / env-var precedence.
  const consent = resolveConsent(storeRef.getSettings())
  if (consent.effective !== 'enabled') {
    return false
  }
  // (4) Validator — single enforcement point for schema, enum, key set, and length caps.
  const result = validate(name, props)
  if (!result.ok) {
    return false
  }
  // (5) Write.
  writeRecord(sink, commonProps, name, result.props)
  return true
}

export async function setOptIn(via: OptInVia, optedIn: boolean): Promise<void> {
  if (!storeRef) {
    return
  }
  const settings = storeRef.getSettings()
  const telemetryBeforeUpdate = settings.telemetry
  const wasPendingBanner =
    telemetryBeforeUpdate?.existedBeforeTelemetryRelease === true &&
    telemetryBeforeUpdate.optedIn === null
  // Deep-merge (persistence.ts:552) so flipping `optedIn` won't clobber `installId` / `existedBeforeTelemetryRelease`.
  storeRef.updateSettings({
    telemetry: {
      ...(settings.telemetry ?? { installId: '', existedBeforeTelemetryRelease: true }),
      optedIn
    }
  })

  if (optedIn) {
    if (wasPendingBanner) {
      trackAppOpenedOnce()
    }
    track('telemetry_opted_in', { via })
    return
  }
  // Record the opt-out itself against the new preference (track() would drop it under `user_opt_out`).
  if (!sink || shuttingDown || !commonProps || !consumeBurstToken('telemetry_opted_out')) {
    return
  }
  const validated = validate('telemetry_opted_out', { via })
  if (validated.ok) {
    writeRecord(sink, commonProps, 'telemetry_opted_out', validated.props)
  }
}

// Banner ✕: silent persisted opt-in. Separate from `setOptIn` because that always emits a
// `telemetry_opted_in/out` event; here `app_opened` fires but no opt-in event does.
export async function persistBannerAcknowledgeWithoutEmitting(): Promise<void> {
  if (!storeRef) {
    return
  }
  const settings = storeRef.getSettings()
  storeRef.updateSettings({
    telemetry: {
      ...(settings.telemetry ?? { installId: '', existedBeforeTelemetryRelease: true }),
      optedIn: true
    }
  })
  // Why: banner resolution is the first eligible moment for app_opened.
  trackAppOpenedOnce()
}

export function trackAppOpenedOnce(): void {
  if (appOpenedTrackedThisSession) {
    return
  }
  appOpenedTrackedThisSession = true
  // Why: `nth_repo_added: 0` marks the session-zero / pre-repo cohort. See docs/onboarding-funnel-cohort-addendum.md.
  track('app_opened', { ...getCohortAtEmit() })
}

export async function shutdownTelemetry(): Promise<void> {
  // Set the gate before flush so late IPC-arrived tracks drop instead of enqueuing mid-flush.
  shuttingDown = true
  const instance = sink
  if (!instance) {
    return
  }
  try {
    instance.flush()
    instance.close()
  } catch (err) {
    // Telemetry must never crash the app on quit. Swallow.
    console.warn('[telemetry] shutdown error (ignored):', err)
  } finally {
    sink = null
  }
}

// Test-only introspection: `_`-prefixed helpers inject a fake sink and observe writes; not a runtime API.

export function _setSinkForTests(client: LocalFileSink | null): void {
  sink = client
}

export function _setCommonPropsForTests(props: CommonProps | null): void {
  commonProps = props
}

export function _setStoreForTests(store: Store | null): void {
  storeRef = store
}

export function _setShuttingDownForTests(value: boolean): void {
  shuttingDown = value
}

export function _resetFirstAppOpenedFiredForTests(): void {
  appOpenedTrackedThisSession = false
}
```
- [ ] **Step 7: Carve the sink out of the lane-isolation test.** In `src/main/observability/architecture.test.ts` replace lines 74-77 with:

```ts
    const violations = files.flatMap((f) => {
      // Why: `local-file-sink` is a pure NDJSON writer that carries no consent state; it is the
      // one observability module the telemetry lane may share (local-only fork, Spec A U1).
      const bad = findOffendingImports(f, 'observability').filter(
        (spec) => !spec.endsWith('observability/local-file-sink')
      )
      return bad.map((spec) => `${relative(REPO_ROOT, f)}: imports '${spec}'`)
    })
```
- [ ] **Step 8: Fix the one external user of the removed test hook.** `src/main/usage/agent-token-usage-reporter.test.ts:6` → `import { _setShuttingDownForTests, _setSinkForTests } from '../telemetry/client'`; lines 86-88 `if (gate === 'build') { _enableTransportForTests(false) }` → `if (gate === 'build') { _setSinkForTests(null) }`. `src/main/startup/main-process-observers.ts:58` comment → `// Why: telemetry must init before any IPC handler/renderer can call track(); without an AppEnvironment it is a no-op, so it's safe early.`
- [ ] **Step 9: Scrub the PostHog wording left in kept files (one-line edits).** `validator.test.ts:6` "instead of calling posthog.capture." → "instead of writing to the local sink."; the three daemon tests: `'posthog exploded'` → `'telemetry sink exploded'` (5 occurrences); `observability/index.ts:225` "PostHog-lane install_id" → "product-telemetry-lane install_id"; `observability/bundle.ts:32` "join-incompatible with the PostHog lane" → "join-incompatible with the product-telemetry lane"; `observability/bundle.test.ts:238,259` `'posthog-install-id'` → `'telemetry-install-id'`.
- [ ] **Step 10: GREEN + regression.** `pnpm test src/main/telemetry src/main/observability/architecture.test.ts src/main/usage/agent-token-usage-reporter.test.ts src/main/ipc/telemetry.test.ts src/main/daemon src/main/observability/bundle.test.ts` — all pass. `pnpm tc` passes.
- [ ] **Step 11: Commit.** `git add -A && git commit -m "feat(telemetry): write product events to a local NDJSON sink instead of PostHog" -m "Keeps the consent gate, burst caps and validator; the transport is now observability/local-file-sink under userData/logs/telemetry.ndjson. Adds the 'local' orca_channel and a narrow lane-isolation carve-out for the sink module." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -m "Claude-Session: https://claude.ai/code/session_01PskLbdTqJNXxJ7KRnDoDoD"`

### Task U1.2: Remove `posthog-node`, the write-key define, and the release verify script
**Files:**
- Delete: `config/scripts/verify-telemetry-constants.mjs`, `config/scripts/telemetry-bundle-constant-patterns.mjs`, `config/scripts/telemetry-bundle-constant-patterns.test.mjs`
- Modify: `package.json:193`, `pnpm-lock.yaml` (via pnpm), `config/packaged-runtime-node-modules.cjs:26`, `electron.vite.config.ts:55-59,291`, `src/types/build-constants.d.ts:13`, `config/scripts/ci-shard-timings.json:255`, `src/renderer/src/lib/telemetry.ts:2`, `.github/workflows/release-mac-build.yml:225-226` and `.github/workflows/release-cut.yml:2298-2299` (only if those files still exist — U3 deletes them)
- Test: `pnpm tc`, `pnpm run build:electron-vite` smoke (main bundle must not contain `posthog`)

**Interfaces:** Consumes: none. Produces: none (U2 removes the two remaining defines).

- [ ] **Step 1: Drop the dependency.** `pnpm remove posthog-node` (rewrites `package.json:193` and `pnpm-lock.yaml`; expected output ends with `Done`). Verify `rg -n posthog package.json pnpm-lock.yaml` prints nothing.
- [ ] **Step 2: Packaged-module list.** `config/packaged-runtime-node-modules.cjs` LINES 26 (`  'posthog-node',`).
- [ ] **Step 3: Vite define.** `electron.vite.config.ts` LINES 55-59 (the `orcaPostHogWriteKey` / `ORCA_POSTHOG_WRITE_KEY_LITERAL` block) and LINES 291 (`      ORCA_POSTHOG_WRITE_KEY: ORCA_POSTHOG_WRITE_KEY_LITERAL,`). In the comment block lines 36-49 change line 46 `(ORCA_BUILD_IDENTITY='stable' | 'rc', ORCA_POSTHOG_WRITE_KEY=phc_...);` to `(ORCA_BUILD_IDENTITY='stable' | 'rc');` (U2 deletes the whole comment).
- [ ] **Step 4: Ambient declaration.** `src/types/build-constants.d.ts` LINES 13 (`declare const ORCA_POSTHOG_WRITE_KEY: string | null`).
- [ ] **Step 5: Release verify script and its references.** DEL the three `config/scripts/*telemetry*` files. `config/scripts/ci-shard-timings.json` LINES 255 (`"config/scripts/telemetry-bundle-constant-patterns.test.mjs": 45,`; keep JSON valid — if it was the last entry in its object, also drop the trailing comma on the previous line). If `.github/workflows/release-mac-build.yml` exists: LINES 225-226 (`- name: Verify telemetry constants present in app.asar` / `run: node config/scripts/verify-telemetry-constants.mjs`) plus the orphaned comment lines 222-224 above it; if `.github/workflows/release-cut.yml` exists: LINES 2298-2299 plus the comment lines 2293-2297 above it.
- [ ] **Step 6: Renderer comment.** `src/renderer/src/lib/telemetry.ts:2` → `// Security invariant: the renderer bundles no analytics SDK — the sole writer lives in main, off the renderer's attack surface.`
- [ ] **Step 7: Verify.** `rg -n "posthog" src config electron.vite.config.ts package.json --glob '!**/locales/*.json' --glob '!src/renderer/src/components/settings/privacy-search.ts'` prints nothing (the two remaining hits are U1.3's). `pnpm tc` passes. `pnpm test config/scripts/dev-channel-windows-workflow-contract.test.mjs` passes (it asserts the env var is absent).
- [ ] **Step 8: Commit.** `git add -A && git commit -m "chore(telemetry): remove posthog-node and the write-key build define" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -m "Claude-Session: https://claude.ai/code/session_01PskLbdTqJNXxJ7KRnDoDoD"`

### Task U1.3: Reword the consent copy for a local-only record and drop the privacy-policy link
**Files:**
- Modify: `src/renderer/src/lib/telemetry.ts:10-11`, `src/renderer/src/components/FirstLaunchBanner.tsx:9,76-95`, `src/renderer/src/components/settings/PrivacyPane.tsx:8,93-120`, `src/renderer/src/components/settings/privacy-search.ts:12-15,23,33-36`, locale catalogs (prune), `src/renderer/src/i18n/en-runtime-required.json` (regenerated)
- Test: `pnpm run verify:localization-catalogs`, `pnpm run verify:localization-extraction`, `pnpm run verify:localization-coverage`, `pnpm tc:web`

**Interfaces:** Consumes: none. Produces: none.

- [ ] **Step 1: Delete the onorca.dev privacy URL.** `src/renderer/src/lib/telemetry.ts` LINES 10-11 (`// Single source-of-truth for the privacy doc URL…` and `export const PRIVACY_URL = 'https://www.onorca.dev/docs/telemetry'`).
- [ ] **Step 2: FirstLaunchBanner.** Line 9 → `import { acknowledgeBanner, setOptIn as telemetrySetOptIn } from '../lib/telemetry'`. Replace lines 76-95 (the title `<p>…</p>` and the body `<p>…</p>` including its link button, the trailing `.` on line 94 and the closing `</p>` on line 95) with:

```tsx
        <p className="font-medium leading-snug">
          {translate(
            'auto.components.FirstLaunchBanner.<HASH1>',
            'Orca keeps a local usage record'
          )}
        </p>
        <p className="text-xs leading-snug text-muted-foreground">
          {translate(
            'auto.components.FirstLaunchBanner.<HASH2>',
            'Anonymous counts of which features you use are written to a file on this machine and never uploaded. Change anytime in Settings -> Privacy & Telemetry.'
          )}
        </p>
```
where `<HASH1>`/`<HASH2>` come from the sha1 recipe above with `filePath` = `src/renderer/src/components/FirstLaunchBanner.tsx`.
- [ ] **Step 3: PrivacyPane.** Line 8 → `import { getConsentState, setOptIn as telemetrySetOptIn } from '../../lib/telemetry'`. First change the `aria-label` on lines 117-120 to the `<HASH3>` key/text below (so the later edit does not shift it), then replace lines 93-113 (from the `<Label>` through the body `<p>`'s closing `</p>` on line 113) with:

```tsx
            <Label>
              {translate('auto.components.settings.PrivacyPane.<HASH3>', 'Keep a local usage record')}
            </Label>
          </div>
          <p className="text-xs text-muted-foreground">
            {translate(
              'auto.components.settings.PrivacyPane.<HASH4>',
              'Orca writes anonymous counts of which features you use and where things break to a file under its data folder. Nothing is sent anywhere.'
            )}
          </p>
```
- [ ] **Step 4: Search entries.** `privacy-search.ts` LINES 23 (the `posthog` keyword). Replace line 12-15 description with key `<HASH5>` + `'Local product usage record, diagnostics, and telemetry controls.'`; replace lines 29-36 title/description with `<HASH6>` + `'Keep a Local Usage Record'` and `<HASH7>` + `'Orca records anonymous feature-usage events to a local file.'`.
- [ ] **Step 5: Catalogs.** `pnpm run sync:localization-catalog` (adds the 7 new keys to `en.json`; expected `Added 7 missing localization key(s) to en.json.`). Prune the retired keys from all six locales with the snippet: `auto.components.FirstLaunchBanner.9784b4d7bc auto.components.FirstLaunchBanner.958d2cc31b auto.components.FirstLaunchBanner.d1deebb050 auto.components.settings.PrivacyPane.fe904ac984 auto.components.settings.PrivacyPane.8bfdd23a88 auto.components.settings.PrivacyPane.77410e0566 auto.components.settings.privacy.search.aa3b794c17 auto.components.settings.privacy.search.2b5a5c312f auto.components.settings.privacy.search.57b283461a auto.components.settings.privacy.search.b707cc3981`. Then `pnpm run sync:localization-runtime-catalog`.
- [ ] **Step 6: Verify.** `pnpm tc:web && pnpm run verify:localization-catalogs && pnpm run verify:localization-extraction && pnpm run verify:localization-coverage && pnpm run check:code-quality:changed` — all exit 0. `rg -n "onorca.dev|posthog" src/renderer/src/lib/telemetry.ts src/renderer/src/components/FirstLaunchBanner.tsx src/renderer/src/components/settings/PrivacyPane.tsx src/renderer/src/components/settings/privacy-search.ts` prints nothing.
- [ ] **Step 7: Commit.** `git add -A && git commit -m "feat(privacy): reword telemetry consent copy for the local-only record" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -m "Claude-Session: https://claude.ai/code/session_01PskLbdTqJNXxJ7KRnDoDoD"`

---

## Unit U2 — Feedback submit, crash-report submit, diagnostic bundle upload

### Task U2.1: Delete the main-process upload lanes (feedback, crash submit, diagnostics upload/delete) and the build-time endpoint defines
**Files:**
- Delete: `src/main/ipc/feedback.ts`, `src/main/ipc/feedback.test.ts`, `src/main/ipc/feedback-request.ts`, `src/main/ipc/feedback-image-attachments.ts`, `src/main/ipc/feedback-image-attachments.test.ts`, `src/main/crash-reporting/crash-feedback-diagnostic-bundle.ts`, `src/main/observability/diagnostic-bundle-upload.ts`, `src/main/observability/diagnostic-upload-endpoint.ts`, `src/main/observability/diagnostic-upload-http.ts`, `src/main/observability/diagnostic-upload-http.test.ts`, `src/types/build-constants.d.ts` (the shared contracts `src/shared/feedback-submit-contract.ts`, `src/shared/feedback-image-limits.ts` + test and `shared/crash-reporting.ts:103-121` are deleted in U2.2 together with their preload/renderer importers, so `pnpm tc` stays green between the two commits)
- Modify: `src/main/ipc/crash-reporting-submission.ts` (keep only `buildUncapturedCrashReportText`), `src/main/ipc/crash-reporting-sendable-reports.ts`, `src/main/ipc/crash-reporting.ts:19-26,52-61,108-114`, `src/main/ipc/crash-reporting.test.ts`, `src/main/ipc/crash-reporting-renderer-breadcrumbs.test.ts:41-43,57-59`, `src/main/ipc/diagnostics.ts`, `src/main/ipc/diagnostics.test.ts`, `src/main/observability/index.ts:45-51` + the `uploadDiagnosticBundle`/`deleteDiagnosticBundle` tail, `src/main/observability/bundle.test.ts:1-2,10-11,386-601`, `src/main/crash-reporting/crashpad-capture.ts:4-7`, `src/main/ipc/register-core-handlers/register-core-handlers.ts:18,163`, `src/main/ipc/register-core-handlers/register-core-handlers.test.ts:194-…`, `src/main/global-fetch-call-site-audit.test.ts:57-58`, `electron.vite.config.ts` (content-anchored, see Step 6), `config/scripts/ci-shard-timings.json:1979,2656`
- Test: `src/main/ipc/crash-reporting.test.ts`, `src/main/ipc/crash-reporting-renderer-breadcrumbs.test.ts`, `src/main/ipc/diagnostics.test.ts`, `src/main/observability/bundle.test.ts`, `src/main/ipc/register-core-handlers/register-core-handlers.test.ts`, `src/main/global-fetch-call-site-audit.test.ts`, `src/main/crash-reporting/*.test.ts`

**Interfaces:**
- Consumes: U1.2 must have removed `ORCA_POSTHOG_WRITE_KEY` first (both tasks edit `electron.vite.config.ts`; U2 deletes the remaining `define` block).
- Produces: `crashReports:*` channels keep `getLatestPending`, `getLatestReport`, `dismiss`, `recordBreadcrumb`, `copyLatestDiagnostics`, `recordRendererError` (no `submit`); `diagnostics:*` keeps `getStatus`, `collectBundle`, `openBundlePreview`, `discardBundlePreview` (no `uploadBundle`, `deleteBundle`); `feedback:submit` is gone. `CrashReportStore` API unchanged.

- [ ] **Step 1: Feedback lane (Tier 1).** DEL the five main-side feedback files listed above (`ipc/feedback.ts`, its test, `feedback-request.ts`, `feedback-image-attachments.ts`, its test). `register-core-handlers.ts` LINES 18 and 163. In `register-core-handlers.test.ts` delete the `vi.mock('../feedback', () => ({ … }))` block that starts at line 194 (through its closing `}))`). `global-fetch-call-site-audit.test.ts` LINES 57-58 (`// fetch mentioned only in a comment` and `['main/ipc/feedback-request.ts', 1]`); fix the trailing comma on the new last entry (`['relay/git-handler-fetch-operations.ts', 1]`).
- [ ] **Step 2: Crash submit → keep capture + copy.** Replace `src/main/ipc/crash-reporting-submission.ts` with only:

```ts
import os from 'node:os'
import { app } from 'electron'
import {
  type CrashReportDiagnosticBundle,
  formatUncapturedCrashReportText
} from '../../shared/crash-reporting'

export function buildUncapturedCrashReportText(
  notes: string | undefined,
  diagnosticBundle?: CrashReportDiagnosticBundle
): string {
  return formatUncapturedCrashReportText(
    {
      createdAt: new Date().toISOString(),
      appVersion: app.getVersion(),
      platform: os.platform(),
      osRelease: os.release(),
      arch: os.arch(),
      electronVersion: process.versions.electron ?? 'unknown',
      chromeVersion: process.versions.chrome ?? 'unknown'
    },
    notes,
    diagnosticBundle
  )
}
```
Replace `src/main/ipc/crash-reporting-sendable-reports.ts` with:

```ts
import type { CrashReportStore } from '../crash-reporting/crash-report-store'

export async function getLatestPendingReport(
  store: CrashReportStore
): Promise<Awaited<ReturnType<CrashReportStore['getLatestPending']>>> {
  const reports = await store.listRecent()
  return reports.find((report) => report.status === 'pending') ?? null
}

export async function getLatestSendableReport(
  store: CrashReportStore
): Promise<Awaited<ReturnType<CrashReportStore['getLatestPending']>>> {
  const reports = await store.listRecent()
  return (
    reports.find((report) => report.status === 'pending' || report.status === 'dismissed') ?? null
  )
}

export async function getRequestedCrashReport(
  store: CrashReportStore,
  args?: { reportId?: string }
): Promise<Awaited<ReturnType<CrashReportStore['getLatestPending']>>> {
  if (args?.reportId) {
    return store.getById(args.reportId)
  }
  // Why: Help > Report Crash can intentionally open without a report ID.
  // Do not replace that uncaptured report with a pending crash that appears later.
  return args ? null : getLatestPendingReport(store)
}
```
In `src/main/ipc/crash-reporting.ts`: lines 19-25 import → `import { getLatestPendingReport, getLatestSendableReport, getRequestedCrashReport } from './crash-reporting-sendable-reports'`; line 26 → `import { buildUncapturedCrashReportText } from './crash-reporting-submission'`; lines 28-44 (`_resetRendererErrorReportDedupeForTests` and `_getCrashReportingStateSizesForTests`) → keep only `recentRendererErrorReportKeys.clear()` in the reset helper and make the sizes helper return `{ recentRendererErrorReportKeys: recentRendererErrorReportKeys.size }`; LINES 55-61 (the `inFlightSubmissions` / `submittedReportIds` branches inside `crashReports:dismiss`, leaving `return store.dismiss(args.reportId)`) and drop the now-pointless `async` on that handler's arrow (line 54); LINES 108-114 (`crashReports:submit` removeHandler + handle). `crashpad-capture.ts:4-7` comment → `// Upload stays off: dumps contain process memory and this build has no upload transport. We keep dumps on disk and lift the *text* signature out of them, so a CHECK failure becomes nameable without shipping raw memory anywhere.`
- [ ] **Step 3: Crash tests.** `crash-reporting.test.ts`: delete `submitFeedbackMock` (lines 14, 35, 54-56, 135-137 and the `vi.mock('../observability/diagnostic-upload-endpoint'…)` block lines 70-72 plus `resolveDiagnosticOrcaChannelMock` lines 11, 28, 131-132), delete every `it(` from line 243 (`submits a pending report through feedback and marks it sent`) through the end of `bounds submitted report ids by evicting the oldest successful sends` (ends before line 613), delete the `collectDiagnosticBundleMock`/`getDiagnosticsStatusMock` hoists and `vi.mock('../observability', …)` lines 65-68 if no remaining test uses them (the copy tests do not), and in `dismisses a pending report locally without any network submission` remove the `expect(submitFeedbackMock).not.toHaveBeenCalled()` line. `crash-reporting-renderer-breadcrumbs.test.ts` LINES 41-43 and 57-59.
- [ ] **Step 4: Diagnostics upload lane.** DEL the three `diagnostic-upload-*.ts` / `diagnostic-bundle-upload.ts` files and the http test. `observability/index.ts` LINES 45-51 (the `diagnostic-bundle-upload` import) and, anchored by symbol, the two exported functions at the end of the file `uploadDiagnosticBundle` (with its `/** Upload a collected bundle payload…` doc comment) and `deleteDiagnosticBundle`. `observability/bundle.test.ts` LINES 1-2 comment → `// Bundle collection tests.`, LINES 10-11, LINES 386-601 (`describe('validateUploadUrl'…` through end of `describe('uploadBundle and deleteBundle'…`); drop now-unused imports `createServer, type RequestListener, type Server`. `src/main/ipc/diagnostics.ts`: header comment lines 2-9 → list the four remaining channels; LINES 33-37 (`UploadBundleResult` type import and the `diagnostic-upload-endpoint` import); line 29 `uploadDiagnosticBundle,` and line 27 `deleteDiagnosticBundle,` out of the observability import; LINES 40 (`type UploadBundleIpcResult`); LINES 103-124 (`getPendingBundleForUpload`); LINES 188-205 (`isTicketId` + `confirmBundleUpload`); line 235 → `orcaChannel: 'dev',`; LINES 243-280 (`diagnostics:uploadBundle`); LINES 298-307 (`diagnostics:deleteBundle`); drop `dialog` from the electron import on line 21. `diagnostics.test.ts`: remove `deleteDiagnosticBundleMock`/`uploadDiagnosticBundleMock`/`showMessageBoxMock` hoists and mocks and the `ORCA_*` global/env lines 93-95; delete tests `rejects upload without…` (110), `uploads only the payload…` (116), `pins official builds…` (138), `returns a quiet cancellation…` (167), `rechecks the retained preview…` (182), `ignores edited preview file contents…` (201), `registers and handles bundle deletion…` (332); rewrite `requires opening the retained review file before sending` (236) as `it('marks a retained preview opened only through openBundlePreview')` asserting `openBundlePreview` resolves and a second `discardBundlePreview` then `openBundlePreview` rejects with `/expired/`; rewrite `discards retained bundle previews on request` (247) and `expires retained bundle previews…` (260) to probe with `handlers.get('diagnostics:openBundlePreview')` instead of the upload handler.
- [ ] **Step 5: Shared types.** None in this task (see U2.2 Step 1a).
- [ ] **Step 6: Build-time defines (content-anchored; U1.2 already removed lines 55-59 and 291).** In `electron.vite.config.ts` delete: the comment block that starts `// Why: the telemetry transport is gated by two compile-time constants` through the `const ORCA_BUILD_IDENTITY_LITERAL = … : 'null'` statement; the `const orcaDiagnosticsTokenUrl = …` through `const ORCA_DIAGNOSTICS_TOKEN_URL_LITERAL = … : 'null'` statement; and the `// Why: compile-time substitution for the telemetry gate…` comment plus the whole `define: { … },` object inside the main build config. DEL `src/types/build-constants.d.ts`; run `rg -n "build-constants" config tsconfig*.json` and delete any `include` entry it prints. `ci-shard-timings.json` LINES 1979, 2656 (feedback-image-attachments and diagnostic-upload-http test timings).
- [ ] **Step 7: Verify.** `pnpm tc && pnpm test src/main/ipc/crash-reporting.test.ts src/main/ipc/crash-reporting-renderer-breadcrumbs.test.ts src/main/ipc/diagnostics.test.ts src/main/observability src/main/crash-reporting src/main/ipc/register-core-handlers src/main/global-fetch-call-site-audit.test.ts` all pass. `rg -n "onorca.dev/v1/feedback|ORCA_DIAGNOSTICS_TOKEN_URL|ORCA_BUILD_IDENTITY|diagnostics/token" src electron.vite.config.ts` prints nothing.
- [ ] **Step 8: Commit.** `git add -A && git commit -m "feat(diagnostics): remove feedback, crash-report submit and diagnostic upload transports" -m "Local crash capture, copy-to-clipboard and the local diagnostic bundle preview stay." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -m "Claude-Session: https://claude.ai/code/session_01PskLbdTqJNXxJ7KRnDoDoD"`

### Task U2.2: Remove the preload and renderer submit surfaces (feedback dialog, crash "Send", diagnostics "Send to support")
**Files:**
- Delete: `src/shared/feedback-submit-contract.ts`, `src/shared/feedback-image-limits.ts`, `src/shared/feedback-image-limits.test.ts`, `src/preload/api/feedback-bridge.ts`, `src/renderer/src/components/sidebar/SidebarFeedbackDialog.tsx`, `src/renderer/src/components/sidebar/SidebarFeedbackDialog.test.tsx`, `src/renderer/src/components/sidebar/SidebarFeedbackImageAttachments.tsx`, `src/renderer/src/components/sidebar/use-feedback-image-drop.ts`, `src/renderer/src/components/sidebar/use-feedback-image-drop.test.tsx`, `src/renderer/src/components/sidebar/use-sidebar-feedback-environment-prefill.ts`, `src/renderer/src/components/sidebar/use-sidebar-feedback-images.ts`, `src/renderer/src/components/sidebar/use-sidebar-feedback-images.test.tsx`, `src/renderer/src/lib/feedback-image-attachments.ts`, `src/renderer/src/lib/feedback-image-attachments.test.ts`, `src/renderer/src/components/crash-report/crash-report-submit-notice.ts`, `src/renderer/src/components/crash-report/crash-report-submit-notice.test.ts`
- Modify: `src/shared/crash-reporting.ts:103-121`, `src/preload/api/crash-report-api.ts:10-13,25,35-37`, `src/preload/api/crash-reports-bridge.ts:5-6,26-27`, `src/preload/api/diagnostics-bridge.ts:12-15`, `src/preload/api/telemetry-api.ts:25-31,42-43`, `src/preload/api-types.ts:24,86,210`, `src/preload/index.ts:24,119`, `src/renderer/src/components/sidebar/SidebarSettingsHelpMenu.tsx`, `src/renderer/src/components/crash-report/CrashReportDialogSurface.tsx`, `src/renderer/src/components/settings/PrivacyDiagnosticsSection.tsx`, `src/renderer/src/components/settings/PrivacyDiagnosticBundleControls.tsx`, `src/renderer/src/web/preload-api/web-diagnostics-api.ts:12-17,37-38` (if present), `config/scripts/ci-shard-timings.json:7840,9174`, locale catalogs (prune)
- Test: `pnpm test src/renderer/src/components/crash-report src/renderer/src/components/sidebar src/renderer/src/components/settings`, `pnpm tc:web`

**Interfaces:** Consumes U2.1's trimmed IPC surface. Produces: `window.api.feedback` removed; `window.api.crashReports.submit` removed; `window.api.diagnostics.{uploadBundle,deleteBundle}` removed; `DiagnosticsUploadPayload` type removed.

- [ ] **Step 1a: Shared contracts.** DEL `src/shared/feedback-submit-contract.ts`, `src/shared/feedback-image-limits.ts`, `src/shared/feedback-image-limits.test.ts`. `src/shared/crash-reporting.ts` LINES 103-121 (`CrashReportSubmitArgs` and `CrashReportSubmitResult`; keep `CrashReportCopySubmissionFailure`, used by the copy path). `ci-shard-timings.json` LINES 9174 (`src/shared/feedback-image-limits.test.ts`).
- [ ] **Step 1: Preload.** DEL `feedback-bridge.ts`. `crash-report-api.ts` LINES 10-13 (`feedback-submit-contract` import), 25 (`submit:`), 35-37 (`FeedbackApi`); also drop `CrashReportSubmitArgs, CrashReportSubmitResult` from lines 1-9. `crash-reports-bridge.ts` LINES 26-27 and drop `CrashReportSubmitArgs, CrashReportSubmitResult` from the import (lines 5-6). `diagnostics-bridge.ts` LINES 12-15. `telemetry-api.ts` LINES 25-31 and 42-43. `api-types.ts`: line 24 → `import type { CrashReportsApi } from './api/crash-report-api'`; LINES 86 (`feedback: FeedbackApi`), 210 (`DiagnosticsUploadPayload,`). `preload/index.ts` LINES 24 and 119.
- [ ] **Step 2: Help menu.** `SidebarSettingsHelpMenu.tsx`: LINES 9 (`MessageSquareText,`), 35 (`import type * as SidebarFeedbackDialogModule…`), 39-48 (the lazy-loader comment + `loadSidebarFeedbackDialog` + `SidebarFeedbackDialog = lazyWithRetry(…)`), 109-111 (`feedbackOpen` and `feedbackDialogMounted` state + comment), 124-128 (the warm `if (open) { … }` block inside `handleMenuOpenChange`), 131-134 (`handleOpenFeedback`), 256-262 (the "Send Feedback" `DropdownMenuItem`), 357-361 (the `{feedbackDialogMounted ? … : null}` block). If `lazyWithRetry` (line 34) has no remaining use in the file, delete that import line too.
- [ ] **Step 3: Crash dialog keeps Copy only.** DEL `crash-report-submit-notice.ts` + test. `CrashReportDialogSurface.tsx`: line 2 → `import { AlertTriangle, Clipboard } from 'lucide-react'`; LINES 3 (`toast`), 5 (`Checkbox`), 14 (`Label`), 20 (`type CrashReportDiagnosticBundle,`), 23 (`GitHubViewer`), 25-30 (submit-notice import); lines 52-59 (`getDialogDescription`) → return `'Copy a privacy-safe crash report to share however you like. Nothing is sent automatically.'` for the no-report case and `'Copy a privacy-safe diagnostic report for this UI error.'` / `'Copy a privacy-safe diagnostic report of what happened.'` otherwise; LINES 87-92 (`includeDiagnosticLogs`, `submitting`, `viewer`, `viewerRequestIdRef` + comments), 102-132 (`clearViewer`, `loadViewerForOpenDialog`, the `useEffect` on `open`), 134-153 (`showSubmitFailure`), 171-215 (`handleSubmit`); in the `Dialog onOpenChange` (218-234) remove the `if (submitting && !nextOpen) { return }` and the `clearViewer()` call; line 277 fallback text → `'No automatic crash report was captured. You can still copy the details below.'` with a new key; LINES 298-320 (the attach-logs checkbox block); footer: line 329 `disabled={loading}` stays, LINES 339 (`disabled={submitting}`), replace line 341 with `{translate('auto.components.crash.report.CrashReportDialog.<HASH>', 'Close')}` (new key, text `Close`), LINES 343-346 (the Send button). Remove `useCallback, useEffect, useRef` from line 1 if unused after the edit.
- [ ] **Step 4: Privacy diagnostics keeps create/open/discard.** `PrivacyDiagnosticsSection.tsx`: LINES 20 (`ticketId`), 23 (`uploading`), 25-26 (`copyingTicket`, `deletingTicket`), 68 and 114-146 (`setTicketId(null)` + `handleUploadBundle`), 178-236 (`handleCopyTicket`, `handleDeleteUploadedBundle`); in the JSX replace the row title (246-249) with `'Create a local diagnostic file'` (new key), replace `getDiagnosticBundleDescription({ bundle, previewOpened, ticketId })` with `getDiagnosticBundleDescription({ bundle, previewOpened })`, and drop the `ticketId`/`uploading`/`copyingTicket`/`deletingTicket`/`onUpload`/`onCopyTicket`/`onDeleteUploadedBundle`/`onDismissTicket` props (lines 256, 259, 261-262, 265, 267-269). `PrivacyDiagnosticBundleControls.tsx`: line 1 → `import { Eye, FileText, Loader2, X } from 'lucide-react'`; delete props `ticketId`, `uploading`, `copyingTicket`, `deletingTicket`, `onUpload`, `onCopyTicket`, `onDeleteUploadedBundle`, `onDismissTicket` (13, 16, 18-19, 22, 24-26, 31, 34, 36-37, 40, 42-44); LINES 46-79 (the `if (ticketId)` branch); LINES 96-114 (the "Send to support" button); in `getDiagnosticBundleDescription` drop `ticketId` (145, 149, 151-157) and change the two remaining strings to `'You opened the review file ({{value0}}). Keep it, or discard it.'` and `'Your review file is ready ({{value0}}). Open it to see what was collected.'` and the default to `'Collects recent app activity and errors into a redacted file you can review. It stays on this machine.'` (all new keys).
- [ ] **Step 5: Web stub (only if U7 has not yet deleted `src/renderer/src/web/`).** `web-diagnostics-api.ts` LINES 12-17 and 37-38.
- [ ] **Step 6: Catalogs.** `pnpm run sync:localization-catalog`; prune `auto.components.sidebar.SidebarFeedbackDialog auto.components.crash.report.submit` (NOT `auto.web.web.preload.api.fb290366b2` — `web-diagnostics-api.ts:21` still uses it for `copyLatestDiagnostics`) plus the individual retired keys named above (`auto.components.crash.report.CrashReportDialog.{88fea8e84e,b4951cd27c,8e24fe4f75,b082f27490,e59f0b9427,ead6fc0510}`, `auto.components.settings.PrivacyDiagnosticsSection.{49fc6c80e8,13eb2c65a1,7a4944595b,c18cbe45df,af2fc82cde}`, `auto.components.settings.PrivacyDiagnosticBundleControls.{2801d4ce22,7f14a1733c,2ae9a6b63e,d8be621237,aca2c8a367,61676df223,fd7b3891af,62340d4439,19ec5e29b3}`, `auto.components.sidebar.SidebarSettingsHelpMenu.4cf5b868d7`); `pnpm run sync:localization-runtime-catalog`. `ci-shard-timings.json` LINES 7840.
- [ ] **Step 7: Verify.** `pnpm tc && pnpm test src/renderer/src/components/crash-report src/renderer/src/components/sidebar src/renderer/src/components/settings src/preload && pnpm run check:code-quality:changed && pnpm run verify:localization-catalogs && pnpm run verify:localization-extraction && pnpm run verify:localization-coverage`. `rg -n "feedback:submit|crashReports:submit|diagnostics:uploadBundle|diagnostics:deleteBundle|api\.feedback" src` prints nothing.
- [ ] **Step 8: Commit.** `git add -A && git commit -m "feat(ui): remove feedback, crash-send and diagnostics-upload surfaces" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -m "Claude-Session: https://claude.ai/code/session_01PskLbdTqJNXxJ7KRnDoDoD"`

---

## Unit U4 — Star nag

### Task U4.1: Delete the star-nag service and the Orca-repo star calls in main
**Files:**
- Delete: `src/main/star-nag/` (entire directory: `agent-value-moment.ts`, `app-star-source.ts`, `console-events.ts`, `direct-star-attempt.ts`, `onboarding-completed.ts`, `prompt-context.ts`, `prompt-session-telemetry.ts`, `service.ts`, `service-test-harness.ts`, `threshold-trigger.ts`, `web-handoff.ts`, and the 5 `service-*.test.ts`), `src/main/github/client/fetch/orca-star.ts`, `src/main/github/client-starred.test.ts`
- Modify: `src/main/github/client.ts:11`, `src/main/ipc/github-account-handlers.ts:2,5,12-13,18-29`, `src/main/ipc/github-ipc-module-mocks.ts:36-37`, `src/main/ipc/github-star-telemetry.test.ts`, `src/main/startup/main-process-ready-runtime.ts` (import + lines 56-58), `src/main/startup/main-process-state.ts:18,96`, `src/main/startup/main-process-quit.ts:128`, `config/scripts/ci-shard-timings.json` (star-nag test entries)
- Test: `src/main/ipc/github-star-telemetry.test.ts` (renamed content), `src/main/github/*.test.ts`, `src/main/startup/*.test.ts`

**Interfaces:**
- Consumes: none.
- Produces: IPC channels `star-nag:*`, `gh:checkOrcaStarred`, `gh:starOrca` no longer exist (U4.2 removes their callers). Kept on purpose: `src/shared/star-nag-telemetry.ts`, the `star_nag_outcome`/`app_starred_orca` schemas in `src/shared/telemetry-*.ts`, `MAIN_OWNED_TELEMETRY_EVENTS` entries in `src/main/ipc/telemetry.ts`, `STAR_NAG_INITIAL_THRESHOLD` in `src/shared/constants.ts`, the `starNag*` fields in `src/shared/persisted-ui-state-types.ts` and `ui-state-schema-parity-checks.ts`, `src/shared/gh-star-source.ts`, and `StatsCollector.onAgentStarted` — all are inert data in hot files; removing the persisted fields would need a migration.

- [ ] **Step 1: Delete the service and the gh star calls.** `git rm -r src/main/star-nag src/main/github/client/fetch/orca-star.ts src/main/github/client-starred.test.ts`. `src/main/github/client.ts` LINES 11.
- [ ] **Step 2: Startup wiring.** `main-process-ready-runtime.ts`: delete the `import { StarNagService } from '../star-nag/service'` line (find with `rg -n "star-nag/service" src/main/startup/main-process-ready-runtime.ts`) and LINES 56-58 (`state.starNag = new StarNagService(store, state.stats!)`, `.start()`, `.registerIpcHandlers()`). `main-process-state.ts` LINES 18 and 96. `main-process-quit.ts` LINES 128 (`state.starNag?.stop()`).
- [ ] **Step 3: GitHub account handlers.** `github-account-handlers.ts`: LINES 2 (`appStarSourceSchema` import), 12-13 (`getCohortAtEmit`, `track` imports — only `gh:starOrca` used them), 18-29 (`gh:checkOrcaStarred` and `gh:starOrca` handlers); line 5 → `import { getAuthenticatedViewer } from '../github/client'`. `github-ipc-module-mocks.ts` LINES 36-37. `github-star-telemetry.test.ts`: delete the four star `it(` blocks starting at `it('emits app_starred_orca once after a successful star with cohort context'` through the end of `it('preserves star result but skips telemetry for an invalid IPC source'`, delete `starOrca: starOrcaMock` from line 19 and lines 20-21 (`trackMock`, `getCohortAtEmitMock`); `git mv src/main/ipc/github-star-telemetry.test.ts src/main/ipc/github-viewer-handler.test.ts` (the remaining test is the viewer lookup).
- [ ] **Step 4: Shard timings.** Delete the `ci-shard-timings.json` lines for `src/main/star-nag/*.test.ts` and `src/main/github/client-starred.test.ts` (`rg -n "star-nag|client-starred|github-star-telemetry" config/scripts/ci-shard-timings.json` lists them).
- [ ] **Step 5: Verify.** `pnpm tc:node && pnpm test src/main/ipc/github-viewer-handler.test.ts src/main/github src/main/startup src/main/ipc/telemetry.test.ts`. `rg -n "star-nag|StarNagService|checkOrcaStarred|starOrca" src/main` prints nothing.
- [ ] **Step 6: Commit.** `git add -A && git commit -m "feat(star-nag): remove the GitHub star prompt service and star IPC" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -m "Claude-Session: https://claude.ai/code/session_01PskLbdTqJNXxJ7KRnDoDoD"`

### Task U4.2: Remove the star-nag preload bridge and renderer surfaces
**Files:**
- Delete: `src/preload/api/star-nag-bridge.ts`, `src/renderer/src/components/StarNagCard.tsx`, `src/renderer/src/components/StarNagCard.test.tsx`, `src/renderer/src/components/star-nag/` (4 files), `src/renderer/src/components/landing-github-star-state.ts`, `src/renderer/src/components/settings/GeneralSupportSection.tsx`, `src/renderer/src/components/settings/general-support-search.ts`, `src/renderer/src/web/preload-api/web-star-nag-api.ts` (if U7 has not removed `web/`)
- Modify: `src/preload/api/onboarding-api.ts:13-28`, `src/preload/api-types.ts:41,95`, `src/preload/index.ts:33,128`, `src/preload/api/gh-bridge-mutations-and-projects.ts:41,156-157`, `src/preload/api/github-pull-request-api.ts:1,198-199`, `src/renderer/src/app-shell/AppRootSurfaces.tsx:11,13-14,296-298,303-306`, `src/renderer/src/components/Landing.tsx`, `src/renderer/src/components/settings/GeneralPane.tsx:6,287-291`, `src/renderer/src/components/settings/general-search.ts:7,10,270`, `src/renderer/src/components/onboarding/use-onboarding-flow-persistence.ts:121-126`, `src/renderer/src/components/onboarding/use-onboarding-flow-persistence.test.ts` (starNag expectations), `src/renderer/src/web/web-preload-api.ts:47,67`, `src/renderer/src/web/preload-api/web-github-api.ts:128-129`, `src/renderer/src/web/web-preload-api-composition.test.ts:22`, locale catalogs (prune), `config/scripts/ci-shard-timings.json`
- Test: `pnpm test src/renderer/src/components/onboarding src/renderer/src/components/settings src/renderer/src/app-shell src/renderer/src/web src/preload`, `pnpm tc:web`

**Interfaces:** Consumes U4.1 (channels gone). Produces: `window.api.starNag`, `window.api.gh.checkOrcaStarred`, `window.api.gh.starOrca` removed.

- [ ] **Step 1: Preload.** DEL `star-nag-bridge.ts`. `onboarding-api.ts` LINES 13-28 (`StarNagApi`). `api-types.ts`: line 41 → `import type { OnboardingApi } from './api/onboarding-api'`; LINES 95. `preload/index.ts` LINES 33, 128. `gh-bridge-mutations-and-projects.ts` LINES 41, 156-157. `github-pull-request-api.ts` LINES 1, 198-199.
- [ ] **Step 2: App root.** `AppRootSurfaces.tsx` LINES 11, 13, 14 (imports), 296-298 (`<OverlayBoundary boundaryId="overlay.star-nag"…>` block), 303-306 (`overlay.star-nag-toast` block and `<StarNagAgentValueMomentObserver />`). DEL `StarNagCard.tsx`, its test, and the `star-nag/` dir.
- [ ] **Step 3: Landing.** DEL `landing-github-star-state.ts`. `Landing.tsx`: line 1 → `import { useEffect, useMemo, useState } from 'react'`; line 2 → `import { AlertTriangle, ExternalLink, FolderPlus, GitBranchPlus, X } from 'lucide-react'`; LINES 3 (`cn`), 14 (`useMountedRef`), 19 (`landing-github-star-state` import); LINES 27-141 (`ORCA_GITHUB_URL` comment+const, `StarButtonProps`, the whole `GitHubStarButton` component through its closing `}`); LINES 232-233 (`hasGitHubProject`, `showGitHubSupportFooter`) and line 17's `hasGitHubBackedProject,` (keep `type PreflightIssue`); LINES 237 (`useLandingOrcaStarState()`); LINES 317-321 (the footer `{showGitHubSupportFooter && (…)}` block). Drop `useMemo` from line 1 if no other use remains (`rg -n useMemo src/renderer/src/components/Landing.tsx`).
- [ ] **Step 4: Settings support section.** DEL `GeneralSupportSection.tsx` and `general-support-search.ts`. `GeneralPane.tsx` LINES 6 and 287-291 (the `{matchesSettingsSearch(searchQuery, getGeneralSupportSearchEntries()) ? (<GeneralSupportSection …/>) : null}` block) plus the `getGeneralSupportSearchEntries` import line (`rg -n getGeneralSupportSearchEntries src/renderer/src/components/settings/GeneralPane.tsx`). `general-search.ts` LINES 7, 10, 270 (fix the trailing comma on the preceding spread if 270 was last).
- [ ] **Step 5: Onboarding hook.** `use-onboarding-flow-persistence.ts`: replace lines 121-127 (`if (outcome === 'completed') { … } else if (outcome === 'dismissed') {`) with `if (outcome === 'dismissed') {` (deleting the `window.api.starNag.onboardingCompleted()` timeout). In its test remove the `starNag` mock entry and the `onboardingCompleted` assertion (`rg -n starNag src/renderer/src/components/onboarding/use-onboarding-flow-persistence.test.ts`).
- [ ] **Step 6: Web stubs (if present).** DEL `web-star-nag-api.ts`; `web-preload-api.ts` LINES 47, 67; `web-github-api.ts` LINES 128-129; `web-preload-api-composition.test.ts` LINES 22 (`'starNag',`).
- [ ] **Step 7: Catalogs.** Prune `auto.components.StarNagCard auto.components.star.nag auto.components.settings.GeneralSupportSection auto.components.settings.general.search.36a72f0d9e auto.components.settings.general.search.e0b8c8bc25 auto.components.Landing.ec43b38ba7 auto.components.Landing.157bb5ecbb auto.components.Landing.0d0ace8861 auto.components.Landing.c1cf168479` (confirm the StarNag subtree names with `rg -n '"StarNag|"star-nag|"star\.nag' src/renderer/src/i18n/locales/en.json`), then `pnpm run sync:localization-runtime-catalog`. Delete the `ci-shard-timings.json` entries for the deleted renderer tests.
- [ ] **Step 8: Verify.** `pnpm tc && pnpm test src/renderer/src/components/onboarding src/renderer/src/components/settings src/renderer/src/app-shell src/renderer/src/web src/preload && pnpm run check:code-quality:changed && pnpm run verify:localization-catalogs && pnpm run verify:localization-extraction && pnpm run verify:localization-coverage`. `rg -n "starNag|StarNag|checkOrcaStarred|starOrca|stablyai/orca" src/renderer src/preload` prints nothing.
- [ ] **Step 9: Commit.** `git add -A && git commit -m "feat(ui): remove star-nag cards, toast, landing and settings star prompts" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -m "Claude-Session: https://claude.ai/code/session_01PskLbdTqJNXxJ7KRnDoDoD"`

---

## Unit U9 — Vendor usage/quota polling and Claude OAuth refresh

Order inside U9: **U9.3 → U9.1 → U9.2 → U9.4**. U9.3 only needs the old service's `consumeCodexRateLimitResetCredit` to still exist while it deletes the coordinator (the last main-side caller); once it is gone, U9.1 can replace the service without breaking `pnpm tc`.

Design: `RateLimitService` becomes a local state holder (same public seam, same `RateLimitState` shape, same `rateLimits:update` push) fed only by the Claude statusline hook (`ingestLiveClaudeRateLimits`, local). Every HTTP fetcher, the hidden-PTY/RPC probes that existed only to feed polling, the whole `service/` chain except `service-types.ts`, and the polling/focus triggers are deleted. Files in `src/main/rate-limits/` that stay because local code imports them: `service.ts` (rewritten), `service/service-types.ts`, `claude-usage-window.ts`, `claude-rate-limit-target.ts`, `codex-rate-limit-target.ts`, `initial-account-rate-limit-target.ts` (+test), `account-runtime-target-sync.ts` (+test), `cursor-auth.ts`, `cursor-auth-paths.ts`, `cursor-desktop-state-db.ts`, `cursor-session-token.ts` (+tests), `grok-auth.ts` (+test), `codex-probe-termination.ts` (+test). (`rate-limit-bucket-summary.ts` and `time-zone-wall-clock.ts` are referenced only by deleted files — verified with `rg -l` — so they are deleted too.)

### Task U9.1: Replace `RateLimitService` with a local state holder and delete every vendor fetcher (TDD)
**Files:**
- Create: `src/main/rate-limits/service-no-network.test.ts`
- Delete (every other file under `src/main/rate-limits/`, listed): `antigravity-usage-command.ts`, `antigravity-usage-fetcher.ts`, `antigravity-usage-response.ts`, `auth-filesystem-operation.ts`, `claude-active-usage-fetch.ts`, `claude-cli-usage-fetch.ts`, `claude-fetcher-test-harness.ts`, `claude-fetcher.ts`, `claude-managed-account-credentials.ts`, `claude-managed-account-usage.ts`, `claude-managed-usage-panel.ts`, `claude-oauth-credentials.ts`, `claude-oauth-recovery.ts`, `claude-oauth-usage-error.ts`, `claude-oauth-usage-request.ts`, `claude-pty-reset-parser.ts`, `claude-pty-stop-markers.ts`, `claude-pty-usage-parser.ts`, `claude-pty.ts`, `claude-usage-error-classification.ts`, `claude-usage-fetch-options.ts`, `claude-usage-refresh-plan.ts`, `claude-usage-result.ts`, `codex-auth-presence.ts`, `codex-backend-auth.ts`, `codex-backend-usage-client.ts`, `codex-fetcher.ts`, `codex-rate-limit-fetch-options.ts`, `codex-rate-limit-fetch-result.ts`, `codex-rate-limit-window-classification.ts`, `codex-rate-limit-window-mapper.ts`, `codex-reset-credit-client.ts`, `codex-rpc-rate-limit-probe.ts`, `cursor-fetcher.ts`, `cursor-usage-mapping.ts`, `gemini-bucket-formatting.ts`, `gemini-cli-oauth-extractor.ts`, `gemini-oauth-sources.ts`, `gemini-usage-fetcher.test-fixtures.ts`, `gemini-usage-fetcher.ts`, `grok-fetcher.ts`, `hidden-pty-cleanup.ts`, `hidden-rate-limit-pty-cwd.ts`, `hidden-rate-limit-shell.ts`, `kimi-fetcher.ts`, `minimax/` (whole dir), `opencode-go-api-key-source.ts`, `opencode-go-request-session.ts`, `opencode-go-status-parsing.ts`, `opencode-go-usage-api.ts`, `opencode-go-usage-fetcher.ts`, `opencode-go-usage-source-selection.ts`, `rate-limit-bucket-summary.ts`, `rate-limit-service-test-harness.ts`, `time-zone-wall-clock.ts`, `zcode-usage-fetcher.ts`, `service/` except `service-types.ts` (delete `service-account-refresh.ts`, `service-configuration.ts`, `service-fetch-control.ts`, `service-fetch-policy.ts`, `service-fetch-queue.ts`, `service-fetch-targets.ts`, `service-full-cycle-application.ts`, `service-full-cycle-preparation.ts`, `service-inactive-accounts.ts`, `service-polling.ts`, `service-provider-cycles.ts`, `service-result-policy.ts`, `service-sibling-provider-result.ts`, `service-state.ts`), and every `*.test.ts` whose subject is deleted (`antigravity-usage-*.test.ts`, `auth-filesystem-operation*.test.ts`, `claude-fetcher-*.test.ts`, `claude-oauth-usage-error.test.ts`, `claude-pty.test.ts`, `claude-usage-error-classification.test.ts`, `claude-usage-refresh-plan.test.ts`, `codex-auth-presence.test.ts`, `codex-fetcher*.test.ts`, `codex-rate-limit-window-classification.test.ts`, `codex-rpc-rate-limit-probe.test.ts`, `cursor-fetcher.test.ts`, `cursor-usage-mapping.test.ts`, `gemini-*.test.ts`, `grok-fetcher.test.ts`, `grok-weekly-zero.test.ts`, `hidden-pty-cleanup.test.ts`, `kimi-fetcher*.test.ts`, `opencode-go-*.test.ts`, `service-*.test.ts`, `zcode-usage-fetcher.test.ts`). Also delete `src/main/ipc/rate-limits.test.ts`.
- Modify: `src/main/rate-limits/service.ts` (rewrite), `src/main/ipc/rate-limits.ts` (rewrite), `src/main/ipc/minimax-credentials.ts:14-15,39-48,51,60,70,78,83`, `src/main/ipc/minimax-credentials.test.ts:44-…`, `src/main/startup/main-process-account-services.ts:15-17,71-73,75-79,90-104,113-133,143-181`, `src/main/startup/main-window-core-services.ts:141-142`, `src/main/startup/main-process-ready-foundation.ts:263-268`, `src/main/runtime/runtime-account-controller.ts:70-85`, `src/main/runtime/runtime-service-command-surface.ts:47-48,140-141`, `src/main/runtime/rpc/methods/accounts.ts:37,139`, `src/main/global-fetch-call-site-audit.test.ts:25-26`, `src/main/ipc/register-core-handlers/register-core-handlers.ts:153` (only the MiniMax call arguments; `registerRateLimitHandlers(rateLimits, codexAccounts)` keeps its signature), `config/scripts/ci-shard-timings.json` (deleted test entries), `src/main/wsl/__fixtures__/wsl-invocation-allowlist.txt` and `src/shared/child-process/__fixtures__/child-process-import-allowlist.txt` (remove lines naming deleted `rate-limits/` files)
- Test: `src/main/rate-limits/service-no-network.test.ts`, `src/main/rate-limits/*.test.ts` (kept ones), `src/main/claude-accounts`, `src/main/codex-accounts`, `src/main/startup`, `src/main/runtime/rpc/methods/accounts.test.ts`, `src/main/ipc/minimax-credentials.test.ts`, `src/main/global-fetch-call-site-audit.test.ts`, `src/main/wsl`, `src/shared/child-process`

**Interfaces:**
- Consumes: `ClaudeStatusLineRateLimits` (shared), `service-types.ts` normalizers, `claude-usage-window.ts`, `agentHookServer.setClaudeStatusLineListener`; U9.3 must already have removed `codex-reset-credit-coordinator.ts`.
- Produces: `RateLimitService` with exactly: `attach(window)`, `stop()`, `getState()`, `onStateChange(listener)`, `setClaudeAuthPreparationResolver(resolver)`, `setClaudeFetchTarget(target?)`, `setCodexFetchTarget(target?)`, `refreshForClaudeAccountChange(outgoingAccountId?, target?)`, `refreshClaudeForTarget(target?)`, `refreshForCodexAccountChange(outgoingAccountId?, target?)`, `refreshCodexForTarget(target?)`, `evictInactiveClaudeCache(accountId)`, `evictInactiveCodexCache(accountId)`, `ingestLiveClaudeRateLimits(event)`. Removed: `start`, `refresh`, `refreshIfStale`, `refreshGrok`, `refreshAfterClaudeLivePtysDrained`, `setPollingInterval`, `fetchInactive*OnOpen`, `consumeCodexRateLimitResetCredit`, `invalidateMiniMaxCredentialState`, every other `set*Resolver`. IPC keeps `rateLimits:get`, `rateLimits:refreshClaudeForTarget`, `rateLimits:refreshCodexForTarget`, `rateLimits:update`; removes `rateLimits:refresh`, `refreshGrok`, `refreshMiniMax`, `setPollingInterval`, `fetchInactiveClaudeAccounts`, `fetchInactiveCodexAccounts`, `consumeCodexResetCredit` (U9.3/U9.4 remove their callers).

- [ ] **Step 1: Write the guard test (RED).** Create `src/main/rate-limits/service-no-network.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { netFetchMock } = vi.hoisted(() => ({ netFetchMock: vi.fn() }))
vi.mock('electron', () => ({ net: { fetch: netFetchMock } }))
vi.mock('../minimax/minimax-cookie-store', () => ({ hasMiniMaxSessionCookie: () => false }))
vi.mock('../minimax/minimax-api-key-store', () => ({ hasMiniMaxApiKey: () => false }))
vi.mock('./grok-auth', () => ({ readGrokAuthSession: () => ({ status: 'missing' }) }))

import { RateLimitService } from './service'

describe('RateLimitService (local-only)', () => {
  const globalFetch = vi.fn()
  beforeEach(() => {
    vi.stubGlobal('fetch', globalFetch)
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    netFetchMock.mockReset()
    globalFetch.mockReset()
  })

  it('never opens a connection on target changes or account switches', async () => {
    const service = new RateLimitService()
    await service.refreshClaudeForTarget({ runtime: 'host', wslDistro: null })
    await service.refreshCodexForTarget({ runtime: 'host', wslDistro: null })
    await service.refreshForClaudeAccountChange('old-account', { runtime: 'host', wslDistro: null })
    await service.refreshForCodexAccountChange(null, { runtime: 'host', wslDistro: null })
    expect(netFetchMock).not.toHaveBeenCalled()
    expect(globalFetch).not.toHaveBeenCalled()
    expect(service.getState().claude).toBeNull()
    expect(service.getState().codex).toBeNull()
  })

  it('publishes live Claude statusline windows for the selected config dir', async () => {
    const service = new RateLimitService()
    service.setClaudeAuthPreparationResolver(async () => ({
      provenance: 'managed',
      envPatch: { CLAUDE_CONFIG_DIR: '/tmp/claude-a' }
    }) as never)
    const states: unknown[] = []
    service.onStateChange((state) => states.push(state))
    await service.refreshClaudeForTarget({ runtime: 'host', wslDistro: null })
    service.ingestLiveClaudeRateLimits({
      configDir: '/tmp/claude-a',
      fiveHour: { usedPercent: 40, resetsAt: Date.now() + 60_000 },
      sevenDay: null
    } as never)
    const claude = service.getState().claude
    expect(claude?.status).toBe('ok')
    expect(claude?.usageMetadata?.source).toBe('live-session')
    expect(states.length).toBeGreaterThan(0)
    expect(netFetchMock).not.toHaveBeenCalled()
  })

  it('drops statusline posts from another config dir', async () => {
    const service = new RateLimitService()
    service.setClaudeAuthPreparationResolver(async () => ({
      provenance: 'managed',
      envPatch: { CLAUDE_CONFIG_DIR: '/tmp/claude-a' }
    }) as never)
    await service.refreshClaudeForTarget({ runtime: 'host', wslDistro: null })
    service.ingestLiveClaudeRateLimits({
      configDir: '/tmp/claude-b',
      fiveHour: { usedPercent: 10, resetsAt: Date.now() + 60_000 },
      sevenDay: null
    } as never)
    expect(service.getState().claude).toBeNull()
  })
})
```
Adjust the `fiveHour` literal to the real `ClaudeStatusLineWindow` field names (`rg -n "export type ClaudeStatusLineWindow" -A 6 src/shared/claude-statusline-rate-limits.ts`) and the `ClaudeRuntimeAuthPreparation` literal to its real fields (`rg -n "export type ClaudeRuntimeAuthPreparation" -A 8 src/main/claude-accounts/runtime-auth/runtime-auth-types.ts`). `pnpm test src/main/rate-limits/service-no-network.test.ts` — RED: `refreshClaudeForTarget` on the old service triggers a fetch cycle (first test fails on `netFetchMock`/spawn, or the import graph pulls `claude-fetcher`).
- [ ] **Step 2: Delete the fetch pipeline (Tier 1).** `git rm` every file in the Delete list (use `git rm -r src/main/rate-limits/minimax` and `git rm src/main/rate-limits/service/service-{account-refresh,configuration,fetch-control,fetch-policy,fetch-queue,fetch-targets,full-cycle-application,full-cycle-preparation,inactive-accounts,polling,provider-cycles,result-policy,sibling-provider-result,state}.ts`). Confirm with `ls src/main/rate-limits src/main/rate-limits/service` that only the kept files remain.
- [ ] **Step 3: Rewrite `src/main/rate-limits/service.ts` (GREEN).**

```ts
import type { BrowserWindow } from 'electron'
import type { ClaudeStatusLineRateLimits } from '../../shared/claude-statusline-rate-limits'
import type { RateLimitState } from '../../shared/rate-limit-types'
import { hasMiniMaxApiKey } from '../minimax/minimax-api-key-store'
import { hasMiniMaxSessionCookie } from '../minimax/minimax-cookie-store'
import { mapClaudeUsageWindow } from './claude-usage-window'
import { readGrokAuthSession } from './grok-auth'
import {
  LIVE_CLAUDE_INGEST_DEDUPE_MS,
  isSameUsageWindow,
  normalizeClaudeAccountSelectionTarget,
  normalizeClaudeConfigDir,
  normalizeCodexAccountSelectionTarget,
  type ClaudeAccountSelectionTarget,
  type ClaudeAuthPreparationResolver,
  type CodexAccountSelectionTarget,
  type InternalRateLimitState,
  type NormalizedClaudeAccountSelectionTarget,
  type NormalizedCodexAccountSelectionTarget
} from './service/service-types'

export type { InactiveCodexAccountInfo } from './service/service-types'

type ClaudeAuthSnapshot = { configDir: string | null; provenance: string }

/**
 * Local-only rate-limit state. Nothing here polls a vendor: the only producer is the Claude
 * statusline hook (`ingestLiveClaudeRateLimits`), which a running `claude` CLI posts to the
 * loopback hook server. Every other provider slot stays `null`.
 */
export class RateLimitService {
  private state: InternalRateLimitState = {
    claude: null,
    codex: null,
    gemini: null,
    opencodeGo: null,
    kimi: null,
    antigravity: null,
    minimax: null,
    grok: null,
    cursor: null,
    zcode: null
  }
  private claudeFetchTarget: NormalizedClaudeAccountSelectionTarget = { runtime: 'host', wslDistro: null }
  private codexFetchTarget: NormalizedCodexAccountSelectionTarget = { runtime: 'host', wslDistro: null }
  private claudeAuthPreparationResolver: ClaudeAuthPreparationResolver | null = null
  private claudeAuthSnapshot: ClaudeAuthSnapshot | null = null
  // Why: a switch during the resolver await must not attribute the outgoing account's posts to the new bar.
  private claudeSnapshotGeneration = 0
  private readonly stateListeners = new Set<(state: RateLimitState) => void>()
  private mainWindow: BrowserWindow | null = null
  private detachWindowListeners: (() => void) | null = null

  attach(mainWindow: BrowserWindow): void {
    this.detachWindowListeners?.()
    this.mainWindow = mainWindow
    const onClosed = (): void => {
      if (this.mainWindow === mainWindow) {
        this.mainWindow = null
      }
      this.detachWindowListeners = null
    }
    mainWindow.on('closed', onClosed)
    this.detachWindowListeners = () => mainWindow.removeListener('closed', onClosed)
  }

  stop(): void {
    this.detachWindowListeners?.()
    this.detachWindowListeners = null
    this.mainWindow = null
  }

  onStateChange(listener: (state: RateLimitState) => void): () => void {
    this.stateListeners.add(listener)
    return () => {
      this.stateListeners.delete(listener)
    }
  }

  getState(): RateLimitState {
    return {
      ...this.state,
      minimaxCookieConfigured: hasMiniMaxSessionCookie(),
      minimaxApiKeyConfigured: hasMiniMaxApiKey(),
      opencodeGoApiKeyConfigured: false,
      grokAuthConfigured: readGrokAuthSession().status === 'ok',
      cursorAuthConfigured: false,
      claudeTarget: this.claudeFetchTarget,
      codexTarget: this.codexFetchTarget,
      inactiveClaudeAccounts: [],
      inactiveCodexAccounts: []
    }
  }

  // Why no eager capture: the resolver runs `syncForCurrentSelection`, which must not race a surviving daemon
  // Claude at startup (see main-process-ready-foundation.ts); the first statusline post or target change captures it.
  setClaudeAuthPreparationResolver(resolver: ClaudeAuthPreparationResolver): void {
    this.claudeAuthPreparationResolver = resolver
  }

  setClaudeFetchTarget(target?: ClaudeAccountSelectionTarget): void {
    this.claudeFetchTarget = normalizeClaudeAccountSelectionTarget(target)
  }

  setCodexFetchTarget(target?: CodexAccountSelectionTarget): void {
    this.codexFetchTarget = normalizeCodexAccountSelectionTarget(target)
  }

  async refreshForClaudeAccountChange(
    _outgoingAccountId?: string | null,
    target?: ClaudeAccountSelectionTarget
  ): Promise<RateLimitState> {
    return this.refreshClaudeForTarget(target)
  }

  async refreshClaudeForTarget(target?: ClaudeAccountSelectionTarget): Promise<RateLimitState> {
    this.claudeFetchTarget = normalizeClaudeAccountSelectionTarget(target)
    // Why: live windows belong to the previous account; the next statusline post repopulates the bar.
    this.updateState({ ...this.state, claude: null })
    await this.captureClaudeAuthSnapshot()
    return this.getState()
  }

  async refreshForCodexAccountChange(
    _outgoingAccountId?: string | null,
    target?: CodexAccountSelectionTarget
  ): Promise<RateLimitState> {
    return this.refreshCodexForTarget(target)
  }

  async refreshCodexForTarget(target?: CodexAccountSelectionTarget): Promise<RateLimitState> {
    this.codexFetchTarget = normalizeCodexAccountSelectionTarget(target)
    this.updateState({ ...this.state, codex: null })
    return this.getState()
  }

  // Why kept: account services call these on removal; there is no inactive cache any more, so only the snapshot is republished.
  evictInactiveClaudeCache(_accountId: string): void {
    this.pushToRenderer()
  }

  evictInactiveCodexCache(_accountId: string): void {
    this.pushToRenderer()
  }

  /** Live usage windows forwarded from a Claude session's statusLine command. */
  ingestLiveClaudeRateLimits(event: ClaudeStatusLineRateLimits): void {
    const snapshot = this.claudeAuthSnapshot
    if (!snapshot) {
      console.debug('[rate-limits] dropped live Claude usage: no auth snapshot yet', {
        eventConfigDir: event.configDir
      })
      void this.captureClaudeAuthSnapshot()
      return
    }
    // Why: sessions of other accounts (or other runtimes) report their own quota; mixing them into the active account's bar would lie.
    if (normalizeClaudeConfigDir(event.configDir) !== snapshot.configDir) {
      console.debug('[rate-limits] dropped live Claude usage: configDir mismatch', {
        eventConfigDir: event.configDir,
        snapshotConfigDir: snapshot.configDir
      })
      return
    }
    const freshSession = mapClaudeUsageWindow(event.fiveHour ?? undefined, 300)
    const freshWeekly = mapClaudeUsageWindow(event.sevenDay ?? undefined, 10080)
    if (!freshSession && !freshWeekly) {
      return
    }
    const previous = this.state.claude
    // Why: statusline payloads can carry a single window; an absent one means "no update", not "cleared".
    const session = freshSession ?? previous?.session ?? null
    const weekly = freshWeekly ?? previous?.weekly ?? null
    if (
      previous?.status === 'ok' &&
      previous.usageMetadata?.source === 'live-session' &&
      Date.now() - previous.updatedAt < LIVE_CLAUDE_INGEST_DEDUPE_MS &&
      isSameUsageWindow(previous.session, session) &&
      isSameUsageWindow(previous.weekly, weekly)
    ) {
      return
    }
    this.updateState({
      ...this.state,
      claude: {
        provider: 'claude',
        session,
        weekly,
        fableWeekly: previous?.fableWeekly ?? null,
        updatedAt: Date.now(),
        error: null,
        status: 'ok',
        usageMetadata: {
          source: 'live-session',
          lastSuccessfulSource: 'live-session',
          credentialSource: previous?.usageMetadata?.credentialSource,
          retryAtMs: previous?.usageMetadata?.retryAtMs,
          authProvenance: snapshot.provenance
        }
      }
    })
  }

  private async captureClaudeAuthSnapshot(): Promise<void> {
    const resolver = this.claudeAuthPreparationResolver
    if (!resolver) {
      return
    }
    const generation = ++this.claudeSnapshotGeneration
    const target = this.claudeFetchTarget
    try {
      const preparation = await resolver(target)
      if (generation !== this.claudeSnapshotGeneration) {
        return
      }
      this.claudeAuthSnapshot = {
        configDir: normalizeClaudeConfigDir(preparation.envPatch.CLAUDE_CONFIG_DIR),
        provenance: preparation.provenance ?? 'system'
      }
    } catch (error) {
      console.warn('[rate-limits] could not resolve the Claude auth snapshot:', error)
    }
  }

  private updateState(next: InternalRateLimitState): void {
    this.state = next
    this.pushToRenderer()
  }

  private pushToRenderer(): void {
    const state = this.getState()
    for (const listener of this.stateListeners) {
      try {
        listener(state)
      } catch {
        // ignore — one bad listener must not break the others
      }
    }
    if (!this.mainWindow || this.mainWindow.isDestroyed()) {
      return
    }
    this.mainWindow.webContents.send('rateLimits:update', state)
  }
}
```
If `service-types.ts` does not export `ClaudeAuthPreparationResolver`/`isSameUsageWindow`/`LIVE_CLAUDE_INGEST_DEDUPE_MS`/`normalizeClaudeConfigDir` under exactly these names, use the names `rg -n "^export" src/main/rate-limits/service/service-types.ts` prints (they exist at lines 40, 94, 138, 161 today); delete from `service-types.ts` only exports whose sole consumers were deleted files if `pnpm run check:dead-classes`/knip complains (not required).
- [ ] **Step 4: Rewrite `src/main/ipc/rate-limits.ts`.**

```ts
import { ipcMain } from 'electron'
import type { RateLimitService } from '../rate-limits/service'
import type { RateLimitRuntimeTarget } from '../../shared/rate-limit-types'
import type { CodexAccountService } from '../codex-accounts/service'

export function registerRateLimitHandlers(
  rateLimits: RateLimitService,
  _codexAccounts: CodexAccountService
): void {
  ipcMain.handle('rateLimits:get', () => rateLimits.getState())
  ipcMain.handle('rateLimits:refreshCodexForTarget', (_event, target: RateLimitRuntimeTarget) =>
    rateLimits.refreshCodexForTarget(target)
  )
  ipcMain.handle('rateLimits:refreshClaudeForTarget', (_event, target: RateLimitRuntimeTarget) =>
    rateLimits.refreshClaudeForTarget(target)
  )
}
```
DEL `src/main/ipc/rate-limits.test.ts` (all four cases test removed channels).
- [ ] **Step 5: Startup wiring (Tier 2 line deletes).** `main-window-core-services.ts` LINES 141-142 (`// Why: quota probes spawn CLIs…` and `rateLimits.start({ fetchImmediately: false })`); keep line 140 `rateLimits.attach(window)`. `main-process-ready-foundation.ts` LINES 263-268 (the `// Why: while a live claude defers…` comment and the `onLiveClaudePtysDrained(() => { void state.rateLimits?.refreshAfterClaudeLivePtysDrained() })` block); if `onLiveClaudePtysDrained` is then unused in the file, drop it from its import line. `main-process-account-services.ts` LINES 15-17 (kimi/minimax imports), 71-73 (`setCodexHomePathResolver`), 75-79 (kimi resolver), 90-104 (the MiniMax `if ('minimaxEndpoint' in updates …) { … }` block and its comment), 113-133 (`setOpenCodeGoConfigResolver`, `setMiniMaxConfigResolver`, `setGeminiCliOAuthEnabledResolver`, `setNetworkProxySettingsResolver`), 143-181 (`setInactiveClaudeAccountsResolver`, `setInactiveCodexAccountsResolver`); then delete the now-unused imports `normalizeCodexRuntimeSelection` (19), `normalizeClaudeRuntimeSelection` (20). Keep 74, 80-89, 106-112. `ipc/minimax-credentials.ts` LINES 14-15 (`clearMiniMaxSessionCookieJar` + `RateLimitService` imports), 39-48 (`refreshAfterMiniMaxCredentialChange`), 60, 70, 78, 83 (its four calls), and lines 63-67 (`try { await clearMiniMaxSessionCookieJar() } catch …`); change line 51 to `export function registerMiniMaxCredentialsHandlers(): void {` and `register-core-handlers.ts:153` to `registerMiniMaxCredentialsHandlers()`. In `minimax-credentials.test.ts` delete the `vi.mock('../rate-limits/minimax/minimax-request-context', …)` block (line 44) and any `rateLimits` argument/assertions (`rg -n "rateLimits|clearMiniMaxSessionCookieJar" src/main/ipc/minimax-credentials.test.ts`).
- [ ] **Step 6: Runtime RPC refresh hooks.** `runtime-account-controller.ts` LINES 70-85 (`refreshForMobile`, `refreshForMobileSubscriber`). `runtime-service-command-surface.ts` LINES 47-48 and 140-141. `rpc/methods/accounts.ts` LINES 37 (`await runtime.refreshAccountsForMobile()`) and 139 (`void runtime.refreshAccountsForMobileSubscriber()`); if either deletion leaves an empty `try {}`/`if {}` body, delete that wrapper too. Fix `src/main/runtime/rpc/methods/accounts.test.ts` and `src/main/runtime/runtime-rpc-mobile-method-allowlist-fixtures.ts` references (`rg -n "refreshAccountsForMobile" src/main/runtime`) by deleting those mock lines/expectations.
- [ ] **Step 7: Ratchets and fixtures.** `global-fetch-call-site-audit.test.ts` LINES 25-26 (`codex-fetcher.ts`, `zcode-usage-fetcher.ts`). Delete every `ci-shard-timings.json` line naming a deleted `src/main/rate-limits/**` or `src/main/ipc/rate-limits.test.ts` path (`rg -n "rate-limits/" config/scripts/ci-shard-timings.json`). Delete lines naming deleted files from `src/main/wsl/__fixtures__/wsl-invocation-allowlist.txt` and `src/shared/child-process/__fixtures__/child-process-import-allowlist.txt` (`rg -n "rate-limits" src/main/wsl/__fixtures__/wsl-invocation-allowlist.txt src/shared/child-process/__fixtures__/child-process-import-allowlist.txt`).
- [ ] **Step 8: Verify (GREEN).** `pnpm tc && pnpm test src/main/rate-limits src/main/claude-accounts src/main/codex-accounts src/main/startup src/main/runtime/rpc/methods/accounts.test.ts src/main/ipc/minimax-credentials.test.ts src/main/global-fetch-call-site-audit.test.ts src/main/wsl src/shared/child-process src/main/ipc/register-core-handlers`. `rg -n "net\.fetch|\bfetch\(|https?://" src/main/rate-limits --glob '!**/*.test.ts'` prints nothing. `pnpm tc` is green here because U9.3 already removed the coordinator (the last caller of `consumeCodexRateLimitResetCredit`) and the preload bridge still declares the removed channels as plain `ipcRenderer.invoke` strings (they are trimmed in U9.4).
- [ ] **Step 9: Commit.** `git add -A && git commit -m "feat(rate-limits): replace vendor usage polling with a local statusline-fed state holder" -m "Deletes every provider HTTP fetcher, the hidden CLI probes and the polling/focus triggers. RateLimitService keeps its seam (getState/onStateChange/target setters/evict) and is fed only by the Claude statusline hook." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -m "Claude-Session: https://claude.ai/code/session_01PskLbdTqJNXxJ7KRnDoDoD"`

### Task U9.2: Remove the Claude OAuth token refresh (network half of `oauth-refresh.ts`)
**Files:**
- Modify: `src/main/claude-accounts/oauth-refresh.ts:1-2,4-10,15,30-35,77-114,116-170`, `src/main/claude-accounts/oauth-refresh.test.ts:14-35,83-127,129-end`, `src/main/claude-accounts/runtime-auth/runtime-auth-managed-credentials.ts:11,50-72`, `src/main/claude-accounts/runtime-auth/runtime-auth-sync.ts:10,244-256`, `src/main/claude-accounts/runtime-auth-service-launch-refresh.test.ts`, `src/main/claude-accounts/runtime-auth-service-test-harness.ts:38-46`
- Test: `src/main/claude-accounts/oauth-refresh.test.ts`, `src/main/claude-accounts/runtime-auth-service-*.test.ts`

**Interfaces:** Consumes: U9.1 (it deleted the only other importer, `rate-limits/claude-managed-account-usage.ts`). Produces: `oauth-refresh.ts` exports only `parseClaudeOauthBlob`, `readRefreshToken`, `isOauthTokenExpiring`.

- [ ] **Step 1: RED.** In `oauth-refresh.test.ts` delete the `describe('applyRefreshedToken'…)` (83-127) and `describe('refreshClaudeOauthCredentials'…)` (129-end) blocks, the `vi.mock('electron'…)` (14-18) and `vi.mock('../network/proxy-settings'…)` (19-…) blocks, and the two names from the import at lines 2-13. Add `it('exports no network refresh', () => { expect('refreshClaudeOauthCredentials' in module).toBe(false) })` using `import * as module from './oauth-refresh'`. Run `pnpm test src/main/claude-accounts/oauth-refresh.test.ts` — RED on the new assertion.
- [ ] **Step 2: Strip the network half.** `oauth-refresh.ts`: LINES 1-2 (`net, session` and proxy imports), 4-10 (the OAuth-ownership comment + `OAUTH_TOKEN_URL`/`OAUTH_CLIENT_ID`), 15 (`REFRESH_TIMEOUT_MS`), 30-35 (`TokenEndpointResponse`), 77-114 (`applyRefreshedToken`), 116-170 (`refreshClaudeOauthCredentials`). Keep lines 12-14 (`OAUTH_EXPIRY_BUFFER_MS`), 17-28, 37-75.
- [ ] **Step 3: Callers.** `runtime-auth-managed-credentials.ts`: line 11 → `import { isOauthTokenExpiring } from '../oauth-refresh'`; delete lines 50-72 (`refreshManagedAccountTokenIfNeeded` and its doc comment) — and in `runtime-auth-sync.ts` replace lines 244-256 with:

```ts
    // Why: this build never rotates tokens itself; a live or expiring token is handed to the CLI as-is and
    // read back after the CLI refreshes it (the read-back path below preserves its rotation).
    if (hasLiveClaudePtys() && isOauthTokenExpiring(credentialsJson)) {
      this.managedRefreshDeferredByLivePtyAccountId = activeAccount.id
    }
```
(keep the `hasLiveClaudePtys`/`isOauthTokenExpiring` imports; if `managedRefreshDeferredByLivePtyAccountId` has no remaining reader — `rg -n managedRefreshDeferredByLivePtyAccountId src/main/claude-accounts` — delete the field and this block entirely.)
- [ ] **Step 4: Tests.** `runtime-auth-service-test-harness.ts` lines 38-46: `createOauthRefreshMock` returns only `{ isOauthTokenExpiring: vi.fn(() => false) }`; comment → "the proactive switch-in refresh no longer exists; keep the token not-expiring so live-PTY gating never trips here". `runtime-auth-service-launch-refresh.test.ts`: delete the tests `proactively refreshes and persists an expiring account on switch-in`, `refreshes the active account with an expired token when no Claude PTY is live`, `does not refresh the active account while a Claude PTY is live`; in `leaves host system-default credentials untouched before launch` delete the four `refreshClaudeOauthCredentials` lines (mock setup and `not.toHaveBeenCalled`); delete `refreshClaudeOauthCredentials` from the import on line 18. If the file has no `it(` left besides the reauth one, keep it under its current name.
- [ ] **Step 5: Verify.** `rg -n "refreshClaudeOauthCredentials|applyRefreshedToken" src/main/claude-accounts --glob '**/*.test.ts'` must print nothing before running tests (only `oauth-refresh.test.ts` and `runtime-auth-service-launch-refresh.test.ts` referenced them; both are edited above). Then `pnpm tc:node && pnpm test src/main/claude-accounts`. `rg -n "platform.claude.com|refreshClaudeOauthCredentials|applyRefreshedToken" src` prints nothing.
- [ ] **Step 6: Commit.** `git add -A && git commit -m "feat(claude-accounts): drop the OAuth token refresh request" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -m "Claude-Session: https://claude.ai/code/session_01PskLbdTqJNXxJ7KRnDoDoD"`

### Task U9.3: Remove Codex rate-limit reset-credit redemption (vendor POST) end to end
**Files:**
- Delete: `src/main/codex-accounts/codex-reset-credit-coordinator.ts`, `src/main/codex-accounts/codex-reset-credit-ledger.ts`, `src/main/codex-accounts/codex-reset-credit-ledger.test.ts`, `src/main/codex-accounts/codex-reset-credit-scope-validation.ts`, `src/main/codex-accounts/service-reset-credit-test-fixtures.ts`, `src/main/codex-accounts/service-reset-credit-durability.test.ts`, `src/main/codex-accounts/service-reset-credit-home-ownership.test.ts`, `src/main/codex-accounts/service-reset-credit-target-routing.test.ts`, `src/renderer/src/components/status-bar/codex-switcher-projection.ts`
- Modify: `src/main/codex-accounts/service.ts:10,22,29,36-39,90,114-121,131,246-255`, `src/main/codex-accounts/codex-account-selection.ts:31,87-92`, `src/main/codex-accounts/codex-account-service-types.ts:6-7,34-60`, `src/main/codex-accounts/service-test-harness.ts:7,44,58-62`, `src/main/codex-accounts/service-account-selection-and-removal.test.ts` (reset-credit expectations), `src/main/runtime/runtime-account-controller.ts:12-13,103-123`, `src/main/runtime/runtime-service-command-surface.ts:52,145`, `src/main/runtime/rpc/methods/accounts.ts:6,60-65`, `src/main/runtime/rpc/methods/accounts.test.ts:118-155`, `src/main/runtime/runtime-rpc/runtime-rpc-mobile-method-allowlist.ts:3`, `src/main/runtime/runtime-rpc-mobile-method-allowlist-fixtures.ts:20-…,127`, `src/main/runtime/runtime-rpc-mobile-method-allowlist.test.ts`, `src/main/runtime/orca-runtime.ts` (the `consumeCodexRateLimitResetCredit` method and the `CODEX_RESET_CREDIT_RUNTIME_CAPABILITY` entry), `src/main/runtime/orca-runtime-tests/runtime-availability.spec.ts:271,300-380`, `src/shared/rpc-contract/accounts-params.ts:43-…`, `src/shared/rpc-contract/rpc-params-catalog.generated.ts` (regenerated), `src/preload/api/agent-usage-api.ts:54`, `src/preload/api/rate-limits-bridge.ts:14-15`, `src/renderer/src/store/slices/rate-limits.ts:13,109-117`, `src/renderer/src/components/status-bar/use-codex-switcher-controller.ts:39-40,46,64,211-253,289,294,297,303,309-310,313-315`, `src/renderer/src/components/status-bar/CodexSwitcherMenu.tsx:47,50,52,57,63-65,68-70,104-181`, `src/renderer/src/components/status-bar/codex-status-sign-in.test.tsx:157`, `src/renderer/src/web/preload-api/web-rate-limits-api.ts:11-12` (if present), locale catalogs (prune)
- Test: `src/main/codex-accounts`, `src/main/runtime`, `src/renderer/src/components/status-bar`, `pnpm run verify:rpc-params-catalog`

**Interfaces:** Consumes: nothing from U9.1 — runs FIRST in U9 against the old service (its `consumeCodexRateLimitResetCredit` still exists; this task deletes its only caller). Produces: RPC method `accounts.consumeCodexResetCredit` removed and the runtime stops advertising `CODEX_RESET_CREDIT_RUNTIME_CAPABILITY` (constant kept in `src/shared/protocol-version.ts` so old clients still negotiate cleanly); `window.api.rateLimits.consumeCodexResetCredit` removed. Kept on purpose (persisted-state schema, inert): `src/shared/codex-reset-credit-scope.ts`, `src/shared/codex-reset-credit-attempt-ledger.ts` (+tests), the ledger fields in `src/shared/persisted-state-types.ts`, `src/main/persistence/loading-store/primary-state-writes.ts`, `src/shared/constants.ts`, the `skipCodexRateLimitResetConfirm` setting, `rateLimitResetCredits` on `ProviderRateLimits`, and the read-only credit label in `tooltip.tsx` (it renders nothing when the field is absent).

- [ ] **Step 1: Main.** DEL the four `codex-reset-credit-*` sources/tests and the fixtures. `codex-accounts/service.ts`: LINES 10 (`CodexResetCreditExpectedScope` import), 22 (coordinator import), 29 and 36-39 (reset-credit type imports/re-exports), 90 (`resetCredits` field), 114-121 (`this.resetCredits = new CodexResetCreditCoordinator({…})`), 131 (`discardResetAttempts:` dependency), 246-255 (`consumeRateLimitResetCredit`, `consumeCurrentRateLimitResetCredit`); drop `CodexRateLimitResetResult` from its import if now unused. `codex-account-selection.ts` LINES 31 (`discardResetAttempts` dependency type) and 87-92 (the `try { await this.dependencies.discardResetAttempts(accountId) } catch …` block). `codex-account-service-types.ts` LINES 6-7 (imports) and 34-60 (the three reset-credit result types). `service-test-harness.ts` LINES 7, 44, 58-62 (ledger type/state and the two store mocks); in `service-account-selection-and-removal.test.ts` delete assertions on `discardForRemovedAccount`/reset ledger (`rg -n "reset|Reset" src/main/codex-accounts/service-account-selection-and-removal.test.ts`).
- [ ] **Step 2: Runtime RPC.** `runtime-account-controller.ts` LINES 103-123 (`consumeCodexResetCredit`) and the now-unused imports on lines 12-13 (`CodexRateLimitResetOutcome`, `CodexResetCreditExpectedScope`) plus the `CodexRateLimitResetRpcResult` import. `runtime-service-command-surface.ts` LINES 52, 145. `rpc/methods/accounts.ts` LINES 6 and 60-65 (the `defineMethod({ name: 'accounts.consumeCodexResetCredit' … })`). `runtime-rpc-mobile-method-allowlist.ts` LINES 3. `runtime-rpc-mobile-method-allowlist-fixtures.ts`: delete the `consumeCodexRateLimitResetCredit` mock (line 20-…) and its line 127 entry; fix `runtime-rpc-mobile-method-allowlist.test.ts` expectations that list the method (`rg -n consumeCodexResetCredit src/main/runtime`). `orca-runtime.ts`: delete the `consumeCodexRateLimitResetCredit` method and remove `CODEX_RESET_CREDIT_RUNTIME_CAPABILITY` from the capabilities list it advertises (`rg -n "CODEX_RESET_CREDIT_RUNTIME_CAPABILITY|consumeCodexRateLimitResetCredit" src/main/runtime/orca-runtime.ts`). `runtime-availability.spec.ts`: line 271 → `expect(runtime.getStatus().capabilities).not.toContain('accounts.codex-reset-credit.v1')`; delete the reset-credit `it(` blocks around lines 300-380. `rpc/methods/accounts.test.ts` LINES 118-155 (the consume test). `shared/rpc-contract/accounts-params.ts`: delete `ConsumeCodexResetCreditParams` (line 43 through its closing `)`), then `pnpm run generate:rpc-params-catalog` (regenerates `rpc-params-catalog.generated.ts`; expected: the `accounts.consumeCodexResetCredit` entry disappears).
- [ ] **Step 3: Preload + renderer.** `agent-usage-api.ts` LINES 54. `rate-limits-bridge.ts` LINES 14-15. `store/slices/rate-limits.ts` LINES 13 and 109-117. DEL `codex-switcher-projection.ts` (its `getCodexAccountSyncKey` re-export: change importers to import from `./provider-account-sync-key` — `rg -n "codex-switcher-projection" src/renderer/src`). `use-codex-switcher-controller.ts`: LINES 39-40, 46, 64, 211-253 (`handleRedeemReset`, `handleResetMenuSelect`, `handleConfirmReset`), the `getCodexResetProjection` import and `const resetProjection = …` (289), and the returned keys `handleConfirmReset`, `handleResetMenuSelect`, `isRedeemingReset`, `resetConfirmOpen`, `...resetProjection`, `setResetConfirmOpen`, `setSkipFutureResetConfirm`, `skipFutureResetConfirm` (294, 297, 303, 309-310, 313-315); drop `updateSettings` (62) if unused. `CodexSwitcherMenu.tsx`: LINES 47, 50, 52, 57, 63-65, 68-70 (destructured names) and 104-181 (the `<Dialog …>` and the `{resetCreditCount !== null ? … : null}` block); drop now-unused imports (`Dialog*`, `Checkbox`, `RotateCcw`, `Loader2` if unused, `STATUS_BAR_CONTEXT_MENU_EXEMPT_PROPS` if unused) and the `hidePanelResetCredits` prop at line 85 plus `ProviderDetailsMenu.tsx:24,36,66` (`showResetCredits={true}` stays default). `codex-status-sign-in.test.tsx` LINES 157. `web-rate-limits-api.ts` LINES 11-12 (if present).
- [ ] **Step 4: Catalogs.** Prune `auto.components.status.bar.StatusBar.{972a1ff497,6d1042aa6f,f077f586db,c0e972d726,25d8bbde69,e159fc1fd7,5e5f9f5160,5ecae9197c}`; `pnpm run sync:localization-runtime-catalog`. Delete `ci-shard-timings.json` lines for the deleted tests.
- [ ] **Step 5: Verify.** `pnpm tc && pnpm test src/main/codex-accounts src/main/runtime src/renderer/src/components/status-bar src/shared/rpc-contract && pnpm run verify:rpc-params-catalog && pnpm run check:code-quality:changed && pnpm run verify:localization-catalogs && pnpm run verify:localization-extraction && pnpm run verify:localization-coverage`. `rg -n "chatgpt.com|consumeCodexResetCredit|consumeCodexRateLimitResetCredit" src` prints only the old service's method in `src/main/rate-limits/service/service-account-refresh.ts` (deleted next in U9.1).
- [ ] **Step 6: Commit.** `git add -A && git commit -m "feat(codex-accounts): remove rate-limit reset-credit redemption" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -m "Claude-Session: https://claude.ai/code/session_01PskLbdTqJNXxJ7KRnDoDoD"`

### Task U9.4: Trim the preload bridge and renderer actions that called removed refresh channels
**Files:**
- Modify: `src/preload/api/rate-limits-bridge.ts:11,18-25`, `src/preload/api/agent-usage-api.ts` (`RateLimitsApi` members `refresh`, `refreshGrok`, `refreshMiniMax`, `setPollingInterval`, `fetchInactiveClaudeAccounts`, `fetchInactiveCodexAccounts`), `src/renderer/src/store/slices/rate-limits.ts:9-10,14-15,31-47,119-133`, `src/renderer/src/components/status-bar/use-status-bar-controller.ts:18,76-88`, `src/renderer/src/components/settings/GrokAccountsSection.tsx:14,43-50`, `src/renderer/src/components/settings/CursorAccountsSection.tsx:35,77-85`, `src/renderer/src/components/stats/GrokUsagePane.tsx:13,22-28`, `src/renderer/src/components/status-bar/ClaudeSwitcherMenu.tsx:68,124-131`, `src/renderer/src/components/status-bar/use-codex-switcher-controller.ts:65,184-185,261-268`, `src/renderer/src/components/status-bar/codex-sign-in-action.ts:15-16,34-35,79-81`, `src/renderer/src/web/preload-api/web-rate-limits-api.ts:9-10,14-18` (if present), `src/renderer/src/hooks/ipc-events-*test-fixtures.ts`/`*test-harness.ts` (mock entries for removed methods), locale catalogs (prune)
- Test: `pnpm test src/renderer/src/components/status-bar src/renderer/src/components/settings src/renderer/src/components/stats src/renderer/src/hooks src/preload`, `pnpm tc:web`

**Interfaces:** Consumes U9.1/U9.3. Produces: `window.api.rateLimits` = `{ get, refreshCodexForTarget, refreshClaudeForTarget, onUpdate }`; store slice = `{ rateLimits, fetchRateLimits, refreshClaudeRateLimitsForTarget, refreshCodexRateLimitsForTarget, setRateLimitsFromPush }`.

- [ ] **Step 1: Preload.** `rate-limits-bridge.ts` LINES 11 (`refresh:`), 18-25 (`setPollingInterval`, `fetchInactiveClaudeAccounts`, `fetchInactiveCodexAccounts`, `refreshMiniMax`, `refreshGrok`). `agent-usage-api.ts`: delete the matching members of `RateLimitsApi` (`rg -n "refresh:|refreshGrok|refreshMiniMax|setPollingInterval|fetchInactive" src/preload/api/agent-usage-api.ts`).
- [ ] **Step 2: Store.** `store/slices/rate-limits.ts` LINES 9-10, 14-15, 31-47, 119-133.
- [ ] **Step 3: Call sites.** `use-status-bar-controller.ts`: LINES 18; lines 76-88 `handleRefresh` → keep the agent re-detection only: replace `await Promise.all([refreshRateLimits(), refreshDetectedAgents()])` with `await refreshDetectedAgents()` and the deps array with `[isRefreshing, refreshDetectedAgents]`. `GrokAccountsSection.tsx`: LINES 14 and the `handleRefreshUsage` (43-50) plus the button that calls it (`rg -n handleRefreshUsage src/renderer/src/components/settings/GrokAccountsSection.tsx`); drop the `refreshing` state (18) if unused. `CursorAccountsSection.tsx`: LINES 35, 75-85 and the button calling `handleRefreshUsage`; drop `refreshing` (39) if unused. `GrokUsagePane.tsx`: LINES 13, 20-28 (`isRefreshing` + `handleRefresh`) and the refresh button that calls `handleRefresh`. `ClaudeSwitcherMenu.tsx`: LINES 68 and 124-131 → `const handleAccountsExpandedToggle = useCallback((): void => { setAccountsExpanded((expanded) => !expanded) }, [])`. `use-codex-switcher-controller.ts`: LINES 65, 185, and 261-268 → same `setAccountsExpanded((expanded) => !expanded)` form. `codex-sign-in-action.ts`: LINES 16, 35, and 79-81 (`} else if (mountedRef.current && accountsExpandedRef.current) { await fetchInactiveCodexAccountUsage() }`); if `accountsExpandedRef` then has no other use in the function, delete it from the dependencies type (line 15), the destructure (line 34) and the caller in `use-codex-switcher-controller.ts:184`. Test fixtures: `rg -n "refreshGrok|refreshMiniMax|setPollingInterval|fetchInactive|refresh: " src/renderer/src/hooks/ipc-events-*test-* src/renderer/src/components/status-bar/*.test.* src/renderer/src/components/settings/*.test.*` and delete each listed mock line/expectation.
- [ ] **Step 4: Web stub (if present).** `web-rate-limits-api.ts` LINES 9-10 (`refresh`), 14-18 (`setPollingInterval`, `fetchInactive*`, `refreshMiniMax`, `refreshGrok`).
- [ ] **Step 5: Catalogs + verify.** Prune any orphaned keys the deleted refresh buttons used (list them with `rg -n "Refresh" src/renderer/src/components/settings/GrokAccountsSection.tsx src/renderer/src/components/settings/CursorAccountsSection.tsx src/renderer/src/components/stats/GrokUsagePane.tsx` before deleting), `pnpm run sync:localization-runtime-catalog`. `pnpm tc && pnpm test src/renderer/src/components/status-bar src/renderer/src/components/settings src/renderer/src/components/stats src/renderer/src/hooks src/preload && pnpm run check:code-quality:changed && pnpm run verify:localization-catalogs && pnpm run verify:localization-extraction && pnpm run verify:localization-coverage`. `rg -n "rateLimits:(refresh'|refreshGrok|refreshMiniMax|setPollingInterval|fetchInactive)" src` prints nothing.
- [ ] **Step 6: Commit.** `git add -A && git commit -m "feat(ui): drop usage refresh actions that polled vendor quota APIs" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -m "Claude-Session: https://claude.ai/code/session_01PskLbdTqJNXxJ7KRnDoDoD"`
---

## Planner group: U5-U8

## Scope notes for U5 and U8 (read before the tasks)

**Inert-shared-module rule (applies to every task below).** A `src/shared/*` module that holds only types, zod schemas, settings predicates or error-code constants, opens no connection, and still has an importer in a hot file after the unit lands is KEPT, not deleted. Each task ends with an `rg -l` step that proves which kept modules still have importers. Kept on purpose: `src/shared/artifacts.ts`, `src/shared/artifact-cli-bridge.ts`, `src/shared/artifact-file-read.ts` (SSH relay `orca artifacts` forwarding in `src/relay/remote-artifact-cli-*` and `src/main/ssh/ssh-relay-session.ts`, Spec B), `src/shared/artifact-sharing-gate.ts`, `src/shared/agent-skill-sharing-gate.ts` (both imported by `src/main/runtime/rpc/errors.ts:16-17` and `src/main/runtime/runtime-client-settings.ts:2-3`), `src/shared/agent-skill-sharing-contract.ts` (error codes imported by `rpc/errors.ts:18-24`), `src/shared/skill-cloud-contract.ts` and `src/shared/skill-sharing-contract.ts` (types for the kept local install-management IPC: `previewInstall`, `removeInstall`, `listManagedInstalls`, `listWslDistros`, `previewBundleInstall`), the settings keys `artifactSharingEnabled`, `agentSkillSharingEnabled`, `showArtifactsButton`, `showSkillsButton` in `src/shared/default-global-settings.ts:153-157` and `src/shared/global-settings-types.ts:263-276` (plain booleans, sanitized in `settings-update.ts:77-81`, projected in `runtime-client-settings.ts:136,138`), and the persisted `dismissedUnexpectedSignoutVersion` UI preference (7 files, pure persistence).

**Residual egress handed to Spec B, decided here, not later.** `skills.install` / `skills.installBundle` still accept a `download-grant` ingress (`src/main/skills/skill-install-request-service.ts:46-57`) whose origin allowlist defaults to `https://storage.googleapis.com` at `src/main/runtime/runtime-skill-install-commands.ts:89,171`, `src/main/skills/skill-client-mediated-transfer.ts:19`, `src/main/skills/skill-ssh-package-transfer.ts:33`, `src/relay/skill-install-handler.ts:116,132`. These are the paired-runtime and SSH transfer rails; 12 existing test files feed GCS URLs through them. U8 does NOT blank the allowlist: after U8.3 nothing can mint a grant (the only producer, `SkillCloudService`, is deleted) and after U7 no network client can submit one. The guard unit must allowlist `storage.googleapis.com` until Spec B deletes these rails.

**`npx` display strings stay.** `src/shared/agent-feature-install-commands.ts` builds pasteable `npx skills add https://github.com/stablyai/orca …` strings rendered by ~40 renderer onboarding/settings surfaces and typed into the user's own terminal by `CliSkillSetupTerminal.tsx`. That is user-driven like `shell.openExternal`. U8.1 removes only the two Orca-owned spawn sites. The guard unit must allowlist `ORCA_SKILLS_REPOSITORY_URL` in that file.

**`.github/workflows/skill-update-roundtrip.yml`** exercises the community `skills` CLI against `skills/` in CI, imports no code U8 deletes, and is handed to U12 (cloud/CI) explicitly.

**Catalogs.** Never edit `src/renderer/src/i18n/locales/*.json`: `verify:localization-extraction` reports orphans only (`config/scripts/verify-localization-extraction.mjs:110-118`), and `verify:localization-catalogs` fails only on keys missing from `en.json` or extra relative to `en.json`. `src/renderer/src/i18n/en-runtime-required.json` IS generated from the renderer boot graph, so every task that deletes renderer modules runs `pnpm run sync:localization-runtime-catalog`. `src/shared/rpc-contract/rpc-params-catalog.generated.ts` is regenerated with `pnpm run generate:rpc-params-catalog` when RPC methods go.

**Reliability gates.** `config/reliability-gates.jsonc` has one skills gate, `skill-upload.cross-process-staging-ownership` (line 20039), whose testFiles are the SSH-relay upload tests (`skill-upload-session-service.test.ts`, `skill-upload-process-restart*.test.ts`, `src/relay/skill-upload-multi-relay.integration.test.ts`); none are touched by U5/U8. No gate references profile-cloud, artifact-cloud, skill-cloud, kill-list or marketplace files. No entry changes.

**`config/max-lines-baseline.txt`** lists none of the files touched here (verified with `rg`). **`config/scripts/ci-shard-timings.json`** needs no edit: "Deleted files never enter discovery" (`ci-shard-timings.md:7`).

---

### Task U8.1: Remove `npx skills` registry installs (CLI `skills install`/`update` and the in-app SkillUpdateRunner)
**Files:**
- Delete: `src/main/skills/skill-update-run.ts`, `src/main/skills/skill-update-run.test.ts`, `src/renderer/src/components/skills/skill-update-run-store.ts`, `src/renderer/src/components/skills/SkillFreshnessUpdateDialog.tsx`, `src/renderer/src/components/skills/SkillFreshnessUpdateDialog.test.tsx`, `src/renderer/src/components/skills/skill-freshness-update-dialog.ts`, `src/renderer/src/components/status-bar/SkillUpdateStatusSegment.tsx`, `src/renderer/src/components/status-bar/SkillUpdateStatusSegment.test.tsx`
- Modify: `src/main/ipc/skills.ts:1,9-17,43-65,83-100`, `src/main/ipc/skills.test.ts` (update-run cases only, if any; see step 3), `src/preload/api/skills-bridge.ts:35-39,47-51,125-129`, `src/preload/api/agent-skill-api.ts:29-33,44-47,92`, `src/shared/skill-freshness.ts:207-244`, `src/renderer/src/components/status-bar/StatusBarSurface.tsx:20,276`, `src/renderer/src/components/skills/SkillFreshnessStatusPill.tsx:12,78-100`, `src/renderer/src/components/skills/SkillFreshnessNudge.tsx:9,160-195`, `src/renderer/src/components/skills/SkillFreshnessNudge.test.tsx`, `src/renderer/src/components/skills/SkillFreshnessStatusPill.test.tsx`, `src/cli/handlers/skills.ts:1,3,8-24,62-268,286-287`, `src/cli/skills.test.ts:247-965`, `src/cli/handler-group-manifest.ts:258`, `src/cli/specs/skills.ts:67-126`, `src/cli/root-help-text-primary.ts:29-30`, `src/renderer/src/web/preload-api/web-host-capability-api.ts:161-166,206` (only if `src/renderer/src/web/` still exists, i.e. U7 has not landed)
- Test: `pnpm test src/main/ipc/skills.test.ts src/cli/skills.test.ts src/cli/specs src/renderer/src/components/skills src/renderer/src/components/status-bar src/shared`

**Interfaces:** Consumes: none. Produces: `SkillsApi` (preload) without `startUpdateRun`/`cancelUpdateRun`/`acknowledgeUpdateRun`/`getUpdateRun`/`onUpdateRun`; `SKILL_HANDLERS` without `skills install`/`skills update`. U8.3 edits the same `src/main/ipc/skills.ts` and `skills-bridge.ts` afterwards and assumes these lines are already gone.

- [ ] **Step 1: Delete the main-process runner and its test.**
  ```
  git rm src/main/skills/skill-update-run.ts src/main/skills/skill-update-run.test.ts
  ```
- [ ] **Step 2: Trim `src/main/ipc/skills.ts` to discovery + freshness inventory.** Delete these exact lines: line 1 becomes `import { app } from 'electron'` (drop `BrowserWindow`); lines 9-13 become `import type { SkillFreshnessInventory } from '../../shared/skill-freshness'`; delete lines 15-17 (`SkillUpdateRunner`, `skillUpdateFailedNames`, `readGloballyUpdatableSkillLocks` imports); delete lines 43-65 (`const runner = new SkillUpdateRunner({ … })`); delete lines 83-100 (the four `skills:startUpdateRun` / `skills:cancelUpdateRun` / `skills:acknowledgeUpdateRun` / `skills:getUpdateRun` handlers). Keep `skills:discover` (67-70), the `if (runtime)` block (72-74, edited in U8.3) and `skills:freshnessInventory` (76-81). Then `rg -n "skill-update-outcome|skill-update-registration" src --glob '!**/*.test.*'` — expected: no hits outside `src/main/skills/`; if `skill-update-outcome.ts` / `skill-update-registration.ts` have no remaining importers, `git rm` them with their tests (`skill-update-outcome.test.ts`, `skill-update-registration.test.ts`).
- [ ] **Step 3: Update `src/main/ipc/skills.test.ts`.** `rg -n "startUpdateRun|SkillUpdateRunner|skill-update-run|updateRun" src/main/ipc/skills.test.ts` — delete every `vi.mock('../skills/skill-update-run'…)` block and every `it(` whose body references those names (expected: the mock only; the eight listed `it` cases at 123-249 are discovery/inventory and stay).
- [ ] **Step 4: Preload.** In `src/preload/api/skills-bridge.ts` delete lines 47-51 (`startUpdateRun`…`getUpdateRun`) and 125-129 (`onUpdateRun`), and change lines 35-39 to `import type { SkillFreshnessInventory } from '../../shared/skill-freshness'`. In `src/preload/api/agent-skill-api.ts` delete lines 44-47 and 92, and change lines 29-33 to `import type { SkillFreshnessInventory } from '../../shared/skill-freshness'`.
- [ ] **Step 5: Shared types.** In `src/shared/skill-freshness.ts` delete lines 207-244 (`canonicalizeSkillUpdateNames`, `buildTargetedSkillUpdateCommand`, `SkillUpdateRun`, `SkillUpdateStartResult`). Verify: `rg -n "canonicalizeSkillUpdateNames|buildTargetedSkillUpdateCommand|SkillUpdateRun\b|SkillUpdateStartResult" src config tests` → expected: zero hits.
- [ ] **Step 6: Renderer.**
  ```
  git rm src/renderer/src/components/skills/skill-update-run-store.ts \
    src/renderer/src/components/skills/SkillFreshnessUpdateDialog.tsx \
    src/renderer/src/components/skills/SkillFreshnessUpdateDialog.test.tsx \
    src/renderer/src/components/skills/skill-freshness-update-dialog.ts \
    src/renderer/src/components/status-bar/SkillUpdateStatusSegment.tsx \
    src/renderer/src/components/status-bar/SkillUpdateStatusSegment.test.tsx
  ```
  `StatusBarSurface.tsx`: delete line 20 (`import { SkillUpdateStatusSegment } …`) and line 276 (`<SkillUpdateStatusSegment iconOnly={segmentsIconOnly} />`).
  `SkillFreshnessStatusPill.tsx`: delete line 12 (`import { requestSkillFreshnessUpdateDialog } …`) and the whole `<Button … onClick={() => requestSkillFreshnessUpdateDialog()}>…</Button>` element that spans the lines around 78-100 (the "Details" control; it opened the deleted dialog). Remove the now-unused `Button`, `ChevronRight` imports if oxlint flags them.
  `SkillFreshnessNudge.tsx`: delete line 9 and the `action: { label: …, onClick: () => { … requestSkillFreshnessUpdateDialog() } }` object passed to the toast (lines ~160-192; the toast keeps its message with no action).
  Tests: in `SkillFreshnessNudge.test.tsx` and `SkillFreshnessStatusPill.test.tsx`, `rg -n "requestSkillFreshnessUpdateDialog|skill-freshness-update-dialog|Details" <file>` and delete the mocks and `it` cases that assert the dialog request.
  If `src/renderer/src/web/preload-api/web-host-capability-api.ts` still exists: delete lines 161-166 and 206.
- [ ] **Step 7: CLI.** In `src/cli/handlers/skills.ts` delete: line 1 (`import { spawn } …`), line 3 (`RuntimeClientError`) and lines 8-24 (all imports from `node-cli-command-resolution`, `local-agent-install-dir-detection`, `tui-agent-detection-commands`, `windows-batch-spawn`, `skills-cli-agent-keys`, `agent-feature-install-commands`), lines 26-60 (`resolveSelectedSkillNames`, used only by the mutation handler), lines 62-268 (`runNpxSkills`, `detectSkillsCliAgentKeys`, `resolveInstallAgentKeys`, `buildNpxSkillsArgs`, `formatNpxCommand`, `formatSkillSelectionHelp`, `createSkillMutationHandler`), and lines 286-287 (`'skills install': …`, `'skills update': …`). Resulting file:
  ```ts
  import type { CommandHandler } from '../dispatch'
  import { writeStdoutLine } from '../stdout-line'
  import { loadCanonicalGuides } from './bundled-skill-guide-table'
  import { SKILL_GUIDE_GET_HANDLER } from './skill-guide-get'

  export const SKILL_HANDLERS: Record<string, CommandHandler> = {
    'skills list': async ({ json }) => {
      // Why: generated registry order is not a user-facing contract, while stable
      // canonical sorting keeps agent-visible output reproducible across builds.
      const topics = (await loadCanonicalGuides()).map((guide) => ({
        name: guide.name,
        description: guide.description.replace(/\s+/g, ' ').trim()
      }))
      writeStdoutLine(
        json
          ? JSON.stringify({ topics }, null, 2)
          : topics.map((topic) => `${topic.name}: ${topic.description}`).join('\n')
      )
    },
    ...SKILL_GUIDE_GET_HANDLER
  }
  ```
  `src/cli/handler-group-manifest.ts:258`: `keys: ['skills list', 'skills get'],`. `src/cli/specs/skills.ts`: delete the two spec objects `{ path: ['skills', 'install'], … }` (lines 67-100) and `{ path: ['skills', 'update'], … }` (lines 101-126). `src/cli/root-help-text-primary.ts`: delete lines 29-30. `src/cli/skills.test.ts`: delete every `it(` from line 247 (`lists installable skills when no --skill/--all is given`) through the end of the file's install/update cases (last one at 965, `rejects --json for a real (non-dry-run) update`), plus any `vi.mock` of `node:child_process`/`node-cli-command-resolution` that becomes unused; keep 112-235 (list/get/help).
- [ ] **Step 8: Verify.** `pnpm tc` → passes. `pnpm test src/main/ipc/skills.test.ts src/cli/skills.test.ts src/cli/specs src/cli/index.test.ts src/renderer/src/components/skills src/renderer/src/components/status-bar src/shared/skill-freshness.test.ts` → all green. `pnpm run sync:localization-runtime-catalog` then `pnpm run verify:localization-runtime-catalog` → clean. `pnpm run check:code-quality:changed` → clean.
- [ ] **Step 9: Commit.**
  ```
  git add -A && git commit -m "refactor(local-only): remove npx skills registry installs

  Delete the in-app SkillUpdateRunner, its IPC/preload/status-bar surface, and the
  orca skills install/update CLI subcommands. The freshness inventory stays; the
  pasteable npx command strings stay (user-run).

  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01PskLbdTqJNXxJ7KRnDoDoD"
  ```

---

### Task U8.2: Remove the plugin marketplace official seed and the kill-list fetch
**Files:**
- Delete: `tests/e2e/plugin-marketplace-content.spec.ts`
- Modify: `src/main/plugins/plugin-kill-list-service.ts:10-11,13,17-18,21-25,30,33,51-54,68-148`, `src/main/plugins/plugin-kill-list-service.test.ts`, `src/main/plugins/plugin-marketplace-service.ts:3,44-45,59,109-113,118-132,148,154,212-234`, `src/main/plugins/plugin-marketplace-service.test.ts:9,215-324`, `src/shared/plugins/plugin-marketplace.ts:117-121`, `src/main/startup/main-process-plugins.ts:41-50,92-98,102,104-110,132-138,153`
- Test: `pnpm test src/main/plugins src/shared/plugins src/main/ipc/plugin-marketplaces.test.ts src/main/ipc/plugins.test.ts`

**Interfaces:** Consumes: none. Produces: `PluginKillListService` with `initialize`/`find`/`reason`/`snapshot` only (local cache read; never refreshed); `PluginMarketplaceService` without `seedOfficialSource`. `main-process-state.ts:23,107` unchanged.

- [ ] **Step 1: Kill-list service becomes a local cache reader.** In `src/main/plugins/plugin-kill-list-service.ts` delete lines 10-11 (`PLUGIN_KILL_LIST_URL`, `PLUGIN_KILL_LIST_DOWNLOAD_LIMIT`), 13 (`type PluginKillListFetcher`), 17 (`private readonly fetcher`), 18 (`listeners`), 21-25 (`refreshChain`), 30 (`fetcher?:` option) and 33 (`this.fetcher = …`), 51-54 (`onChanged`), 68-94 (`refresh`, `performRefresh`), 97-148 (`fetchPluginKillList`, `emptyKillList`). Resulting class body: constructor (store only), `initialize`, `find`, `reason`, `snapshot`. In the test file delete line 6's `fetchPluginKillList` import and every `it` that calls `refresh(` or `fetchPluginKillList(` (lines 47-141 and the whole `describe('fetchPluginKillList')` at 142-end); keep `loads cached revocations before any network refresh` (31-46). Keep `plugin-kill-list-content-revocation.test.ts` (seeds the local store).
- [ ] **Step 2: Startup wiring.** In `src/main/startup/main-process-plugins.ts` delete lines 41-50 (`requestOfficialMarketplaceSeed`), 92-98 (`state.pluginKillListService.onChanged(…)`), 102 (`requestOfficialMarketplaceSeed()`), 104-110 (`if (app.isPackaged && updates.pluginSystemEnabled === true) { … refresh() … }`), 132-138 (startup `refresh()`), 153 (`requestOfficialMarketplaceSeed()`). Lines 33-36, 39, 55, 67, 79 (local kill-list store wiring) stay.
- [ ] **Step 3: Marketplace service.** In `src/main/plugins/plugin-marketplace-service.ts` delete line 3 (`OFFICIAL_MARKETPLACE_GIT_SOURCE,`), 44-45 (`officialSeedPromise`, `officialSeedRequested`), 109-113 (`if (this.officialSeedRequested) { … seedOfficialSource() … }` inside `removeSource`), 118-132 (`seedOfficialSource`), 212-230 (`performOfficialSeed`), 232-234 (`waitForOfficialSeed`), and the three `await this.waitForOfficialSeed()` lines at 59, 148, 154. Lines 103-105 (refusing to remove an official source) and every `isOfficialMarketplaceGitSource` badge check stay. In `src/shared/plugins/plugin-marketplace.ts` delete lines 117-121 (`OFFICIAL_MARKETPLACE_GIT_SOURCE`). In `plugin-marketplace-service.test.ts` delete line 9 and the four `it` cases at 215-324 (`seeds the official marketplace once…`, `persists an offline official source…`, `keeps reads usable and allows retry after official seeding rejects`, `recovers the managed source after a full existing store frees a slot`).
- [ ] **Step 4: e2e.** `git rm tests/e2e/plugin-marketplace-content.spec.ts` (its invariant is "a fresh profile discovers the managed official marketplace").
- [ ] **Step 5: Verify.** `rg -n "seedOfficialSource|OFFICIAL_MARKETPLACE_GIT_SOURCE|fetchPluginKillList|kill-list.json|onorca.dev/plugins" src tests config` → zero hits. `pnpm tc`; `pnpm test src/main/plugins src/shared/plugins src/main/ipc/plugin-marketplaces.test.ts src/main/ipc/plugins.test.ts src/main/startup` → green. `pnpm run check:code-quality:changed` → clean.
- [ ] **Step 6: Commit.**
  ```
  git commit -am "refactor(local-only): drop plugin kill-list fetch and official marketplace seed

  The kill list is now a read-only local cache and no marketplace source is added
  without the user. User-added git marketplaces and bundled plugins are unchanged.

  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01PskLbdTqJNXxJ7KRnDoDoD"
  ```

---

### Task U8.3: Remove skill cloud sharing, share-link install, deep links and the `orca://` protocol
**Files:**
- Delete (main): `src/main/skills/skill-cloud-service.ts`, `skill-cloud-service.test.ts`, `skill-cloud-request.ts`, `skill-cloud-request.test.ts`, `skill-cloud-auth.ts`, `skill-cloud-deadline.ts`, `skill-cloud-direct-upload.ts`, `skill-cloud-direct-upload.test.ts`, `skill-cloud-grant-installation.ts`, `skill-cloud-grant-installation.test.ts`, `skill-cloud-grant-version.ts`, `skill-cloud-install-target.ts`, `skill-cloud-install-target.test.ts`, `skill-share-preparation-service.ts`, `skill-share-preparation-service.test.ts`, `skill-remote-install-cancellation.ts`, `skill-remote-install-cancellation.test.ts`, `agent-skill-selection.ts`, `agent-skill-selection.test.ts` (all under `src/main/skills/`); `src/main/ipc/skill-cloud-ipc-handlers.ts`, `skill-cloud-ipc-handlers.test.ts`, `skill-cloud-install-ipc-schemas.ts`, `skill-cloud-install-ipc-schemas.test.ts`, `skill-share-publishing-ipc-schemas.ts`, `skill-install-progress-ipc.ts`, `skill-install-progress-ipc.test.ts`; `src/main/runtime/orca-runtime-agent-skill-share.test.ts`; `src/main/startup/skill-share-deep-link-state.ts`, `skill-share-deep-link-state.test.ts`; `src/shared/skill-share-link.ts`
- Delete (CLI/e2e): `tests/e2e/staging-skill-sharing.spec.ts`, `tests/e2e/paired-skill-installation.spec.ts`, `tests/e2e/ssh-skill-installation.spec.ts`, `tests/e2e/helpers/remote-skill-cloud-fixture.ts`, `tests/e2e/helpers/remote-skill-cloud-fixture.unit.test.ts`
- Delete (renderer, `src/renderer/src/components/skills/`): `SkillShareDialog.tsx`, `SkillShareDialog.test.tsx`, `SkillSharePackageSummary.tsx`, `SkillShareReleaseNotesField.tsx`, `SkillShareReviewContent.tsx`, `SkillSharedLinkRow.tsx`, `SkillSharedLinkRow.test.tsx`, `SkillSharedLinksView.tsx`, `use-owned-skill-shares.ts`, `skill-share-package-selection.ts`, `skill-share-package-selection.test.ts`, `skill-share-preview-summary.ts`, `skill-share-preview-summary.test.ts`, `skill-share-version-summary.ts`, `skill-share-link.ts`, `skill-share-link.test.ts`, `skill-bundle-name.ts`, `skill-bundle-name.test.ts`, `skill-package-digest.ts`, `skill-package-digest.test.ts`, `SkillInstallDialog.tsx`, `SkillInstallDialog.test.tsx`, `SkillInstallDialogFooter.tsx`, `SkillInstallReviewContent.tsx`, `SkillInstallRiskNotice.tsx`, `SkillInstallTargetFields.tsx`, `SkillInstallTargetFields.test.tsx`, `SkillInstallAgentPicker.tsx`, `SkillInstallAgentPicker.test.tsx`, `SkillInstallWorkspaceCombobox.tsx`, `SkillInstallWorkspaceCombobox.test.tsx`, `SkillInstallMachineSelect.tsx`, `SkillInstallManagementDialog.tsx`, `SkillInstallManagementDialog.test.tsx`, `SkillInstallManagementDialogContent.tsx`, `SkillInstallManagementStatus.tsx`, `SkillManagedInstallRow.tsx`, `SkillPackageChecklist.tsx`, `SkillBundleInstallFlow.tsx`, `SkillBundleInstallOutcome.tsx`, `SkillBundleInstallReview.tsx`, `SkillWarningPreviewLauncher.tsx`, `skill-warning-preview-gate.ts`, `skill-warning-preview-version.ts`, `skill-install-progress-state.ts`, `skill-install-progress-state.test.tsx`, `skill-install-provider-groups.ts`, `skill-install-provider-groups.test.ts`, `skill-install-workspace-choices.ts`, `skill-install-workspace-choices.test.ts`, `skill-install-result-label.ts`, `skill-install-management-copy.ts`, `skill-managed-install-groups.ts`, `skill-managed-install-labels.ts`, `skill-managed-version-selection.ts`, `skill-managed-removal-summary.ts`, `skill-package-checklist-items.ts`, `skill-package-checklist-items.test.ts`, `skill-package-install-risk.ts`, `skill-package-install-risk.test.ts`, `skill-bundle-retry-selection.ts`, `skill-bundle-retry-selection.test.ts`, `use-skill-install-detected-agents.ts`, `use-skill-install-risk.ts`, `skills-page-view.ts`
- Modify: `config/electron-builder.config.cjs:185`; `src/main/index.ts:2,41-43,97-103,117`; `src/main/startup/main-process-state.ts:39,116`; `src/main/startup/main-process-ipc-bootstrap.ts:46`; `src/main/ipc/skills.ts:23,72-74`; `src/main/startup/main-process-runtime-service.ts:29,191`; `src/main/runtime/runtime-skill-command-surface.ts` (whole file shrinks), `src/main/runtime/runtime-skill-command-contract.ts:1-5,21-29,39-86`, `src/main/runtime/runtime-skill-types.ts:1-10`; `src/main/runtime/rpc/methods/skills.ts:31-35,102-126`, `src/main/runtime/rpc/methods/skills.test.ts:252-341`; `src/cli/handlers/skill-sharing.ts:1-11,22,28-36,43-80,105-142,155-end`, `src/cli/handlers/skill-sharing.test.ts:62-250`, `src/cli/handler-group-manifest.ts:253`, `src/cli/specs/skills.ts:16-34`, `src/cli/specs/skills.test.ts:35-45`, `src/cli/root-help-text-primary.ts:26`; `src/preload/api/skills-bridge.ts:8-34,52-80,96-110,113-124`, `src/preload/api/agent-skill-api.ts:2-28,48-68,80-91`, `src/preload/api/ui-bridge-state-and-menu-commands.ts:24-30`, `src/preload/api/ui-command-event-api.ts:57-58`; `src/renderer/src/main.tsx` (SkillWarningPreviewLauncher), `src/renderer/src/hooks/ipc-events/settings-sidebar-ipc-bridge.ts:25-30,42-51`, `src/renderer/src/store/slices/ui/ui-slice-contract-core.ts:186-192`, `ui-slice-view-actions.ts:62-81`, `ui-slice-task-actions.ts:24-25`, `src/renderer/src/store/slices/ui-page-navigation.test.ts:722-723`; `src/renderer/src/components/skills/SkillsPage.tsx`, `SkillsPage.test.tsx`, `SkillsPageHeader.tsx`, `SkillsFilterToolbar.tsx`, `SkillsList.tsx`, `SkillRow.tsx`, `SkillDetailDialog.tsx`, `skills-page-states.tsx`, `use-skills-page-keyboard-navigation.ts`, `skill-share-selection.ts`, `skill-share-selection.test.ts`, `skill-display-labels.ts:37-41,53-57`; `src/renderer/src/components/settings/ShareSkillsSettingsPane.tsx`, `ShareSkillsSettingsPane.test.tsx`, `share-skills-settings-search.ts`; `src/renderer/src/web/preload-api/web-host-capability-api.ts:167-183,192-205` (only if `src/renderer/src/web/` exists); `src/shared/rpc-contract/rpc-params-catalog.generated.ts` (regenerated)
- Keep on purpose (local or Spec B): `src/main/ipc/skill-install-management-ipc-handlers.ts`, `src/main/skills/skill-runtime-capability.ts`, `skill-package-download*.ts`, `skill-remote-install-service.ts`, `skill-client-mediated-transfer*.ts`, `skill-ssh-package-transfer.ts`, `skill-upload-*`, `skill-bundle-*`, `skill-install-*`, `src/relay/skill-install-handler.ts`, `src/shared/skill-cloud-contract.ts`, `src/shared/skill-sharing-contract.ts`, `src/shared/agent-skill-sharing-contract.ts`, `src/shared/agent-skill-sharing-gate.ts`.
- Test: `pnpm test src/main/skills src/main/ipc src/main/runtime/rpc/methods/skills.test.ts src/main/runtime src/cli src/preload src/renderer/src/components/skills src/renderer/src/components/settings src/renderer/src/store src/shared`

**Interfaces:** Consumes: U8.1 edits to `src/main/ipc/skills.ts` and the preload bridge. Produces: `OrcaRuntimeService` without `setSkillCloudService`/`publishDiscoveredSkillsFromAgent`/`publishSkillPackage*`/`createSkillPackageShare`/`resolveSkillShare`/`createSkill*DownloadGrant`/`getSkillPackage`/`listOwnedSkillShares`/`revokeSkillShare`/`deleteSkillPackage*`; no `skills.share` RPC; no `ui:openSkillShare` / `ui:consumePendingSkillShare` IPC; no `orca://` scheme. U8.4 depends on this task (skill-cloud files import `artifact-cloud-config`). U5 depends on this task (`skill-cloud-auth.ts` imports `profile-cloud-*`).

- [ ] **Step 1: Packaging and deep-link ingress.** `config/electron-builder.config.cjs`: delete line 185 `protocols: [{ name: 'Orca', schemes: ['orca'] }],`. Verify no other registration: `rg -n "x-scheme-handler|CFBundleURLSchemes|orca://" config resources --glob '!**/*.test.*'` → zero hits in packaging config (hits in `config/scripts/locale-*.mjs` are translation phrase tables; leave them). `src/main/index.ts`: delete line 2, lines 41-43 (`state.skillShareDeepLinks.capture(argv, (shareId) => { … })`), lines 97-103 (`app.on('open-url', …)`), line 117 (`state.skillShareDeepLinks.capture(process.argv)`). `src/main/startup/main-process-state.ts`: delete lines 39 and 116. `src/main/startup/main-process-ipc-bootstrap.ts`: delete line 46. `git rm src/main/startup/skill-share-deep-link-state.ts src/main/startup/skill-share-deep-link-state.test.ts src/shared/skill-share-link.ts`. Preload: delete `ui-bridge-state-and-menu-commands.ts:24-30` (`onOpenSkillShare`, `consumePendingSkillShare`) and `ui-command-event-api.ts:57-58`. Renderer: `settings-sidebar-ipc-bridge.ts` delete lines 25-30 and 42-51; `ui-slice-contract-core.ts` delete 186-192; `ui-slice-view-actions.ts` delete 62-81 (`openSkillShare` … `clearPendingSkillsSharedView`); `ui-slice-task-actions.ts` delete 24-25; `ui-page-navigation.test.ts` delete lines 722-723 and any `expect` in that `it` (706-728) that reads `pendingSkillShareId`/`pendingSkillsSharedView`. `src/renderer/src/main.tsx`: `rg -n "SkillWarningPreviewLauncher" src/renderer/src/main.tsx` and delete the import line and the `<SkillWarningPreviewLauncher />` element.
- [ ] **Step 2: Main-process cloud service, IPC and runtime surface.**
  ```
  git rm src/main/skills/skill-cloud-service.ts src/main/skills/skill-cloud-service.test.ts \
    src/main/skills/skill-cloud-request.ts src/main/skills/skill-cloud-request.test.ts \
    src/main/skills/skill-cloud-auth.ts src/main/skills/skill-cloud-deadline.ts \
    src/main/skills/skill-cloud-direct-upload.ts src/main/skills/skill-cloud-direct-upload.test.ts \
    src/main/skills/skill-cloud-grant-installation.ts src/main/skills/skill-cloud-grant-installation.test.ts \
    src/main/skills/skill-cloud-grant-version.ts src/main/skills/skill-cloud-install-target.ts \
    src/main/skills/skill-cloud-install-target.test.ts src/main/skills/skill-share-preparation-service.ts \
    src/main/skills/skill-share-preparation-service.test.ts src/main/skills/skill-remote-install-cancellation.ts \
    src/main/skills/skill-remote-install-cancellation.test.ts src/main/skills/agent-skill-selection.ts \
    src/main/skills/agent-skill-selection.test.ts src/main/ipc/skill-cloud-ipc-handlers.ts \
    src/main/ipc/skill-cloud-ipc-handlers.test.ts src/main/ipc/skill-cloud-install-ipc-schemas.ts \
    src/main/ipc/skill-cloud-install-ipc-schemas.test.ts src/main/ipc/skill-share-publishing-ipc-schemas.ts \
    src/main/ipc/skill-install-progress-ipc.ts src/main/ipc/skill-install-progress-ipc.test.ts \
    src/main/runtime/orca-runtime-agent-skill-share.test.ts
  ```
  `src/main/ipc/skills.ts`: replace line 23 with `import { registerSkillInstallManagementIpcHandlers } from './skill-install-management-ipc-handlers'` and lines 72-74 with:
  ```ts
    if (runtime) {
      registerSkillInstallManagementIpcHandlers(runtime)
    }
  ```
  (this keeps `skills:previewInstall`, `skills:previewBundleInstall`, `skills:removeInstall`, `skills:listManagedInstalls`, `skills:listWslDistros`, which `registerSkillCloudIpcHandlers` used to register at its line 296). `src/main/startup/main-process-runtime-service.ts`: delete line 29 (`import { SkillCloudService } …`) and line 191 (`runtime.setSkillCloudService(new SkillCloudService(app.getPath('userData')))`). `src/main/runtime/runtime-skill-types.ts`: delete lines 1-10. `src/main/runtime/runtime-skill-command-contract.ts`: delete lines 1-5 (`agent-skill-sharing-contract` and `DiscoveredSkill` imports), 21-29 (the `SkillCloud*`/`SkillCloudService` names inside the `runtime-skill-types` import; keep `ManagedSkillInstall` … `SkillRemoveRequest`), and 39-86 (`setSkillCloudService` through `deleteSkillPackage`). `src/main/runtime/runtime-skill-command-surface.ts` becomes exactly:
  ```ts
  import { RuntimeSkillInstallQueries } from './runtime-skill-install-queries'
  import type {
    RuntimeSkillCommandSurface,
    RuntimeSkillCommandHost
  } from './runtime-skill-command-contract'
  export type {
    RuntimeSkillCommandSurface,
    RuntimeSkillCommandHost
  } from './runtime-skill-command-contract'
  export { installRuntimeSkillCommandSurface } from './runtime-skill-command-contract'

  export class RuntimeSkillCommands
    extends RuntimeSkillInstallQueries
    implements RuntimeSkillCommandSurface
  {
    constructor(host: RuntimeSkillCommandHost) {
      super(host)
    }
  }
  ```
  `src/main/runtime/rpc/methods/skills.ts`: delete lines 31-35 (`agent-skill-sharing-contract` import) and 102-126 (`defineMethod({ name: 'skills.share', … })`). `rpc/methods/skills.test.ts`: delete `describe('skills.share RPC', …)` (lines 252-341) and any `AgentSkillShare` import it leaves unused. Run `pnpm run generate:rpc-params-catalog` (removes `'skills.share'` and the `AgentSkillShareRequestSchema` import from the generated file).
- [ ] **Step 3: CLI.** In `src/cli/handlers/skill-sharing.ts` delete: the imports at lines 1-11 (`agent-skill-sharing-contract`, `agent-skill-sharing-gate`, `skill-bundle-name`, `skill-cloud-contract`), line 22 (`SHARE_TIMEOUT_MS`), lines 28-36 (`SharedSkillSummary`), 38-41 (`stringFlag`), 53-80 (`preflightPublishCapability`, `requireCloudOperation`), 105-142 (`sharedSummary`, `formatSharedSkill`, `callShare`), and the `'skills share': async (ctx) => { … }` member (line 155 to the closing `}` of that member before the final `}`); keep `'skills installed'` (local discovery listing). Remove `getRepeatedStringFlag`, `RuntimeRpcFailureError`, `RuntimeRpcSuccess` imports if unused. `skill-sharing.test.ts`: delete the five `it` cases from line 62 to the end (`denies publishing at preflight…`, `publishes multiple explicit skills…`, `normalizes a human-readable bundle name…`, `rejects a bundle name…`, `gives an actionable upgrade error…`); keep `lists safe installed-skill selectors…`. `handler-group-manifest.ts:253`: `keys: ['skills installed'],`. `src/cli/specs/skills.ts`: delete the `{ path: ['skills', 'share'], … }` object (lines 16-34) and the two sentences at lines 12-13 that mention `orca skills share`. `src/cli/specs/skills.test.ts`: delete the `it('requires explicit selectors for sharing…')` at 35-45. `src/cli/root-help-text-primary.ts`: delete line 26.
- [ ] **Step 4: Preload.** `skills-bridge.ts`: delete lines 8-12 (`skill-cloud-contract` import), prune the `skill-sharing-contract` import (13-34) to `SkillBundleInstallPreviewInput, SkillBundleInstallPreviewOperation, SkillInstallPreviewInput, SkillInstallPreviewOperation, ManagedSkillInstallListOperation, SkillRemoveInput, SkillRemoveOperation`, delete members 52-80 (`prepareShare` … `cancelInstall`), 96-110 (`getPackage` … `deletePackage`; keep `listManagedInstalls` at 96-97), 113-124 (`onInstallProgress`, `onShareProgress`). `agent-skill-api.ts`: delete lines 2-6, prune 7-28 to the same seven names, delete members 48-68 (`prepareShare` … `cancelInstall`) and 81-91 (`getPackage` … `onShareProgress`; keep `listManagedInstalls` and `listWslDistros`). If `src/renderer/src/web/preload-api/web-host-capability-api.ts` exists: delete lines 167-179, 194-202, 204-205.
- [ ] **Step 5: Renderer Skills page (delete-only selection, no share/install-from-link/managed-installs).** `git rm` every renderer file in the Delete list above. Then:
  - `skill-share-selection.ts`: delete lines 1-94; the file keeps only `updatedSkillSelection` (96-109, no imports). `skill-share-selection.test.ts`: delete every `it` except those for `updatedSkillSelection`; drop unused imports.
  - `skill-display-labels.ts`: delete lines 37-41 (`shareLinkCountLabel`) and 53-57 (`shareSelectionActionLabel`).
  - `use-skills-page-keyboard-navigation.ts`: delete lines 2, 8, 10, 16, 18, 42-45; line 9 becomes `selectionMode: 'delete' | null`; dependency array becomes `[closeSkillsPage, exitSelection, selectionMode]`.
  - `skills-page-states.tsx`: line 1 becomes `import { BookOpen, RefreshCw } from 'lucide-react'`; in `SkillsEmptyState` delete lines 53, 56, 73-76; delete `SkillsRemoteShareNotice` (lines 120-131).
  - `SkillDetailDialog.tsx`: drop `Share2` from line 1; delete lines 57, 61, 66, 72, 182-185.
  - `SkillRow.tsx`: drop `Share2` from line 2; delete lines 54, 63, 76, 109-115.
  - `SkillsList.tsx`: delete lines 6-10 (`skill-share-selection` import), 28 (`local,`), 36 (`onShare,`), 41 (`local: boolean`), 52 (`onShare: …`), 61 (`selectedNames`), 110 (`shareable=…`), 118-123 (`onShare={…}`), 139-141, 143; line 150 becomes `selectable={deleteEligible}`, delete 151, lines 154-158 become `disabledLabel={translate('auto.components.skills.SkillRow.notDeletable', 'Not deletable')}`, lines 159-168 become `disabledReason={skillDeleteEligibilityReason(skill)}`, delete 173.
  - `SkillsFilterToolbar.tsx`: line 16 becomes `import { resultCountLabel, sourceKindLabel } from './skill-display-labels'`; delete 19, 25, 31, 33, 37, 43, 45, 49; lines 61-70 become `placeholder={translate('auto.components.skills.SkillsPage.a68dee6a32', 'Search skills')}` and `aria-label={translate('auto.components.skills.SkillsPage.a68dee6a32', 'Search skills')}`; unwrap every `{sharedView ? null : (…)}` (lines 74, 138 and their closers) keeping the children; delete the `<ToggleGroup …>…</ToggleGroup>` at 120-137, its comment, the divider `<div className="h-4 w-px shrink-0 bg-border" aria-hidden />` at 140, and the status span at 200-208; remove the unused `ToggleGroup`/`ToggleGroupItem` imports.
  - `SkillsPageHeader.tsx`: line 1 becomes `import { BookOpen, MoreHorizontal, Trash2, X } from 'lucide-react'`; delete props 23, 27-29, 36, 43-45; delete the two buttons at 91-101 and the two `DropdownMenuItem`s at 117-124.
  - `SkillsPage.tsx`: line 2 → `import { Trash2 } from 'lucide-react'`; delete 13-15, 23, 31-33, 40-45 → `import { updatedSkillSelection } from './skill-share-selection'`, 52; delete 71-74, 83, 86-88, 90-91; line 84 → `const [selectionMode, setSelectionMode] = useState<'delete' | null>(null)`; delete line 120 and make lines 123-127 `setSelectedSkillIds((current) => retainedDeletableSkillSelection(current, nextResult.skills))`; delete 159-174, 190-200; lines 202-208 → `useSkillsPageKeyboardNavigation({ closeSkillsPage, exitSelection, selectionMode })`; delete 211; lines 220-231 →
    ```ts
      const eligibleCount = eligibleDeleteSkillCount(visibleSkills)
      const addSelected = (
        current: ReadonlySet<string>,
        results: readonly DiscoveredSkill[]
      ): Set<string> => addDeletableSkillResults(current, skills, results)
    ```
    delete 232-235; lines 239-280 →
    ```tsx
      {selectionMode ? (
        <SkillsSelectionHeader
          title={translate(
            'auto.components.skills.SkillsSelectionHeader.deleteTitle',
            'Select skills to delete'
          )}
          icon={<Trash2 className="size-4 shrink-0 text-muted-foreground" />}
          actionIcon={<Trash2 className="size-3.5" />}
          actionLabel={skillDeleteActionLabel(selectedSkillIds.size)}
          destructive
          busy={deleteFlow.running}
          selectedCount={selectedSkillIds.size}
          eligibleCount={eligibleCount}
          onSelectAll={() => setSelectedSkillIds((current) => addSelected(current, visibleSkills))}
          onClear={() => setSelectedSkillIds(new Set())}
          onCancel={exitSelection}
          onSubmit={() => {
            void deleteFlow.requestDelete(skills.filter((skill) => selectedSkillIds.has(skill.id)))
          }}
        />
    ```
    in the `<SkillsPageHeader …>` delete lines 288-291, 298-300; in `<SkillsFilterToolbar …>` delete 304, 310, 312, line 311 → `loading={loading}`, lines 314-321 → `onRefresh={() => { deleteFlow.reprobe(); void loadSkills() }}`; lines 339-384 → the `<>…</>` children only (drop the `view === 'shared'` branch, the fragment, line 343, the `local={local}` and `onShare={…}` props, make `onSelectedChange` pass `MAX_SKILL_DELETE_BATCH` unconditionally, and drop `onInstallFromLink` from `<SkillsEmptyState>`); delete 388-409.
  - `SkillsPage.test.tsx`: delete every `it` whose body contains `buttonNamed('Share skills')` (312-336, 338-366, 367-394, 395-415, 461-481) and `explains remote-only skills once instead of on every row` (437-460).
- [ ] **Step 6: Share Skills settings pane keeps only the Skills-button switch** (it is the only place that re-enables the sidebar Skills button; `SidebarNav.tsx:83` only hides it). `ShareSkillsSettingsPane.tsx` becomes exactly:
  ```tsx
  import { translate } from '@/i18n/i18n'
  import { isWebClientLocation } from '@/lib/web-client-location'
  import { useAppStore } from '@/store'
  import { SettingsSwitchRow } from './SettingsFormControls'

  export function ShareSkillsSettingsPane(): React.JSX.Element {
    const settings = useAppStore((state) => state.settings)
    const updateSettings = useAppStore((state) => state.updateSettings)
    const isWebClient = isWebClientLocation()

    return (
      <div className="divide-y divide-border">
        {!isWebClient ? (
          <SettingsSwitchRow
            label={translate('auto.components.settings.shareSkills.showButton', 'Show Skills Button')}
            description={translate(
              'auto.components.settings.shareSkills.showButtonDescription',
              'Show the Skills shortcut in the sidebar.'
            )}
            checked={settings?.showSkillsButton === true}
            onChange={() => void updateSettings({ showSkillsButton: !settings?.showSkillsButton })}
          />
        ) : null}
      </div>
    )
  }
  ```
  `ShareSkillsSettingsPane.test.tsx`: delete the `it` cases at 69-119 (`explains unlisted multi-skill links…`, `offers owner sign-in…`, `requires an explicit desktop grant…`); keep `does not offer desktop publishing from the web client` only if it asserts the switch is absent on web, otherwise delete it too. `share-skills-settings-search.ts`: replace the single entry's `title` with `translate('auto.components.settings.shareSkills.showButton', 'Show Skills Button')`, `description` with `translate('auto.components.settings.shareSkills.showButtonDescription', 'Show the Skills shortcut in the sidebar.')`, and keep only the `keywordSkills` keyword. The `share-skills` nav id, section renderer and page-renderer line stay.
- [ ] **Step 7: e2e.** `git rm tests/e2e/staging-skill-sharing.spec.ts tests/e2e/paired-skill-installation.spec.ts tests/e2e/ssh-skill-installation.spec.ts tests/e2e/helpers/remote-skill-cloud-fixture.ts tests/e2e/helpers/remote-skill-cloud-fixture.unit.test.ts` (all install through `window.api.skills.installPackageVersion` / `orcaProfiles.connectCurrent`).
- [ ] **Step 8: Verify.** `rg -n "share.onorca.dev|app.orca.dev|skills/share|skillShareDeepLinks|parseSkillShareId|openSkillShare|consumePendingSkillShare|SkillCloudService|skill-cloud-service|skill-share-preparation|prepareShare|publishShare|resolveShare|installShare|listOwnedShares|revokeShare|installPackageVersion|installBundleShare" src tests config --glob '!config/scripts/locale-*.mjs'` → zero hits. `rg -l "skill-sharing-contract'|skill-cloud-contract'|agent-skill-sharing-contract'" src --glob '!**/*.test.*'` → expected exactly: `src/main/ipc/skill-install-management-ipc-handlers.ts`? (no — it imports `skill-install-contract`), `src/main/runtime/rpc/errors.ts`, `src/preload/api/skills-bridge.ts`, `src/preload/api/agent-skill-api.ts`, `src/shared/agent-skill-sharing-contract.ts`, `src/shared/skill-sharing-contract.ts`, `src/shared/rpc-contract/rpc-params-catalog.generated.ts` (only if the regenerated file still imports it; otherwise not) — these justify keeping the three contract files. `pnpm tc`; `pnpm test src/main/skills src/main/ipc src/main/runtime src/cli src/preload src/renderer/src/components/skills src/renderer/src/components/settings src/renderer/src/store src/renderer/src/hooks src/shared` → green. `pnpm run verify:rpc-params-catalog` → clean. `pnpm run sync:localization-runtime-catalog` then `pnpm run verify:localization-runtime-catalog` → clean. `pnpm run check:code-quality:changed` → clean.
- [ ] **Step 9: Commit.**
  ```
  git add -A && git commit -m "refactor(local-only): remove skill cloud sharing and orca:// deep links

  Delete SkillCloudService, share-link install, the agent/CLI skills.share path,
  the orca:// protocol and share deep links. Local skill discovery, delete,
  freshness, bundle install and the SSH/paired transfer rails stay.

  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01PskLbdTqJNXxJ7KRnDoDoD"
  ```

---

### Task U8.4: Remove artifact cloud sharing
**Files:**
- Delete: `src/main/artifacts/artifact-cloud-config.ts`, `artifact-cloud-config.test.ts`, `artifact-cloud-request.ts`, `artifact-cloud-service.ts`, `artifact-cloud-service.test.ts`, `artifact-cloud-service-races.test.ts`, `artifact-cloud-recovery.test.ts`, `artifact-publisher.ts`, `artifact-recovery-directory-fsync.test.ts`; `src/main/runtime/runtime-artifact-controller.ts`; `src/main/runtime/rpc/methods/artifacts.ts`, `artifacts.test.ts`; `src/cli/handlers/artifacts.ts`, `artifacts.test.ts`, `src/cli/artifact-format.ts`, `src/cli/specs/artifacts.ts`; `src/renderer/src/components/artifacts/` (whole directory, 18 files incl. tests); `src/renderer/src/components/settings/ArtifactsSettingsPane.tsx`, `ArtifactsSettingsPane.test.tsx`, `artifacts-settings-search.ts`; `src/renderer/src/components/editor/markdown-artifact-upload.ts`, `markdown-artifact-upload.test.ts`
- KEEP until U5 (imported by `src/main/orca-profiles/profile-artifact-cloud-cleanup.ts`, which U5 deletes with `profile-cloud-index.ts`): `src/main/artifacts/artifact-share-record-store.ts`, `artifact-share-record-store.test.ts`, `artifact-share-record-allocation.test.ts`, `artifact-create-intent-store.ts`, `artifact-create-intent-store.test.ts` (pure local JSON stores, no egress).
- Modify: `src/main/startup/main-process-runtime-service.ts:28,30,186-190`; `src/main/runtime/orca-runtime-has-exact-persisted-terminal-surface-identity.ts:19-29,208-244`; `src/main/runtime/orca-runtime-runtime-id.ts:10,71`; `src/main/runtime/rpc/methods/index.ts:48,59`; `src/main/global-fetch-call-site-audit.test.ts:18`; `src/cli/handler-group-manifest.ts:25-35`; `src/cli/specs/index.ts:19` (+ its use); `src/cli/index.test.ts:269-289`; `src/renderer/src/app-shell/AppWorkspaceShell.tsx:24,73,159-163`; `src/renderer/src/components/sidebar/SidebarNav.tsx:31-35,58,66,70,79-81,122-150`, `SidebarNav.test.tsx:20,92,133,271-300`; `src/renderer/src/components/editor/EditorPanel.tsx:26,326-332,375-377`, `EditorPanelHeader.tsx:20-22,56,91,318-324`, `EditorPanelHeader.test.tsx:45-47,116-140`, `EditorPanelShell.tsx:14,46,87,134`; `src/renderer/src/components/browser-pane/describe-page/browser-artifact-upload.ts:1-10,32-end`, `browser-artifact-upload.test.ts`; `src/renderer/src/components/browser-pane/assemble-chrome/browser-page-toolbar.tsx:2,14,63,103,195-206`, `browser-page-chrome-header.tsx:3,32,57,101`, `browser-page-pane.tsx:18,302-303,373`; `src/renderer/src/hooks/settings-navigation-workflow-sections.ts:1,46-57`, `src/renderer/src/lib/settings-navigation-types.ts:41`, `src/renderer/src/components/settings/settings-setup-workflow-section-renderers.tsx:2,141-159`, `settings-page-renderer.tsx:15,129`, `src/renderer/src/hooks/useSettingsNavigationMetadata.test.ts:97-121`; `src/renderer/src/store/slices/ui/ui-slice-contract-core.ts:117,153,193-194`, `ui-slice-view-actions.ts:82-94`, `ui-slice-task-actions.ts:27`, `src/renderer/src/store/slices/worktree-nav-history.ts:18,22`, `src/renderer/src/lib/right-sidebar-visibility.ts:14`, `src/renderer/src/lib/titlebar-worktree-history-controls.ts:8`, `src/renderer/src/lib/worktree-nav-view-history-replay.ts:6`, `src/renderer/src/store/slices/ui-page-navigation.test.ts:664-741`; `src/shared/rpc-contract/rpc-params-catalog.generated.ts` (regenerated)
- Test: `pnpm test src/main/runtime src/main/global-fetch-call-site-audit.test.ts src/cli src/renderer/src/app-shell src/renderer/src/components/sidebar src/renderer/src/components/editor src/renderer/src/components/browser-pane src/renderer/src/store src/renderer/src/hooks src/renderer/src/components/settings`

**Interfaces:** Consumes: U8.3 (skill-cloud files that imported `artifact-cloud-config` are gone). Produces: `OrcaRuntimeService` without `setArtifactService`/`listArtifacts`/`getPublishedArtifactLink`/`shareArtifact`/`publishArtifact`/`updateArtifact`/`unshareArtifact`/`deleteArtifact`; no `artifacts.*` RPC; no `'artifacts'` UI view; `src/main/artifacts/` holds only the two local stores for U5 to delete.

- [ ] **Step 1: Main.** `git rm` the nine `src/main/artifacts/*` files listed under Delete, `src/main/runtime/runtime-artifact-controller.ts`, `src/main/runtime/rpc/methods/artifacts.ts`, `src/main/runtime/rpc/methods/artifacts.test.ts`. `main-process-runtime-service.ts`: delete lines 28, 30 and 186-190 (`runtime.setArtifactService(new ArtifactCloudService(…))`). `orca-runtime-has-exact-persisted-terminal-surface-identity.ts`: delete line 19 and the `shared/artifacts` type import block at 20-29, and lines 208-244 (`setArtifactService` through `deleteArtifact`). `orca-runtime-runtime-id.ts`: delete lines 10 and 71. `rpc/methods/index.ts`: delete lines 48 and 59. `global-fetch-call-site-audit.test.ts`: delete line 18 (`['main/artifacts/artifact-cloud-request.ts', 1],`). Run `pnpm run generate:rpc-params-catalog` (removes `artifacts.delete` … `artifacts.update`, lines 612-618).
- [ ] **Step 2: CLI.** `git rm src/cli/handlers/artifacts.ts src/cli/handlers/artifacts.test.ts src/cli/artifact-format.ts src/cli/specs/artifacts.ts`. `handler-group-manifest.ts`: delete the object at 25-35 (`name: 'artifacts'` … `ARTIFACT_HANDLERS`). `specs/index.ts`: delete line 19 and the spread/use of `ARTIFACT_COMMAND_SPECS` (`rg -n ARTIFACT_COMMAND_SPECS src/cli/specs/index.ts`). `index.test.ts`: delete `describe('artifact runtime routing', …)` at 269-289.
- [ ] **Step 3: Renderer pages and navigation.** `git rm -r src/renderer/src/components/artifacts src/renderer/src/components/settings/ArtifactsSettingsPane.tsx src/renderer/src/components/settings/ArtifactsSettingsPane.test.tsx src/renderer/src/components/settings/artifacts-settings-search.ts`. `AppWorkspaceShell.tsx`: delete lines 24 and 73; lines 159-163 become `{layout.stackedSidebarOpen && layout.activeView !== 'automations' ? (` (and update the comment on 158 to say automations only). `SidebarNav.tsx`: delete 31-35, 58, 66, 70, 79-81, 122-150; remove the `Files` icon import if unused. `SidebarNav.test.tsx`: delete lines 20, 92, 133 and the three `it` cases at 271-300. Settings navigation: `settings-navigation-workflow-sections.ts` delete line 1 and the `{ id: 'artifacts', … }` object at 46-57; `settings-navigation-types.ts` delete line 41 (`'artifacts',`); `settings-setup-workflow-section-renderers.tsx` delete line 2 and lines 141-159; `settings-page-renderer.tsx` delete lines 15 and 129; `useSettingsNavigationMetadata.test.ts` edit the `it` at 97-121 so it no longer looks up `'artifacts'` and expects `['automations', 'share-skills']`. UI view id: `ui-slice-contract-core.ts` delete 117, 153, 193-194; `ui-slice-view-actions.ts` delete 82-94; `ui-slice-task-actions.ts` delete 27; `worktree-nav-history.ts` line 18 → `'tasks' | 'automations' | 'skills'` and delete line 22; `right-sidebar-visibility.ts` delete line 14; `titlebar-worktree-history-controls.ts` delete line 8; `worktree-nav-view-history-replay.ts` line 6 → `if (entry === 'automations' || entry === 'skills') {`; `ui-page-navigation.test.ts` delete the `it` cases at 664-677, 678-705, 729-741 and the `openArtifactsPage()`/`'artifacts'` lines inside the case at 706-728.
- [ ] **Step 4: Editor and browser publish buttons.** `git rm src/renderer/src/components/editor/markdown-artifact-upload.ts src/renderer/src/components/editor/markdown-artifact-upload.test.ts`. `EditorPanel.tsx`: delete line 26, 326-332 (`createActiveMarkdownArtifactRequest`), 375-377. `EditorPanelHeader.tsx`: delete 20-22, 56, 91, 318-324. `EditorPanelHeader.test.tsx`: delete the `vi.mock('@/components/artifacts/ArtifactPublishButton'…)` at 45-47 and the `it` at 116-140. `EditorPanelShell.tsx`: delete 14, 46, 87, 134. `browser-artifact-upload.ts`: keep only `browserFileUrlToAbsolutePath` (lines 11-31; `browser-page-url-display.ts:8,43` uses it) — delete lines 1-10 and 32-end; `browser-artifact-upload.test.ts`: keep only the `browserFileUrlToAbsolutePath` cases. `browser-page-toolbar.tsx`: delete lines 2, 14, 63, 103, 195-206 (`shareControl={…}`; `BrowserChromeToolbar`'s optional `shareControl` prop stays, now never passed). `browser-page-chrome-header.tsx`: delete 3, 32, 57, 101. `browser-page-pane.tsx`: delete 18, 302-303, 373.
- [ ] **Step 5: Verify.** `rg -n "share.onorca.dev|ORCA_ARTIFACTS_API_URL|ArtifactCloudService|artifact-cloud|ArtifactPublishButton|ArtifactsPage|openArtifactsPage|showArtifactsButton|'artifacts\\.[a-z]+'" src tests config` → expected only: `src/main/orca-profiles/profile-artifact-cloud-cleanup*.ts` (U5), `src/shared/default-global-settings.ts:156`, `src/shared/global-settings-types.ts:274`, `src/main/persistence/applying-settings/settings-update.ts` (kept settings key). `rg -l "shared/artifacts'|artifact-sharing-gate'|artifact-cli-bridge'|artifact-file-read'" src --glob '!**/*.test.*'` → expected: `src/main/runtime/rpc/errors.ts`, `src/main/runtime/runtime-client-settings.ts`, `src/main/ssh/ssh-relay-session.ts`, `src/main/ssh/ssh-remote-cli-host-passthrough.ts`, `src/relay/remote-artifact-cli-input.ts`, `src/relay/remote-artifact-cli-forwarding.ts` (justifies keeping the four shared modules until Spec B). `pnpm tc`; `pnpm test src/main/runtime src/main/global-fetch-call-site-audit.test.ts src/cli src/renderer/src/app-shell src/renderer/src/components/sidebar src/renderer/src/components/editor src/renderer/src/components/browser-pane src/renderer/src/store src/renderer/src/hooks src/renderer/src/components/settings src/main/artifacts src/main/orca-profiles` → green. `pnpm run verify:rpc-params-catalog`, `pnpm run sync:localization-runtime-catalog && pnpm run verify:localization-runtime-catalog`, `pnpm run check:code-quality:changed` → clean.
- [ ] **Step 6: Commit.**
  ```
  git add -A && git commit -m "refactor(local-only): remove artifact cloud sharing

  Delete the share.onorca.dev artifact publisher, its RPC/CLI/renderer surfaces and
  the Artifacts page. The two local share-record stores stay until the profile
  cloud cleanup that reads them goes with U5.

  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01PskLbdTqJNXxJ7KRnDoDoD"
  ```

---

### Task U5.1: Remove Orca Cloud main-process auth, PKCE loopback callback, org members and session store
**Files:**
- Delete (`src/main/orca-profiles/`): `profile-cloud-auth-config.ts`, `profile-cloud-auth-config.test.ts`, `profile-cloud-auth-status.ts`, `profile-cloud-auth-status.test.ts`, `profile-cloud-callback-page.ts`, `profile-cloud-capability-refresh.ts`, `profile-cloud-client.ts`, `profile-cloud-client.test.ts`, `profile-cloud-dev-auth.ts`, `profile-cloud-dev-org-members.ts`, `profile-cloud-dev-service.ts`, `profile-cloud-dev-service.test.ts`, `profile-cloud-index.ts`, `profile-cloud-org-members-client.ts`, `profile-cloud-org-members-client.test.ts`, `profile-cloud-org-members-service.ts`, `profile-cloud-org-members-service.test.ts`, `profile-cloud-org-selection.ts`, `profile-cloud-pkce.ts`, `profile-cloud-pkce.test.ts`, `profile-cloud-refresh-replay-guard.ts`, `profile-cloud-refresh-replay-guard.test.ts`, `profile-cloud-service.ts`, `profile-cloud-service.test.ts`, `profile-cloud-service-auth-retry.test.ts`, `profile-cloud-service-connect-overlap.test.ts`, `profile-cloud-service-refresh.test.ts`, `profile-cloud-service-sign-out-connect-race.test.ts`, `profile-cloud-session-exchange.ts`, `profile-cloud-session-invalidation.ts`, `profile-cloud-session-mutation.ts`, `profile-cloud-session-mutation.test.ts`, `profile-cloud-session-refresh.ts`, `profile-cloud-session-refresh.test.ts`, `profile-cloud-session-store.ts`, `profile-cloud-session-store.test.ts`, `profile-artifact-cloud-cleanup.ts`, `profile-artifact-cloud-cleanup.test.ts`; `src/main/artifacts/` (remaining: `artifact-share-record-store.ts`, `artifact-share-record-store.test.ts`, `artifact-share-record-allocation.test.ts`, `artifact-create-intent-store.ts`, `artifact-create-intent-store.test.ts`); `src/main/ipc/orca-profile-org-members-handlers.ts`, `orca-profile-org-members-handlers.test.ts`, `orca-profile-auth-status-broadcast.ts`, `orca-profile-auth-handlers.test.ts`; `src/shared/cloud-service-url.ts`, `cloud-service-url.test.ts`
- Modify: `src/main/ipc/orca-profiles.ts:7-8,12,17-21,29-32,43-53,58-59,104-126,165-173,193-203,274-336`; `src/main/ipc/register-core-handlers/register-core-handlers.ts:103-104,200-201`; `src/main/global-fetch-call-site-audit.test.ts:23-24`; `src/main/runtime/unreadable-secret-store-preservation.win32.test.ts:233-261`; `src/main/startup/main-process-runtime-launch-activation.test.ts:20-22`
- Precondition (U6 and U8 done): see step 1.
- Test: `pnpm test src/main/orca-profiles src/main/ipc src/main/global-fetch-call-site-audit.test.ts src/main/startup src/main/runtime/unreadable-secret-store-preservation.win32.test.ts src/shared`

**Interfaces:** Consumes: U6 (relay/push deleted: `src/main/runtime/relay/*`, `src/main/runtime/push/push-gateway-origin.ts`, `main-process-push-startup.ts`, the `getOrcaCloudAuthConfig` gate at `main-process-runtime-launch.ts:3,255-283`, `main-window-core-services.ts:96-100`), U8.3 (`skill-cloud-auth.ts` gone), U8.4 (artifact cloud service gone). Produces: `registerOrcaProfileHandlers(store, { onBeforeRelaunch })` with only `orcaProfiles:list|createLocal|switch|transferProject|findProjectProfiles`; no `127.0.0.1` PKCE listener; `src/main/orca-profiles/` holds only `profile-index-store`, `profile-project-*`, `profile-active-transfer`, `profile-session-*`, `profile-storage-paths`, `profile-legacy-state-import`, `profile-persistence-deadline`, `profile-telemetry-consent-seed`, `profile-ui-scope`.

- [ ] **Step 1: Precondition.** `rg -l "profile-cloud-|cloud-service-url|profile-artifact-cloud-cleanup|artifacts/artifact-" src tests config --glob '!config/scripts/ci-shard-timings.json'` → every hit must be a file this task deletes or edits (listed above). If `src/main/runtime/relay/`, `src/main/runtime/push/push-gateway-origin.ts`, `src/main/startup/main-process-push-startup.ts`, or `getOrcaCloudAuthConfig` in `main-process-runtime-launch.ts` still exist, stop: U6 has not landed.
- [ ] **Step 2: Delete the cloud modules.** `git rm` every file in the Delete list (use `git rm src/main/orca-profiles/profile-cloud-*.ts src/main/orca-profiles/profile-artifact-cloud-cleanup*.ts && git rm -r src/main/artifacts && git rm src/main/ipc/orca-profile-org-members-handlers.ts src/main/ipc/orca-profile-org-members-handlers.test.ts src/main/ipc/orca-profile-auth-status-broadcast.ts src/main/ipc/orca-profile-auth-handlers.test.ts src/shared/cloud-service-url.ts src/shared/cloud-service-url.test.ts`).
- [ ] **Step 3: Trim `src/main/ipc/orca-profiles.ts` to local profiles.** Delete type imports at lines 7-8, 12, 17-21 (keep `CreateLocalOrcaProfileArgs/Result`, `FindOrcaProfileProjectsByPathArgs/Result`, `OrcaProfileListResult`, `SwitchOrcaProfileArgs/Result`, `TransferOrcaProfileProjectArgs/Result`); delete lines 29-32, 43-53 (session-mutation, cloud-service, org-members, session-invalidation, broadcast imports); delete lines 58-59 (`onAuthMutation`, `onBeforeSignOut`); delete 104-126 (`orgIdFromUnknown`, `createCloudLinkedProfileArgsFromUnknown`); delete 165-173 (`orcaProfiles:authStatus` + `onOrcaCloudSessionInvalidated(...)`); delete 193-203 (the `activeProfile?.cloud` identity mutation inside `orcaProfiles:switch`, keep line 192's blank or merge); delete 274-336 (`connectCurrent`, `createCloudLinked`, `refreshAuth`, `signOutCurrent`, `selectOrg`, `registerOrcaProfileOrgMemberHandlers()`); the function's last statement is now the `orcaProfiles:findProjectProfiles` handler. `register-core-handlers.ts`: delete lines 103-104 and 200-201 (the call becomes `registerOrcaProfileHandlers(store, { onBeforeRelaunch: lifecycleOptions.onBeforeRelaunch })`; the existing test at `register-core-handlers.test.ts:568` already expects exactly `{ onBeforeRelaunch }`).
- [ ] **Step 4: Ratchets and path-referencing tests.** `global-fetch-call-site-audit.test.ts`: delete lines 23-24 (`['main/orca-profiles/profile-cloud-client.ts', 1],` and `['main/orca-profiles/profile-cloud-org-members-client.ts', 1],`). `unreadable-secret-store-preservation.win32.test.ts`: delete lines 233-261 (the `it('does not delete the account session it could not read')` block whose dynamic import at 246 names `profile-cloud-session-store`). `main-process-runtime-launch-activation.test.ts`: delete lines 20-22 (`vi.mock('../orca-profiles/profile-cloud-auth-config', …)`), then run that file alone to prove the mock was not load-bearing.
- [ ] **Step 5: Verify.** `rg -n "login.onorca.dev|relay.onorca.dev|ORCA_CLOUD_|getOrcaCloudAuthConfig|profile-cloud|OrcaCloudSession|orcaProfiles:(authStatus|connectCurrent|createCloudLinked|refreshAuth|signOutCurrent|selectOrg|org)" src tests config --glob '!config/scripts/ci-shard-timings.json'` → hits only in `src/preload/`, `src/shared/orca-profiles.ts` and `src/renderer/` (handled by U5.2/U5.3). `pnpm tc:node`; `pnpm test src/main/orca-profiles src/main/ipc src/main/global-fetch-call-site-audit.test.ts src/main/startup src/main/runtime/unreadable-secret-store-preservation.win32.test.ts src/shared` → green; `pnpm run check:code-quality:changed` → clean. (Renderer typecheck is red until U5.2/U5.3; that is expected and noted in the commit.)
- [ ] **Step 6: Commit.**
  ```
  git add -A && git commit -m "refactor(local-only): remove Orca Cloud sign-in, PKCE callback and org members (main)

  Delete the login.onorca.dev client, the 127.0.0.1 OAuth callback server, cloud
  session storage and the org-member handlers; keep local profiles. Preload and
  renderer follow in the next two commits.

  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01PskLbdTqJNXxJ7KRnDoDoD"
  ```

---

### Task U5.2: Remove cloud members from the preload bridge, shared types and the web stub
**Files:**
- Modify: `src/preload/api/orca-profiles-bridge.ts:3-8,14-19,21,46-55`; `src/preload/api/orca-profile-api.ts:1-26,30-36,44-60`; `src/shared/orca-profiles.ts:7-8,29-56,94-97,154-303`; `src/renderer/src/web/preload-api/web-orca-profiles-api.ts` (only if `src/renderer/src/web/` exists)
- Test: `pnpm test src/preload src/shared/orca-profiles.test.ts src/main/orca-profiles/profile-index-store.test.ts`

**Interfaces:** Consumes: U5.1. Produces: `OrcaProfileApi = { list, createLocal, switchProfile, transferProject, findProjectProfiles }`; `src/shared/orca-profiles.ts` keeps `OrcaProfileKind` (`'local' | 'cloud-linked'`), `OrcaProfileCloudSummary` and `OrcaProfileSummary.cloud?` because `profile-index-store.ts:63-79` validates existing index files that may hold cloud-linked profiles (they keep working as plain profile directories; no migration in Spec A).

- [ ] **Step 1: Preload bridge.** `orca-profiles-bridge.ts`: lines 3-8 become `import type { OrcaProfileListResult, SwitchOrcaProfileResult, TransferOrcaProfileProjectResult } from '../../shared/orca-profiles'`; delete lines 14-19 (`authStatus`, `onAuthStatusChanged`), 21 (`createCloudLinked`), 47-55 (`connectCurrent` … `orgMemberRemove`), and the trailing comma on line 46. `orca-profile-api.ts`: lines 1-26 become `import type { CreateLocalOrcaProfileArgs, CreateLocalOrcaProfileResult, FindOrcaProfileProjectsByPathArgs, FindOrcaProfileProjectsByPathResult, OrcaProfileListResult, SwitchOrcaProfileArgs, SwitchOrcaProfileResult, TransferOrcaProfileProjectArgs, TransferOrcaProfileProjectResult } from '../../shared/orca-profiles'`; delete lines 30-32, 34-36, 44-60.
- [ ] **Step 2: Shared types.** In `src/shared/orca-profiles.ts` delete lines 7-8 (`ORCA_PROFILE_AUTH_STATUS_CHANGED_CHANNEL`), 29-56 (`OrcaCloudOrgSummary`, `OrcaCloudCapabilityFlags`, `OrcaCloudCapabilities`, `OrcaCloudSessionPersistence`, `OrcaProfileAuthState`, `OrcaProfileAuthStatus`), 94-97 (`CreateCloudLinkedOrcaProfileArgs`), 154-303 (`ConnectCurrentOrcaProfileResult` through `OrcaProfileOrgMemberMutationResult`). Keep lines 17-27 and `cloud?: OrcaProfileCloudSummary` at 66. Verify: `rg -n "OrcaProfileAuthStatus|OrcaCloudOrgSummary|OrcaCloudCapabilit|OrcaOrg[A-Z]|CreateCloudLinked|ConnectCurrentOrcaProfile|SignOutCurrentOrcaProfile|SelectOrcaProfileOrg|RefreshCurrentOrcaProfileAuth|ORCA_PROFILE_AUTH_STATUS_CHANGED_CHANNEL" src --glob '!**/*.test.*'` → remaining hits only under `src/renderer/` (U5.3).
- [ ] **Step 3: Web stub (conditional).** If `src/renderer/src/web/preload-api/web-orca-profiles-api.ts` exists, replace its body so `createWebOrcaProfilesApi()` returns only `list`, `createLocal`, `switchProfile`, `transferProject`, `findProjectProfiles` (delete lines 9-16, 25-26, 34-37, 51-71 and the trailing comma after `findProjectProfiles`).
- [ ] **Step 4: Verify.** `pnpm tc:node`; `pnpm test src/preload src/shared src/main/orca-profiles` → green; `pnpm run check:code-quality:changed` → clean.
- [ ] **Step 5: Commit.**
  ```
  git add -A && git commit -m "refactor(local-only): drop cloud members from the orca-profiles preload bridge and shared types

  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01PskLbdTqJNXxJ7KRnDoDoD"
  ```

---

### Task U5.3: Remove the Orca Account renderer surfaces
**Files:**
- Delete: `src/renderer/src/components/settings/OrcaAccountSettingsPane.tsx`, `OrcaAccountSettingsPane.test.tsx`, `orca-account-settings-search.ts`; `src/renderer/src/components/UnexpectedSignoutCard.tsx`; `src/renderer/src/components/unexpected-signout/` (3 files); `src/renderer/src/store/slices/orca-profiles-auth-actions.ts`, `orca-profiles-auth-actions.test.ts`, `orca-profiles-auth-actions-connect-overlap.test.ts`; `src/renderer/src/hooks/ipc-events/orca-profile-auth-ipc-bridge.ts`, `orca-profile-auth-ipc-bridge.test.ts`; `src/renderer/src/hooks/use-orca-profile-auth-status-refresh.ts`
- Modify: `src/renderer/src/store/slices/orca-profiles.ts:4-10,12-17,20,25,40,48-51,56,65-74,83,97`, `orca-profiles.test.ts`; `src/renderer/src/app-shell/AppRootSurfaces.tsx:63-66,292-294`; `src/renderer/src/hooks/ipc-events/app-lifetime-ipc-bridge.ts:18,97`; `src/renderer/src/hooks/useIpcEvents-lifecycle.test.ts:23,131`; `src/renderer/src/hooks/settings-navigation-capability-sections.ts:9,131-145`; `src/renderer/src/lib/settings-navigation-types.ts:45`; `src/renderer/src/components/settings/settings-setup-workflow-section-renderers.tsx:7,14-31`; `settings-page-renderer.tsx:21,123`; `src/renderer/src/hooks/useSettingsNavigationMetadata.test.ts:41,125-135`; `src/renderer/src/components/settings/DevToolsPane.tsx:8,137-205,326`
- Precondition (U6, U7, U8 done): see step 1.
- Test: `pnpm test src/renderer/src/store src/renderer/src/app-shell src/renderer/src/hooks src/renderer/src/components/settings src/renderer/src/components`

**Interfaces:** Consumes: U5.2; U6 (deleted `MobilePane.tsx`, `MobilePage.tsx`, `MobilePairingConnectionOptions.tsx`, `mobile-relay-mint-failure-notice.tsx`, all readers of `orcaProfileAuthStatus`); U8 (deleted artifact and share-skills readers). Produces: `OrcaProfilesSlice` without `orcaProfileAuthStatus`/`fetchOrcaProfileAuthStatus`/`OrcaProfilesAuthActions`; no `orca-account` settings section.

- [ ] **Step 1: Precondition.** `rg -l "orcaProfileAuthStatus|fetchOrcaProfileAuthStatus|connectCurrentOrcaProfile|signOutCurrentOrcaProfile|createCloudLinkedOrcaProfile|selectOrcaProfileOrg|refreshCurrentOrcaProfileAuth|useOrcaProfileAuthStatusRefresh" src/renderer --glob '!**/*.test.*'` → every hit must be a file this task deletes or edits. A hit in `components/mobile/`, `components/settings/Mobile*`, `components/artifacts/` or `ShareSkillsSettingsPane.tsx` means U6 or U8 has not landed: stop.
- [ ] **Step 2: Delete the account UI and auth slice.**
  ```
  git rm src/renderer/src/components/settings/OrcaAccountSettingsPane.tsx \
    src/renderer/src/components/settings/OrcaAccountSettingsPane.test.tsx \
    src/renderer/src/components/settings/orca-account-settings-search.ts \
    src/renderer/src/components/UnexpectedSignoutCard.tsx \
    src/renderer/src/store/slices/orca-profiles-auth-actions.ts \
    src/renderer/src/store/slices/orca-profiles-auth-actions.test.ts \
    src/renderer/src/store/slices/orca-profiles-auth-actions-connect-overlap.test.ts \
    src/renderer/src/hooks/ipc-events/orca-profile-auth-ipc-bridge.ts \
    src/renderer/src/hooks/ipc-events/orca-profile-auth-ipc-bridge.test.ts \
    src/renderer/src/hooks/use-orca-profile-auth-status-refresh.ts
  git rm -r src/renderer/src/components/unexpected-signout
  ```
  (The persisted `dismissedUnexpectedSignoutVersion` preference in `ui-slice-*`, `shared/persisted-ui-state-types.ts:135`, `shared/constants.ts:249`, `shared/rpc-contract/client-ui-params.ts:194` stays; `ui-notice-dismissals.test.ts` keeps passing.)
- [ ] **Step 3: Profiles slice.** In `src/renderer/src/store/slices/orca-profiles.ts`: delete line 5 (`OrcaProfileAuthStatus,`), 12-15 (auth-actions import), 20, 25, 40, 56, 65-74 (`fetchOrcaProfileAuthStatus`), 83 (`void get().fetchOrcaProfileAuthStatus()`), 97 (`...createOrcaProfilesAuthActions(set, get, api),`); line 17 becomes `export type OrcaProfilesSlice = {`; lines 48-51 become `const state = await window.api.orcaProfiles.list()`; line 36 `api` param becomes `_api` or is dropped if unused. `orca-profiles.test.ts`: delete the `authStatus`/`createCloudLinked` mocks (90, 92) and every `it` that uses `localAuthStatus`/`connectedAuthStatus` (105, 147 and their cases), plus the `cloud: {…}` fixture block at 76-77 if nothing else reads it.
- [ ] **Step 4: Mounts and bridges.** `AppRootSurfaces.tsx`: delete lines 63-66 (lazy `UnexpectedSignoutCard`) and 292-294 (`<OverlayBoundary boundaryId="overlay.unexpected-signout" …><UnexpectedSignoutCard /></OverlayBoundary>`). `app-lifetime-ipc-bridge.ts`: delete lines 18 and 97. `useIpcEvents-lifecycle.test.ts`: delete lines 23 and 131 (`'orcaProfiles.onAuthStatusChanged',` in both lists).
- [ ] **Step 5: Settings navigation and dev tools.** `settings-navigation-capability-sections.ts`: delete line 9 and the `...(showDesktopOnlySettings ? [ { id: 'orca-account', … } ] : []),` block at 131-145 (keep line 129, used by the mobile entry at 201 while U6 is in flight; drop it if oxlint reports it unused). `settings-navigation-types.ts`: delete line 45 (`'orca-account',`). `settings-setup-workflow-section-renderers.tsx`: delete line 7 and lines 14-31. `settings-page-renderer.tsx`: delete lines 21 and 123. `useSettingsNavigationMetadata.test.ts`: delete line 41 and the `it` at 125-135 that looks up `'orca-account'`. `DevToolsPane.tsx`: delete line 8, the comment + `OrcaCloudDevSubsection` function (line 137 through the closing `}` before the next top-level declaration, ~205), and line 326; keep `Badge` (used at 314).
- [ ] **Step 6: Verify.** `rg -n "orca-account|OrcaAccount|UnexpectedSignout|orcaProfiles\\.(authStatus|connectCurrent|createCloudLinked|refreshAuth|signOutCurrent|selectOrg|org)" src --glob '!src/renderer/src/i18n/**'` → hits only in `ui-slice-*`/`shared` dismissal-preference lines. `pnpm tc` (full); `pnpm test src/renderer/src/store src/renderer/src/app-shell src/renderer/src/hooks src/renderer/src/components/settings src/renderer/src/components/sidebar` → green. `pnpm run sync:localization-runtime-catalog && pnpm run verify:localization-runtime-catalog` → clean. `pnpm run check:code-quality:changed` → clean. `pnpm lint` → green (max-lines ratchet, rpc catalog, localization catalogs).
- [ ] **Step 7: Commit.**
  ```
  git add -A && git commit -m "refactor(local-only): remove Orca Account settings, sign-in actions and sign-out card

  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01PskLbdTqJNXxJ7KRnDoDoD"
  ```
---

## Planner group: U10

## U10 — Git provider API integrations (GitHub, GitLab, Bitbucket, Azure DevOps, Gitea, Jira, Linear, hosted reviews)

Full plan file (identical content, durable): `/private/tmp/claude-501/-Users-abhijitbansal-projects-orca-local/fda30a90-8c36-4b0a-a576-28a998d2a0b9/scratchpad/u10-plan.md`. Closure inputs/outputs next to it: `seed.json`, `closure.py`, `closure.json` (1582 deleted files, 186 import-edit files), `edits-{main,preload,shared,renderer}.txt`, `delete-listing.txt`.

### Scope rules applied in every U10 task (read before executing any step)

1. **Delete** every module that performs provider I/O (`window.api.gh|gl|hostedReview|bitbucket|linear|jira`, `fetch`/`net.fetch`, `gh`/`glab` exec, `@linear/sdk`), every renderer surface that renders provider data (task page, PR page, checks panel, item dialogs, integrations settings, sidebar PR status), every store slice that caches provider data (`github`, `hosted-review`, `linear`, `jira`), and every test/fixture whose subject is deleted. Whole directories go with `git rm -r`; everything else is listed by file.
2. **Keep (stated Tier-1 exception, zero egress):** the pure type/parser modules under `src/shared/` (`src/shared/github/*`, `src/shared/linear/*`, `src/shared/hosted-review*.ts`, `src/shared/gitlab-*.ts`, `src/shared/jira-*.ts`, `src/shared/pr-*.ts`, `src/shared/task-providers.ts`, `src/shared/work-items.ts`, `src/shared/new-workspace/*`, `src/shared/terminal-github-pr-link-detector.ts`, `src/shared/issue-link-input.ts`, `src/shared/bitbucket-credentials.ts`, `src/shared/provider-check-summary.ts`) and the I/O-free renderer parsers that kept code imports (`src/renderer/src/lib/{github-links,gitlab-links,github-work-item-identity,linear-linked-work-item,jira-source-host,smart-github-submit,composer-issue-command,linked-work-item-context,linked-work-item-provider,work-item-lookup-text,work-item-link-query-bounds,worktree-setup-issue-command-queue}.ts`, `src/renderer/src/hooks/composer-state/{github-source-application,gitlab-provider-selection,work-item-source-actions,full-creation-issue-command}.ts`, `src/renderer/src/components/sidebar/worktree-card-pr-display.ts`). They are leaf modules (no imports from deleted code, no `window.api`, no store). Deleting them would force rewrites in ~110 kept files (composer-state, persisted-state-types, repo-types, global-settings-types, worktree types) — the merge hot spots the spec wants to avoid. Persisted settings/metadata keep their shape, so no migration is needed and existing user state loads unchanged.
3. **Only `src/shared/rpc-contract/*` provider params are deleted** (they feed the RPC catalog, which must match the dispatcher).
4. Behaviour changes (not deletes) get a failing test first: preflight status shape (Task U10.3 Step 3), onboarding integrations step (Task U10.1 Step 9), worktree-creation branch collision without a forge probe (Task U10.4 Step 5).
5. The closure below was computed by a reproducible script (import graph over `src/`, `window.api.<ns>` access, and Zustand key access for the four deleted slices). Re-run after each task: `rg -n "api\.(gh|gl|hostedReview|bitbucket|linear|jira)\b" src/renderer/src src/preload --glob '!src/renderer/src/web/**'` must print nothing after U10.2, and `pnpm tc` is the oracle.

---

### Task U10.1: Remove the renderer provider surfaces and store slices

**Files:**
Delete (whole directories, `git rm -r`):
- `src/renderer/src/components/github-item-dialog/` (52)
- `src/renderer/src/components/github-project/` (54)
- `src/renderer/src/components/github/` (42)
- `src/renderer/src/components/gitlab/` (1)
- `src/renderer/src/components/gitlab-item-dialog/` (12)
- `src/renderer/src/components/pull-request-page/` (54)
- `src/renderer/src/components/task-page/` (47)
- `src/renderer/src/components/right-sidebar/checks-panel/` (50)
- `src/renderer/src/components/right-sidebar/source-control/review/` (35)
- `src/renderer/src/store/github/` (35)
- `src/renderer/src/store/slices/linear/` (18)

Delete (files):
- `src/renderer/src/components/` (242): `GitHubItemDialog.tsx GitLabItemDialog.tsx HostedReviewUnlinkMenuItem.tsx JiraIssueWorkspace.tsx LinearIssueMarkdownDescriptionEditor.tsx LinearIssueMarkdownToolbar.tsx LinearIssueTextEditor.tsx LinearIssueWorkspace.tsx LinearItemDrawer.tsx PullRequestPage.tsx WorktreeJumpPalette.linear-url.test.tsx connect-dialog-outside-dismiss.test.tsx github-body-draft-state.test.ts github-body-draft-state.ts github-checks-tab-state.test.ts github-checks-tab-state.ts github-link-copy-state.test.ts github-link-copy-state.ts github-pr-merge-state.test.ts github-pr-merge-state.ts github-pr-reviewer-display.test.ts github-pr-reviewer-display.ts gitlab-item-dialog-parts.tsx jira-connect-dialog.tsx jira-create-adf.test.ts jira-create-adf.ts jira-issue-sorter.ts jira-issue-workspace-actions.ts jira-issue-workspace-chrome.tsx jira-issue-workspace-content.tsx jira-project-picker-filter.test.ts jira-project-picker-filter.ts jira-user-picker.tsx linear-api-key-dialog-state.test.ts linear-api-key-dialog-state.ts linear-api-key-dialog.tsx linear-custom-view-table-content.tsx linear-issue-activity.tsx linear-issue-attribute-filter-coverage-agreement.test.ts linear-issue-attribute-filter-coverage-notice.tsx linear-issue-attribute-filter-dropdowns.test.tsx linear-issue-attribute-filter-dropdowns.tsx linear-issue-attribute-filter-pills.ts linear-issue-attribute-filter-primary-team.test.ts linear-issue-attribute-filter-primary-team.ts linear-issue-attribute-filter-sections.tsx linear-issue-attribute-filter-team-ids.test.ts linear-issue-attribute-filter-team-ids.ts linear-issue-clipboard.ts linear-issue-project-selector.test.tsx linear-issue-project-selector.tsx linear-issue-sub-issues.tsx linear-issue-text-draft-state.test.ts linear-issue-text-draft-state.ts linear-issue-text-save-plan.test.ts linear-issue-text-save-plan.ts linear-issue-view-storage.test.ts linear-issue-view-storage.ts linear-issue-workspace-detail-state.test.tsx linear-issue-workspace-detail-state.ts linear-issue-workspace-header.tsx linear-issue-workspace-sidebar.tsx linear-issue-workspace-text.test.ts linear-issue-workspace-text.ts linear-item-drawer-comment-footer.tsx linear-item-drawer-edit-chips-layout.tsx linear-item-drawer-edit-controller.tsx linear-item-drawer-edit-controls.tsx linear-item-drawer-edit-properties-layout.tsx linear-item-drawer-edit-section.tsx linear-item-drawer-sheet.tsx linear-item-drawer-types.ts linear-priority-icon.tsx linear-project-overview-content.tsx linear-project-overview-metadata.tsx linear-project-presentation.test.ts linear-project-presentation.ts linear-project-search-query.test.ts linear-project-search-query.ts linear-project-table-content.tsx linear-project-view-surfaces.test.tsx linear-project-view-surfaces.tsx linear-scope-selector.test.ts linear-scope-selector.tsx linear-state-pill-style.ts pr-checks-fix-prompt.test.ts pr-checks-fix-prompt.ts provider-check-classification-parity.test.ts task-page-cache-selectors.test.ts task-page-cache-selectors.ts task-page-checks-pill.test.ts task-page-checks-pill.ts task-page-default-repo-selection.test.ts task-page-default-repo-selection.ts task-page-draft-storage.tsx task-page-empty-state.test.ts task-page-empty-state.ts task-page-github-dialog-state-authority.test.ts task-page-github-dialog-state-authority.ts task-page-github-landing-refresh-run.tsx task-page-github-list-scroll-restore.test.ts task-page-github-list-scroll-restore.ts task-page-github-quiet-refresh-run.tsx task-page-github-resume-cache.test.ts task-page-github-resume-cache.ts task-page-github-review-model.tsx task-page-github-reviewer-actions.ts task-page-github-reviewer-suggestions.test.ts task-page-github-status-actions.test.ts task-page-github-status-actions.ts task-page-github-status-state.test.ts task-page-github-status-state.ts task-page-github-task-kind.test.ts task-page-github-task-kind.ts task-page-github-work-item-authority-refresh.ts task-page-github-work-item-filter-membership.test.ts task-page-github-work-item-filter-membership.ts task-page-github-work-item-mutation-composition.ts task-page-github-work-item-mutation-keys.ts task-page-github-work-item-mutation-lifecycle.ts task-page-github-work-item-mutation-pages.ts task-page-github-work-item-mutation-patches.test.ts task-page-github-work-item-mutation-patches.ts task-page-github-work-item-mutation-registry.ts task-page-github-work-item-mutation-regressions.test.ts task-page-github-work-item-mutation-types.ts task-page-github-work-item-mutations.test.ts task-page-github-work-item-mutations.ts task-page-github-work-item-quiet-adopt.ts task-page-github-work-item-quiet-revalidate.ts task-page-github-work-item-quiet-state.ts task-page-github-work-item-registry-types.ts task-page-github-work-item-status-badge.tsx task-page-github-work-item-status.test.ts task-page-github-work-item-status.ts task-page-gitlab-task-filters.test.ts task-page-initial-selection-scaling.test.tsx task-page-jira-cache-selectors.test.ts task-page-jira-cache-selectors.ts task-page-jira-create-fields.test.ts task-page-jira-create-fields.ts task-page-jira-grouping.test.ts task-page-jira-issue-list.tsx task-page-jira-item-source-context.test.ts task-page-jira-item-source-context.ts task-page-jira-load-state.test.ts task-page-jira-load-state.ts task-page-jira-project-selection.test.ts task-page-jira-project-selection.ts task-page-jira-sort-controls.test.tsx task-page-jira-sort-controls.tsx task-page-jira-sorting.test.ts task-page-jira-status-order.ts task-page-jira-status-tone.ts task-page-linear-cache-selectors.ts task-page-linear-in-orca-issues.test.ts task-page-linear-in-orca-issues.ts task-page-linear-issue-dialog-popover-scroll.test.ts task-page-linear-issue-empty-state.test.ts task-page-linear-issue-empty-state.ts task-page-linear-issue-grouping.test.ts task-page-linear-issue-model.tsx task-page-linear-issue-request.test.ts task-page-linear-issue-request.ts task-page-linear-jira-list-model.tsx task-page-linear-team-selection.test.ts task-page-linear-team-selection.ts task-page-list-chrome-visibility.test.ts task-page-list-chrome-visibility.ts task-page-localized-options.test.ts task-page-localized-options.tsx task-page-mutation-page-allocation.test.ts task-page-new-issue-draft.test.ts task-page-new-issue-draft.ts task-page-pagination-page-numbers.test.ts task-page-pagination-page-numbers.ts task-page-pr-check-summary.test.ts task-page-pr-check-summary.ts task-page-pr-delta-summary.ts task-page-repo-source-context.test.ts task-page-repo-source-divergence.test.ts task-page-source-context.tsx task-page-string-set-equality.ts task-page-task-source-host-availability.test.ts task-page-work-item-pagination.test.ts task-page-work-item-pagination.ts task-page-work-item-signatures.ts task-project-source-combobox-model.ts task-project-source-combobox.tsx task-source-provider-availability.test.ts task-source-provider-availability.ts use-github-task-search-commit.test.ts use-github-task-search-commit.ts use-task-page-composer-actions.ts use-task-page-detail-routing.ts use-task-page-github-cache-reconciliation.ts use-task-page-github-detail.ts use-task-page-github-issue-creation.ts use-task-page-github-issue-draft.ts use-task-page-github-landing-refresh.ts use-task-page-github-list-projection.ts use-task-page-github-list-state.ts use-task-page-github-mutation-state.ts use-task-page-github-quiet-refresh-effect.ts use-task-page-github-quiet-refresh.ts use-task-page-github-search-pagination.ts use-task-page-gitlab-loading.ts use-task-page-global-effects.ts use-task-page-jira-creation-metadata.ts use-task-page-jira-creation-projects.ts use-task-page-jira-creation-state.ts use-task-page-jira-issue-creation.ts use-task-page-jira-list-effects.test.ts use-task-page-jira-list-effects.ts use-task-page-jira-list-projection.ts use-task-page-jira-list-state.ts use-task-page-linear-board.ts use-task-page-linear-collection-effects.ts use-task-page-linear-context-actions.ts use-task-page-linear-context-state.ts use-task-page-linear-creation-state.ts use-task-page-linear-custom-view-effects.ts use-task-page-linear-filter-selection.ts use-task-page-linear-in-orca-effects.ts use-task-page-linear-issue-creation.ts use-task-page-linear-list-effects.ts use-task-page-linear-list-presentation.ts use-task-page-linear-list-projection.ts use-task-page-linear-list-selection.ts use-task-page-linear-project-creation.ts use-task-page-linear-view-state.ts use-task-page-provider-metadata.ts use-task-page-provider-state.ts use-task-page-repo-selection.ts use-task-page-resume-restoration.ts use-task-page-runtime-hosts.ts use-task-page-search-actions.ts use-task-page-source-availability.ts use-task-page-source-summary.ts use-task-page-store-bindings.ts use-task-page-workspace-actions.ts use-worktree-jump-palette-task-url.ts`
- `src/renderer/src/components/editor/` (3): `check-run-details-fix-context.ts check-run-details-fix-with-ai.test.ts check-run-details-fix-with-ai.ts`
- `src/renderer/src/components/feature-wall/` (6): `ConnectIntegrationsList.test.tsx ConnectIntegrationsList.tsx connect-integration-step.tsx use-feature-wall-task-source-presentation.ts use-integration-connection-status.test.ts use-integration-connection-status.ts`
- `src/renderer/src/components/new-workspace/` (8): `SmartWorkspaceNameField.jira-accessibility.test.tsx smart-workspace-github-direct-link.ts use-jira-source-connection.test.tsx use-jira-source-connection.ts use-jira-url-source.test.tsx use-jira-url-source.ts use-smart-workspace-github-search.ts use-smart-workspace-gitlab-search.ts`
- `src/renderer/src/components/onboarding/IntegrationsStep.tsx`
- `src/renderer/src/components/right-sidebar/` (86): `ChecksPanel.review-header.test.tsx ChecksPanel.tsx ChecksPanel.updated-at-metadata.test.tsx CreateHostedReviewBasePicker.tsx CreateHostedReviewComposer.tsx CreateHostedReviewComposerFields.tsx CreateHostedReviewComposerMessage.tsx FolderWorkspacePrChecksPanel.test.tsx FolderWorkspacePrChecksPanel.tsx FolderWorkspacePrChecksRow.test.tsx FolderWorkspacePrChecksRow.tsx HostedReviewActions.draft.test.tsx HostedReviewActions.tsx HostedReviewStateActions.tsx PullRequestComposer.generate-tooltip.test.tsx SourceControl.hosted-review-header-link.test.tsx active-checks-status.test.ts active-checks-status.ts checks-list-expanded-details.test.tsx checks-panel-async-result-key.test.ts checks-panel-async-result-key.ts checks-panel-blocker-copy.ts checks-panel-content.test.tsx checks-panel-empty-state.test.ts checks-panel-empty-state.ts checks-panel-git-status-snapshot.test.ts checks-panel-git-status-snapshot.ts checks-panel-hosted-review-click-routing.test.ts checks-panel-hosted-review-click-routing.ts checks-panel-pr-refresh-breadcrumb.test.ts checks-panel-pr-refresh-breadcrumb.ts checks-panel-pr-refresh-request.test.ts checks-panel-pr-refresh-request.ts checks-panel-review-copy.ts checks-panel-review-creation.test.ts checks-panel-review-creation.ts checks-panel-review-lookup-authority.test.ts checks-panel-review-lookup-authority.ts checks-panel-review-state-model.ts checks-panel-review.test.ts checks-panel-review.ts checks-panel-terminal-worktree.test.ts checks-panel-terminal-worktree.ts checks-panel-updated-at-metadata.tsx create-hosted-review-button-label.ts create-hosted-review-composer-field-class.ts create-pull-request-review-copy.ts hosted-review-github-actions.ts hosted-review-gitlab-actions.ts parent-pr-checks-github-pr-cache.ts parent-pr-checks-hosted-review-cache.ts parent-pr-checks-projection-selector.test.ts parent-pr-checks-projection-selector.ts parent-pr-checks-refresh.test.ts parent-pr-checks-refresh.ts parent-pr-checks-row-status.ts parent-pr-checks-row-types.ts parent-pr-checks-rows.test.ts parent-pr-checks-rows.ts pr-comment-ack-summary.test.ts pr-comment-fixing-reply-body.ts pr-comment-presentation.test.ts pr-comment-presentation.ts pr-comment-snapshotted-thread-resolver.test.ts pr-comment-snapshotted-thread-resolver.ts pr-comment-thread-resolution.test.ts pr-comment-thread-resolution.ts pr-comments-ai-launch-ack.test.ts pr-comments-ai-launch-ack.ts pr-comments-list-selection.test.tsx pr-comments-list-selection.ts source-control-create-pr-intent-flow.test.ts source-control-create-review-blocked-action.test.ts source-control-create-review-blocked-action.ts source-control-dropdown-review-items.ts source-control-hosted-review-creation-eligibility-snapshot.test.ts source-control-hosted-review-push-target.test.ts source-control-manual-review-url.test.ts source-control-primary-action.create-pr-intent.test.ts use-checks-panel-terminal-worktree.test.ts use-checks-panel-terminal-worktree.ts use-hosted-review-actions.test.tsx use-hosted-review-actions.ts use-ready-hosted-review-action.ts useHostedReviewStackParent.test.tsx useHostedReviewStackParent.ts`
- `src/renderer/src/components/settings/` (57): `GitProviderApiBudgetPane.tsx HostedReviewCreationDefaults.tsx IntegrationsPane.tsx LinearAgentSkillGuide.test.tsx LinearAgentSkillGuide.tsx LinearAgentSkillNotes.test.tsx LinearAgentSkillNotes.tsx LinearAgentSkillPane.test.tsx LinearAgentSkillPane.tsx ProviderHostScopeControl.tsx RepositoryGitHubAccountSection.test.tsx RepositoryGitHubAccountSection.tsx RepositoryIconPicker.github-avatar-refresh.test.tsx RepositorySourceControlAiHostedReviewDefaults.tsx TaskSourceLinearSetup.test.tsx TaskSourceLinearSetup.tsx TaskSourceProviderCard.test.tsx TaskSourceProviderCard.tsx TaskSourceShowInTasksStep.test.tsx TaskSourceShowInTasksStep.tsx TaskSourceSimpleSetup.test.tsx TaskSourceSimpleSetup.tsx TaskSourceStepRow.tsx TasksPane.test.tsx TasksPane.tsx bitbucket-credentials-dialog.tsx bitbucket-integration-card.test.tsx bitbucket-integration-card.tsx cli-source-control-integration-cards.test.tsx cli-source-control-integration-cards.tsx git-provider-api-budget-search.ts integration-card-presentation.tsx integration-card-shell.tsx integrations-pane-status.test.ts integrations-pane-status.ts integrations-search.ts jira-integration-card.test.tsx jira-integration-card.tsx linear-agent-skill-guide-content.ts linear-agent-skill-install-cta.test.tsx linear-agent-skill-install-cta.tsx linear-agent-skill-search.ts provider-rate-limit-scope-panels.test.tsx repository-github-account.ts repository-icon-github.test.ts repository-icon-github.ts source-control-integration-cards.tsx source-control-preflight-card-status.ts task-provider-integration-section-ids.ts task-tracker-integration-cards.test.tsx task-tracker-integration-cards.tsx token-source-control-integration-cards.tsx token-source-control-status.ts use-integration-provider-status-refresh.ts use-linear-agent-skill-setup.ts use-task-source-provider-readiness.test.tsx use-task-source-provider-readiness.ts`
- `src/renderer/src/components/sidebar/` (14): `LinearAgentSkillSetupPrompt.reminder-toast.test.tsx LinearAgentSkillSetupPrompt.test.tsx LinearAgentSkillSetupPrompt.tsx SidebarTaskNavButton.tsx WorktreeCardReviewDetailSection.tsx WorktreeReviewLinkField.tsx folder-workspace-card-pr-display.test.ts folder-workspace-card-pr-display.ts use-worktree-card-review-details.ts use-worktree-issue-link.ts workspace-board-task-status-sync.test.ts workspace-board-task-status-sync.ts worktree-review-helpers.test.tsx worktree-review-helpers.tsx`
- `src/renderer/src/components/sidebar/worktree-list/listing/`: `review-cache-inputs.test.ts review-cache-inputs.ts`
- `src/renderer/src/components/sidebar/worktree-list/viewport/`: `use-visible-review-refresh.ts visible-refresh.test.ts`
- `src/renderer/src/hooks/` (8): `use-task-page-github-work-item-mutation-host.test.ts useGitHubSlugMetadata.test.tsx useGitHubSlugMetadata.ts useIssueMetadata.test.tsx useIssueMetadata.ts useLinearProviderConnected.test.tsx useLinearProviderConnected.ts useTaskPageGitHubWorkItemMutation.ts`
- `src/renderer/src/hooks/composer-state/`: `github-provider-selection.ts github-submit-resolution.ts`
- `src/renderer/src/i18n/`: `hosted-review-localized-copy.ts integration-card-status-localization.test.ts smart-workspace-jira-locales.test.ts`
- `src/renderer/src/lib/` (58): `agent-skill-nav-install-status.test.ts agent-skill-nav-install-status.ts cmd-j-github-url-lookup.test.ts cmd-j-github-url-lookup.ts cmd-j-linear-issue-intent.test.ts fix-checks-agent-launch.test.ts fix-checks-agent-launch.ts github-pr-start-point.test.ts github-pr-start-point.ts github-source-runtime-context.test.ts github-source-runtime-context.ts github-work-item-details-cache-events.ts github-work-item-source-lookup.test.ts github-work-item-source-lookup.ts github-work-item-workspace-attachment.test.ts github-work-item-workspace-attachment.ts gitlab-work-item-source-lookup.test.ts gitlab-work-item-source-lookup.ts launch-work-item-direct-agent-routing.test.ts launch-work-item-direct-agent-routing.ts launch-work-item-direct-agent.test.ts launch-work-item-direct-agent.ts launch-work-item-direct-draft.ts launch-work-item-direct-messages.test.ts launch-work-item-direct-messages.ts launch-work-item-direct-preflight.ts launch-work-item-direct-route-preparation.ts launch-work-item-direct-types.ts launch-work-item-direct.test.ts launch-work-item-direct.ts linear-agent-skill-update-command.test.ts linear-agent-skill-update-command.ts linear-board-drag-payload.test.ts linear-board-drag-payload.ts linear-issue-context-snapshot.test.ts linear-issue-context-snapshot.ts linear-issue-url-lookup.test.ts linear-issue-url-lookup.ts linear-issue-workspace-attachment.test.ts linear-issue-workspace-attachment.ts linear-issue-workspace-open.test.ts linear-issue-workspace-open.ts linear-usage-examples.ts pr-bot-author-overrides.test.ts pr-bot-author-overrides.ts pr-comment-action-state.test.ts pr-comment-action-state.ts pr-comment-audience-labels.ts pr-comment-reactions.test.ts pr-comment-reactions.ts pr-comment-resolution-classes.ts repo-slug-index.test.ts repo-slug-index.ts worktree-palette-gitlab-url-match.ts worktree-palette-task-url-match.test.ts worktree-palette-task-url-match.ts`
- `src/renderer/src/runtime/` (17): `github-check-details-timeout.test.ts github-check-details-timeout.ts gitlab-ipc-timeout.ts gitlab-job-trace-client.test.ts gitlab-job-trace-client.ts local-jira-search-cancellation.ts runtime-jira-client.test.ts runtime-jira-client.ts runtime-jira-payload-stream.test.ts runtime-jira-payload-stream.ts runtime-jira-summary-client.ts runtime-jira-target.ts runtime-jira-user-fields-client.ts runtime-linear-client.test.ts runtime-linear-client.ts runtime-linear-issue-mutations.ts runtime-linear-project-client.ts`
- `src/renderer/src/store/slices/` (67): `editor-check-details-tabs.test.ts github-branch-mismatched-linked-pr.test.ts github-cache-eviction-and-bounds.test.ts github-cache-key.ts github-checks-cache.test.ts github-checks.test.ts github-checks.ts github-issue-source-indicator-suppression.test.ts github-issue-state-machine.test.ts github-pr-branch-coordinator-events.test.ts github-pr-branch-direct-refresh-scope.test.ts github-pr-branch-fallback-results.test.ts github-pr-branch-hosted-review-cache.test.ts github-pr-branch-linked-pr-divergence.test.ts github-pr-checks-fetch.test.ts github-pr-comments.test.ts github-pr-refresh-host-guard.test.ts github-pr-refresh-hosted-review-cache-leak.test.ts github-pr-refresh-owner-routing.test.ts github-pr-refresh-sequences-leak.test.ts github-pr-refresh-states-leak.test.ts github-pr-request-lifetime.test.ts github-project-request-coordination.test.ts github-project-row-owner.test.ts github-project-row-owner.ts github-project-view-tables.test.ts github-provider-request-concurrency.test.ts github-refresh-sweep.test.ts github-repo-lookup-index.test.ts github-repo-lookup-index.ts github-review-thread-actions.test.ts github-slice-test-harness.ts github-work-item-cache-identity.test.ts github-work-items-error-envelope.test.ts github-work-items-pagination.test.ts github-work-items-query-bounds.ts github-work-items-runtime-routing.test.ts github-worktree-refresh-if-stale.test.ts github.ts hosted-review-cache-identity.ts hosted-review-cache-race.test.ts hosted-review-cache-state.ts hosted-review-cache.test.ts hosted-review-card-refresh.ts hosted-review-pr-cache.ts hosted-review-request-lifetime.test.ts hosted-review-request-state.ts hosted-review.test.ts hosted-review.ts jira-collection-read-actions.ts jira-connection-actions.ts jira-issue-patch-action.ts jira-issue-read-actions.ts jira-read-coordination.ts jira-slice-contract.ts jira.test.ts jira.ts linear-credential-error-recovery.test.ts linear-invalidation.test.ts linear-issue-cache-refresh.test.ts linear-scoped-collection-cache.test.ts linear-slice-test-harness.ts linear-source-context-cache-scope.test.ts linear.test.ts linear.ts repo-owner-cache-identity.test.ts worktrees-linked-review-push-target.test.ts`
- `src/renderer/src/store/slices/editor/actions/check-run-details-actions.ts`
- `src/renderer/src/app-shell/window-visibility-actions-selector.ts` (becomes empty, see Step 6)
- `src/renderer/src/components/cmd-j/worktree-checks-review-index.ts`, `src/renderer/src/components/cmd-j/worktree-checks-review-index.test.ts`, `src/renderer/src/components/sidebar/use-workspace-board-task-status-sync.ts`, `src/renderer/src/components/sidebar/WorkspaceKanbanDrawer.task-status-sync.test.tsx`
- `config/scripts/git-diff-blob-concurrency-benchmark.mjs`, `config/scripts/locale-collator-sort-benchmark.mjs`, `config/scripts/review-ack-first-line-benchmark.mjs` (benchmarks of deleted modules; no `package.json` script references them)

Modify (exact anchors in the steps): `src/renderer/src/app-shell/AppWorkspaceShell.tsx:19,74`, `src/renderer/src/app-shell/use-window-visibility-effects.ts:5,9-22`, `src/renderer/src/app-shell/startup-actions-selector.ts:16,53,88`, `src/renderer/src/app-shell/use-app-startup-hydration.ts:360`, `src/renderer/src/app-shell/app-command-handlers.ts:245-254`, `src/renderer/src/store/index.ts:11-13,15,87-89,91`, `src/renderer/src/store/types.ts:9-11,13,57-59,61`, `src/renderer/src/store/slices/store-test-helpers.ts:15-17,19` (+ spread lines), `src/renderer/src/store/slices/ui/ui-slice-task-actions.ts:4-11,13,107-181`, `src/renderer/src/store/slices/worktrees/metadata/update-worktree-meta.ts:8-9,167-240`, `src/renderer/src/store/slices/worktrees/session/worktree-unread-activity.ts:6,160`, `src/renderer/src/store/slices/worktrees/session/set-active-worktree.ts:266`, `src/renderer/src/store/slices/agent-status-live-actions.ts:180`, `src/renderer/src/store/slices/editor/actions/git-remote-push-pull.ts:66-69,88-91,110-113`, `src/renderer/src/store/slices/editor/actions/git-remote-sync.ts:81-84,111-114`, `src/renderer/src/store/slices/editor/create-editor-slice.ts:20` (+ spread), `src/renderer/src/store/repos/repo-removal.ts:103-105`, `src/renderer/src/hooks/ipc-events/project-catalog-ipc-bridge.ts:94-99`, `src/renderer/src/hooks/ipc-events/workspace-shortcut-ipc-bridge.ts:71-79`, `src/renderer/src/hooks/ipc-events/new-workspace-command.ts:1`, `src/renderer/src/hooks/composer-state/provider-runtime-sync.ts:235-245`, `src/renderer/src/hooks/composer-state/composer-external-sync.ts:6`, `src/renderer/src/hooks/composer-state/composer-source-state.ts:9`, `src/renderer/src/hooks/composer-state/linked-item-lookup-effects.ts:33-36`, `src/renderer/src/hooks/composer-state/composer-target-store.ts:76,94,197`, `src/renderer/src/hooks/settings-navigation-capability-sections.ts:1,6-7,31,79-95,190-199`, `src/renderer/src/hooks/settings-navigation-workflow-sections.ts:6,107`, `src/renderer/src/hooks/useSettingsNavigationMetadata.ts:13` (+2 uses), `src/renderer/src/lib/settings-navigation-types.ts:17,21,46`, `src/renderer/src/lib/worktree-palette-document.ts:2,98-109`, `src/renderer/src/lib/worktree-palette-search.ts:32-35` (+2 uses), `src/renderer/src/components/sidebar/SidebarNav.tsx:13,121`, `src/renderer/src/components/sidebar/WorktreeList.tsx:18,94-96`, `src/renderer/src/components/sidebar/rendered-sidebar-worktree-order.ts:17,50-54`, `src/renderer/src/components/sidebar/WorktreeCardMeta.tsx:18,28` (+2 uses), `src/renderer/src/components/sidebar/WorktreeCardMetaBadges.tsx:7` (+2 uses), `src/renderer/src/components/sidebar/WorktreeCardStatusSlot.tsx:12` (+3 uses), `src/renderer/src/components/sidebar/WorktreeMetaDialog.tsx:22,36` (+ uses), `src/renderer/src/components/sidebar/WorkspaceKanbanDrawer.tsx:12,120` (+ calls), `src/renderer/src/components/use-worktree-jump-palette-worktrees.ts:11,231`, `src/renderer/src/components/sidebar/use-worktree-card-foundation.ts:39,41-42,213,215-216`, `src/renderer/src/components/sidebar/use-worktree-card-controller.ts:8`, `src/renderer/src/components/sidebar/use-worktree-card-lifecycle-effects.ts:11`, `src/renderer/src/components/sidebar/use-worktree-card-linked-details.ts:16`, `src/renderer/src/components/sidebar/use-worktree-card-secondary-details.ts:13`, `src/renderer/src/components/sidebar/use-worktree-card-workspace-actions.ts:12`, `src/renderer/src/components/sidebar/worktree-card-secondary-rows.tsx:8` (+2), `src/renderer/src/components/sidebar/worktree-list/grouping/group-keys.ts:14-17,108-150`, `src/renderer/src/components/sidebar/worktree-list/rows/folder-row.tsx:18,34`, `src/renderer/src/components/sidebar/worktree-list/viewport/VirtualizedWorktreeViewport.tsx:15` (+1), `src/renderer/src/components/sidebar/worktree-list/viewport/use-row-measurement.ts:52-53,99`, `src/renderer/src/components/sidebar/worktree-list/listing/use-collapsed-groups.ts:27`, `src/renderer/src/components/sidebar/worktree-list/listing/use-section-rows.ts:34`, `src/renderer/src/components/sidebar/worktree-list/navigation/pending-reveal-inputs.ts:43`, `src/renderer/src/components/sidebar/worktree-list/viewport/viewport-props.ts:78`, `src/renderer/src/components/sidebar/worktree-list-lineage-store-state.ts:120`, `src/renderer/src/components/sidebar/worktree-list-pinned-store-state.ts:47`, `src/renderer/src/components/right-sidebar/index.tsx:10,43,110,166`, `src/renderer/src/components/right-sidebar/right-sidebar-panel-content.tsx:8,12,30,38-42`, `src/renderer/src/components/right-sidebar/use-right-sidebar-activity-items.ts:35,86-92,100-106,119`, `src/renderer/src/components/right-sidebar/activity-bar-buttons.tsx:58`, `src/renderer/src/components/right-sidebar/SourceControl.tsx:4`, `src/renderer/src/components/right-sidebar/source-control-dropdown-items.ts:8` (+1), `src/renderer/src/components/right-sidebar/source-control-primary-action.ts:9-12` (+4 uses), `src/renderer/src/components/right-sidebar/source-control/commit/use-commit-flows.ts:2` (+1), `src/renderer/src/components/right-sidebar/source-control/listing/use-worktree-context.ts:9-10` (+2), `src/renderer/src/components/right-sidebar/source-control/listing/use-store-actions.ts:30-31,33,37-38,40`, `src/renderer/src/components/right-sidebar/source-control/panel/commit-surface.tsx:1` (+2), `src/renderer/src/components/right-sidebar/source-control/panel/header-toolbar.tsx:13` (+2), `src/renderer/src/components/right-sidebar/source-control/panel/use-panel-foundation.ts:4` (+1), `src/renderer/src/components/right-sidebar/source-control/panel/use-panel-model.ts:8-11` (+4), `src/renderer/src/components/right-sidebar/source-control/panel/use-worktree-operation-state.ts:8-11` (+4), `src/renderer/src/components/settings/AccountsPane.tsx:30,135-147`, `src/renderer/src/components/settings/CommitMessageAiPane.tsx:31,323-330`, `src/renderer/src/components/settings/RepositoryIconPicker.tsx:16-20,70-79,81-105,109-133,135-165`, `src/renderer/src/components/settings/RepositoryPane.tsx:28,372-376`, `src/renderer/src/components/settings/RepositorySourceControlAiSection.tsx:11,110-114`, `src/renderer/src/components/settings/settings-capability-section-renderers.tsx:4,93-102`, `src/renderer/src/components/settings/settings-git-task-section-renderers.tsx:3-4,42,55-64`, `src/renderer/src/components/settings/settings-setup-workflow-section-renderers.tsx:5,88-97`, `src/renderer/src/components/settings/use-settings-navigation-model.ts:9-12` (+3), `src/renderer/src/components/settings/use-settings-store-model.ts:21` (+2), `src/renderer/src/components/setup-guide/use-setup-guide-progress.ts:24` (+1), `src/renderer/src/components/status-bar/use-workspace-space-manager-bindings.ts:36-38,90-92`, `src/renderer/src/components/status-bar/workspace-space-decision-details.ts:14-15,53-70,133-162`, `src/renderer/src/components/workspace-cleanup/use-workspace-cleanup-facet-rows.ts:102,115,126,130`, `src/renderer/src/components/workspace-cleanup/workspace-cleanup-candidate-row.tsx:42-45` (+2), `src/renderer/src/components/workspace-cleanup/workspace-cleanup-confirm-remove.tsx:22` (+1), `src/renderer/src/components/workspace-cleanup/workspace-cleanup-presentation.ts:1` (+1), `src/renderer/src/components/dashboard/dashboard-card-context.ts:2,13-17` (+3), `src/renderer/src/components/dashboard/useLiveDashboardSnapshot.ts:30-31,84-85,127-128`, `src/renderer/src/components/dashboard/useDashboardPopoutBridge.ts:58-59`, `src/renderer/src/components/cmd-j/worktree-palette-cache-inputs.ts:1-30`, `src/renderer/src/components/cmd-j/PaletteCreateWorktreeRow.tsx:7` (+2), `src/renderer/src/components/use-worktree-jump-palette-controller.ts:14` (+1), `src/renderer/src/components/use-worktree-jump-palette-create-action.ts:11` (+1), `src/renderer/src/components/use-worktree-jump-palette-local-state.ts:9` (+1), `src/renderer/src/components/worktree-jump-palette-create-worktree.ts:7,25` (+2), `src/renderer/src/components/editor/CheckRunDetailsPanel.tsx:9` (+1), `src/renderer/src/components/activity/activity-thread-hover-card.tsx:18,25,29` (+4), `src/renderer/src/components/automations/use-automation-source-host-availability.ts:8-11` (+2), `src/renderer/src/components/feature-wall/FeatureWallBody.tsx:18` (+3), `src/renderer/src/components/feature-wall/FeatureWallSetupChecklist.tsx:17` (+2), `src/renderer/src/components/feature-wall/FeatureWallTourSurface.tsx:25` (+1), `src/renderer/src/components/feature-wall/use-feature-wall-completion.ts:51-52`, `src/renderer/src/components/new-workspace/smart-workspace-name-field-surface.tsx:12` (+1), `src/renderer/src/components/new-workspace/smart-workspace-repo-slug.ts:3-6` (+2), `src/renderer/src/components/new-workspace/use-smart-workspace-name-field-actions.ts:5,13` (+2), `src/renderer/src/components/new-workspace/use-smart-workspace-name-field-controller.ts:16-17` (+2), `src/renderer/src/components/new-workspace/use-smart-workspace-name-field-foundation.ts:11-12` (+2), `src/renderer/src/components/new-workspace/use-smart-workspace-secondary-searches.ts:3` (+1), `src/renderer/src/components/new-workspace/use-smart-workspace-field-availability.ts:76`, `src/renderer/src/components/onboarding/OnboardingFlow.tsx:10,332`, `src/renderer/src/components/onboarding/onboarding-flow-state.ts:19-21,57-78`, `src/renderer/src/components/onboarding/use-onboarding-flow.ts:46-47,251-252`, `src/renderer/src/components/landing-preflight-issues.ts:18,55-77`, `src/renderer/src/components/contextual-tours/contextual-tour-step-actions.ts:12,51-57`, `src/renderer/src/components/contextual-tours/ContextualTourOverlay.tsx:55,370`, `src/shared/keybindings/definitions-core-1.ts:173-180`, `src/shared/window-shortcut-policy.ts:43,250-252,330-331`, `src/main/window/main-window-shortcut-actions.ts:51-53`, `src/main/browser/browser-guest-shortcut-dispatch.ts:194-195`, `src/preload/api/ui-command-event-api.ts:78`, `src/preload/api/ui-bridge-state-and-menu-commands.ts:107-111`.
Modify (tests): `src/renderer/src/components/cmd-j/worktree-palette-cache-inputs.test.ts`, `src/renderer/src/components/dashboard/dashboard-card-context.test.ts`, `src/renderer/src/components/editor/CheckRunDetailsPanel.copy.test.tsx:23-24`, `src/renderer/src/components/right-sidebar/right-sidebar-titlebar-drag-regions.render.test.tsx:163-172`, `src/renderer/src/components/right-sidebar/source-control-dropdown-items.test.ts:4-7`, `src/renderer/src/components/sidebar/WorkspaceKanbanDrawer.search.test.tsx:161-162`, `src/renderer/src/components/workspace-cleanup/workspace-cleanup-presentation.test.ts`, `src/renderer/src/hooks/composer-state/composer-name-source-selection.test.ts:7`, `src/renderer/src/hooks/useSettingsNavigationMetadata.capability-owner.test.tsx:36-37`, `src/renderer/src/hooks/useSettingsNavigationMetadata.test.ts:44,66-83,144`, `src/renderer/src/hooks/ipc-events/runtime-client-ipc-bridge-ownership.test.ts:135`, `src/renderer/src/store/slices/agent-status-batch.test.ts:199-200`, `src/renderer/src/store/slices/settings.test.ts:439-447`, `src/renderer/src/store/slices/repos.test.ts:3` (+4 uses), `src/renderer/src/store/slices/worktrees-metadata-persistence.test.ts:5-6` (+4), `src/renderer/src/store/slices/preflight.test.ts:72-73,134,173,189,325,363,411,426,454`, `src/renderer/src/components/landing-preflight-issues.test.ts:18-21,28,52-60`, `src/renderer/src/components/landing-preflight-runtime-boundary.test.ts:14`, `src/renderer/src/components/onboarding/OnboardingFlow.test.tsx:138,164,192`, `src/renderer/src/components/onboarding/use-onboarding-flow.test.ts` (new tests, Step 9), `src/renderer/src/components/cmd-j/palette-results.test.ts:277-301`, `src/renderer/src/i18n/settings-status-label-localization.test.ts:55-56`, `src/renderer/src/i18n/technical-literal-catalog-values.test.ts:28`.
Config: `config/reliability-gates.jsonc` (gate `cmd-j-tabs.host-qualified-candidate-ownership`: remove `src/renderer/src/components/cmd-j/worktree-checks-review-index.test.ts` from `testFiles`, its `commands` entry and its `assertionRefs` block; keep the gate), `config/scripts/check-changed-code-quality.mjs:58-59`, `package.json:355-362` (oxlint `react-doctor/no-adjust-state-on-prop-change` override block for the two deleted task-page files).

**Interfaces:** Consumes: U2 (feedback/crash-report submit UI) and U4 (star nag) should have landed — they own the last `window.api.gh.viewer()` / `checkOrcaStarred()` / `starOrca()` callers; Step 0 carries the fallback edits if they have not. Produces: no renderer file references `window.api.gh|gl|hostedReview|bitbucket|linear|jira`, no store key from the four slices, no `src/renderer/src/web/preload-api/web-{github,gitlab}*` consumer (U7 deletes those files; if U7 has not landed, also `git rm src/renderer/src/web/preload-api/web-github-api.ts web-github-cache-api.ts web-github-routes.ts web-gitlab-api.ts web-gitlab-api.test.ts web-gitlab-routes.ts` and the lines that register them in `src/renderer/src/web/preload-api/index.ts`).

- [ ] **Step 0: Confirm the U2/U4 `api.gh` callers are gone, or remove them here.** Run `rg -n "api\.gh\." src/renderer/src --glob '!src/renderer/src/web/**'`. If it prints nothing, continue. Otherwise apply these fallback edits in this task: `src/renderer/src/components/landing-github-star-state.ts` → `git rm` (the whole file is the `checkOrcaStarred` hook); `src/renderer/src/components/Landing.tsx` → delete the `useLandingOrcaStarState` import and call, and lines 62–78 (the star click handler: the `web-fallback` `openUrl`, `setState('starred')`, `await window.api.gh.starOrca('landing')` branch) together with the star button JSX it drives; `src/renderer/src/components/settings/GeneralSupportSection.tsx` → delete the `starState` state (line 3), the `checkOrcaStarred` effect (lines 7–16), `handleStarClick` (lines 22–45) and the star button JSX, keeping the other support links; `src/renderer/src/components/sidebar/SidebarFeedbackDialog.tsx` → delete line 17 (`GitHubViewer` type import), line 74 (`viewer` state), lines 110–128 (the `window.api.gh.viewer()` effect), change `getSubmitIdentity(viewer, submitAnonymously)` at 157 to `getSubmitIdentity(null, submitAnonymously)` and delete lines 362–369 (`{viewer ? … : …}` identity row), then delete the `viewer` parameter branch in `getSubmitIdentity` (lines 47–58) so it always returns the anonymous identity; `src/renderer/src/components/crash-report/CrashReportDialogSurface.tsx` → delete line 23, line 89 (`viewer` state), lines 102–132 (`clearViewer`, `loadViewerForOpenDialog` and the effect that calls them) and change line 180 to `submitAnonymously: true`. Expected after either path: the `rg` above prints nothing.

- [ ] **Step 1: Delete the whole directories and listed files.** Run from the repo root:
  ```bash
  git rm -r -q src/renderer/src/components/github-item-dialog src/renderer/src/components/github-project src/renderer/src/components/github src/renderer/src/components/gitlab src/renderer/src/components/gitlab-item-dialog src/renderer/src/components/pull-request-page src/renderer/src/components/task-page src/renderer/src/components/right-sidebar/checks-panel src/renderer/src/components/right-sidebar/source-control/review src/renderer/src/store/github src/renderer/src/store/slices/linear
  ```
  then `git rm -q` every file named in the Delete lists above (one `git rm` per directory group; the names are exact), including `src/renderer/src/app-shell/window-visibility-actions-selector.ts`, `src/renderer/src/components/cmd-j/worktree-checks-review-index.ts`, `src/renderer/src/components/cmd-j/worktree-checks-review-index.test.ts`, `src/renderer/src/components/sidebar/use-workspace-board-task-status-sync.ts`, `src/renderer/src/components/sidebar/WorkspaceKanbanDrawer.task-status-sync.test.tsx`, and the three benchmark scripts under `config/scripts/`. Expected: `git status --short | rg '^D' | wc -l` prints 978 (975 files under `src/renderer/src` + 3 benchmark scripts).

- [ ] **Step 2: Store composition — delete lines only.** `src/renderer/src/store/index.ts`: delete lines 11, 12, 13, 15 (the four `import { createGitHubSlice | createHostedReviewSlice | createLinearSlice | createJiraSlice }` lines) and lines 87, 88, 89, 91 (`...createGitHubSlice(...a),` `...createHostedReviewSlice(...a),` `...createLinearSlice(...a),` `...createJiraSlice(...a),`). `src/renderer/src/store/types.ts`: delete lines 9, 10, 11, 13 (the four `import type` lines) and lines 57, 58, 59, 61 (`GitHubSlice &`, `HostedReviewSlice &`, `LinearSlice &`, `JiraSlice &`). `src/renderer/src/store/slices/store-test-helpers.ts`: delete lines 15, 16, 17, 19 and the four matching `...create*Slice(...a),` spread lines in the same file. `src/renderer/src/store/slices/editor/create-editor-slice.ts`: delete line 20 and the `...createCheckRunDetailsActions(set, get),` spread line. Expected: `pnpm tc:web` reports errors only in files named in this task's Modify list.

- [ ] **Step 3: Tasks view entry points.** `src/renderer/src/app-shell/AppWorkspaceShell.tsx`: delete line 19 (`const TaskPage = lazy(() => import('../components/task-page/TaskPage'))`) and line 74 (`{activeView === 'tasks' ? <TaskPage /> : null}`). `src/renderer/src/components/sidebar/SidebarNav.tsx`: delete line 13 and line 121 (`<SidebarTaskNavButton />`). `src/renderer/src/app-shell/app-command-handlers.ts`: delete lines 245–254 (the whole `['view.tasks', () => { ... }],` tuple). `src/renderer/src/hooks/ipc-events/workspace-shortcut-ipc-bridge.ts`: delete lines 71–79 (the `unsubs.push(window.api.ui.onOpenTasks(...))` block). `src/renderer/src/components/contextual-tours/contextual-tour-step-actions.ts`: delete line 12 (`openTaskPage: () => void`) and lines 51–57 (the `case 'open-tasks':` block); `ContextualTourOverlay.tsx`: delete line 55 and line 370. `src/renderer/src/store/slices/ui/ui-slice-task-actions.ts`: delete lines 4–11 (the `normalizeVisibleTaskProviders…` import, the `PER_REPO_FETCH_LIMIT` import, the `isGitRepoKind` import and the `presetToQuery` import — all four become unused), line 13 (`const LINEAR_TASK_PREFETCH_LIMIT = 36`), and lines 107–181 (from the `// Why: prefetch the work-item list…` comment through the `}` that closes `if (resolvedSource === 'linear' …)`; line 182 `},` closes `openTaskPage` and stays). Keep `openTaskPage`, `closeTaskPage`, `taskPageData`, `taskResumeState` and the `'tasks'` nav-history entries unchanged (they are typed in `ui-slice-contract-core.ts`, a hot file). `src/renderer/src/lib/worktree-nav-view-history-replay.ts` stays unchanged. Also delete the `openTasks` keybinding definition object in `src/shared/keybindings/definitions-core-1.ts` lines 173–180 (`{ id: 'view.tasks', … }`), the `| { type: 'openTasks' }` member at `src/shared/window-shortcut-policy.ts:43`, the `if (actionMatches('view.tasks', …)) { return { type: 'openTasks' } }` block at lines 250–252 and the `case 'openTasks': return 'view.tasks'` pair at lines 330–331; `src/main/window/main-window-shortcut-actions.ts:51-53` (`case 'openTasks': … return`), `src/main/browser/browser-guest-shortcut-dispatch.ts:194-195` (`} else if (action?.type === 'openTasks') { renderer.send('ui:openTasks')`), `src/preload/api/ui-command-event-api.ts:78` and `src/preload/api/ui-bridge-state-and-menu-commands.ts:107-111` (`onOpenTasks`). Expected: `rg -n "view\.tasks|onOpenTasks|ui:openTasks|'openTasks'" src` prints nothing.

- [ ] **Step 4: Settings navigation and section renderers — delete lines only.** `src/renderer/src/hooks/settings-navigation-capability-sections.ts`: delete line 1 (`LinearIcon` import), lines 6–7 (`getIntegrationsPaneSearchEntries`, `getLinearAgentSkillPaneSearchEntries` imports), line 31 (`isLinearConnected` option), lines 79–95 (the `...(isLinearConnected ? [{ id: 'linear', … }] : []),` spread) and lines 190–199 (the `{ id: 'integrations', … },` object). `src/renderer/src/hooks/settings-navigation-workflow-sections.ts`: delete line 6 and line 107 (`...getGitProviderApiBudgetSearchEntries()`). `src/renderer/src/hooks/useSettingsNavigationMetadata.ts`: delete line 13 and the two lines that read `useLinearProviderConnected()` / pass `isLinearConnected`. `src/renderer/src/lib/settings-navigation-types.ts`: delete lines 17 (`'integrations',`), 21 (`'tasks',`), 46 (`'linear',`). `src/renderer/src/components/settings/settings-capability-section-renderers.tsx`: delete line 4 and lines 93–102 (the `<SettingsSection … 'linear' …>{view.isSectionMounted('linear') ? <LinearAgentSkillPane /> : null}</SettingsSection>` element). `settings-git-task-section-renderers.tsx`: delete lines 3–4, line 42 (`<GitProviderApiBudgetPane … />`) and lines 55–64 (the `'tasks'` `SettingsSection`). `settings-setup-workflow-section-renderers.tsx`: delete line 5 and lines 88–97 (the `'integrations'` `SettingsSection`). `use-settings-navigation-model.ts`: delete lines 9–12 and the three `getLinearAgentSkillNavInstallStatus` / `getAgentSkillNavInstallStatus` uses. `use-settings-store-model.ts`: delete line 21 and the two uses. `AccountsPane.tsx`: delete line 30 and lines 135–147 (the `remoteAccountScopeNotice` JSX element; replace with `const remoteAccountScopeNotice = null`). `CommitMessageAiPane.tsx`: delete line 31 and lines 323–330 (the `sections.push(<HostedReviewCreationDefaults … />)` call and its `const prDefaults` line). `RepositoryPane.tsx`: delete line 28 and lines 372–376. `RepositorySourceControlAiSection.tsx`: delete line 11 and lines 110–114. `RepositoryIconPicker.tsx`: delete lines 16–20 (import), lines 70–79 (`resolveUpstreamLive`, `resolveGitHubAvatar`), lines 81–105 (`handleUseGitHubAvatar`), lines 135–165 (the `githubIdentityRefreshedRef` effect) and replace lines 109–133 (`handleResetToDefault`) with:
  ```ts
  const handleResetToDefault = async () => {
    setResetting(true)
    try {
      updateRepo(repo.id, { repoIcon: null })
    } finally {
      if (mountedRef.current) {
        setResetting(false)
      }
    }
  }
  ```
  and delete the "Use GitHub avatar" button and the `loadingGitHub` state it drives. `src/renderer/src/components/cmd-j/palette-results.test.ts`: delete the `{ id: 'linear', … }` and `{ id: 'integrations', … }` fixture entries (lines 277–292) and the assertion at line 301. `src/renderer/src/hooks/useSettingsNavigationMetadata.test.ts`: delete `'integrations'` from the id lists at lines 44 and 144 and delete the `linear` tests at lines 66–83. Expected: `pnpm test src/renderer/src/hooks/useSettingsNavigationMetadata.test.ts src/renderer/src/components/cmd-j/palette-results.test.ts` passes.

- [ ] **Step 5: Right sidebar — drop the Checks and PR Checks tabs.** `right-sidebar-panel-content.tsx`: delete lines 8 and 12 (the two `lazy(...)` constants), line 30 (`{effectiveTab === 'checks' && <ChecksPanel />}`) and lines 38–42 (the `pr-checks` branch). `use-right-sidebar-activity-items.ts`: delete lines 86–92 (the `pr-checks` item), lines 100–106 (the `checks` item), line 35 (`const checksShortcut = useShortcutLabel('sidebar.checks.toggle')`) and `checksShortcut,` at line 119. `index.tsx`: delete line 10, line 43 (`checksStatus` selector), line 110 (`statusIndicator={item.id === 'checks' ? checksStatus : null}` → `statusIndicator={null}`) and line 166 (`checksStatus={checksStatus}`); `activity-bar-buttons.tsx:58`: delete the `checksStatus` prop and the expression. Keep `'checks' | 'pr-checks'` in the `ActiveRightSidebarTab` union (`src/renderer/src/store/slices/editor`, hot file); `src/renderer/src/store/slices/editor-right-sidebar-state.test.ts` continues to pass because the union member stays. `SourceControl.tsx`: delete line 4. `source-control-dropdown-items.ts`: delete line 8 and the `...buildHostedReviewDropdownItems(…)` spread. `source-control-primary-action.ts`: delete lines 9–12 and the two branches that call `resolveSupportedHostedReviewCopyProvider`/`localizedHostedReviewCopy` (the "Create PR"/"Create MR" primary actions); the remaining primary actions are commit/push/sync. `source-control/commit/use-commit-flows.ts`: delete line 2 and the `useSourceControlCreatePrIntentCommitMessage()` call and its returned field. `source-control/listing/use-worktree-context.ts`: delete lines 9–10 and the two cache-key computations. `source-control/listing/use-store-actions.ts`: delete lines 30, 31, 33, 37, 38, 40 (`createHostedReview`, `createStackedHostedReview`, `enqueueGitHubPRRefresh`, `fetchHostedReviewForBranch`, `fetchPRForBranch`, `getHostedReviewCreationEligibility`). `source-control/panel/commit-surface.tsx`: delete line 1 and the two `<CreateHostedReviewComposer … />` usages. `source-control/panel/header-toolbar.tsx`: delete line 13 and the `<HostedReviewHeaderLink …/>` / `<HostedReviewIcon …/>` usages. `source-control/panel/use-panel-foundation.ts`: delete line 4 and the `useSourceControlReviewContext()` call. `source-control/panel/use-panel-model.ts`: delete lines 8–11 and the four hook calls plus the fields they contribute. `source-control/panel/use-worktree-operation-state.ts`: delete lines 8–11, the `CreatePrIntentRunToken` state and the `createPrIntentCurrentTargetConflictsWithToken` check. `source-control-dropdown-items.test.ts`: delete lines 4–7 and the two tests that use them. `right-sidebar-titlebar-drag-regions.render.test.tsx`: delete the `vi.mock('./FolderWorkspacePrChecksPanel' …)` and `vi.mock('./ChecksPanel' …)` blocks (lines 163–172). Expected: `pnpm test src/renderer/src/components/right-sidebar` passes.

- [ ] **Step 6: App-shell GitHub refresh hooks.** `src/renderer/src/app-shell/use-window-visibility-effects.ts`: delete line 5 (import), line 9 (`const actions = useAppStore(selectWindowVisibilityActions)`) and lines 11–22 (the first `useEffect` that calls `refreshAllGitHub`/`bumpGitHubPRVisibleRefreshGeneration`/`reportVisibleGitHubPRRefreshCandidates`). `startup-actions-selector.ts`: delete line 16 (`| 'initGitHubCache'`), line 53 (`cachedStartupActions.initGitHubCache === state.initGitHubCache &&`) and line 88. `use-app-startup-hydration.ts`: delete line 360 (`void actions.initGitHubCache()`). `store/slices/agent-status-live-actions.ts:180`: delete the line `queueMicrotask(() => get().refreshGitHubForWorktreeIfStale(worktreeId))`. `store/slices/worktrees/session/set-active-worktree.ts:266`: delete `get().refreshGitHubForWorktreeIfStale(worktreeId)`. `store/slices/editor/actions/git-remote-push-pull.ts`: delete lines 66–69, 88–91, 110–113 (each `const refreshGitHubForWorktree = get().refreshGitHubForWorktree` + `if (typeof … === 'function') { refreshGitHubForWorktree(worktreeId) }` block); `git-remote-sync.ts`: delete lines 81–84 and 111–114. `store/slices/worktrees/session/worktree-unread-activity.ts`: delete line 6 and the `void refreshHostedReviewCard(fetchHostedReviewForBranch, {…})` statement at line 160 (and the `fetchHostedReviewForBranch` read it uses). `store/repos/repo-removal.ts`: delete lines 103–105 (`get().evictGitHubRepoCaches(projectId, repoPath)`, the dynamic `import('../../lib/repo-slug-index')` and the `clearRepoSlugCacheEntry(...)` call). `hooks/ipc-events/project-catalog-ipc-bridge.ts`: delete lines 94–99 (the `if (window.api.gh?.onPRRefreshEvent) { unsubs.push(window.api.gh.onPRRefreshEvent((event) => { useAppStore.getState().applyGitHubPRRefreshEvent(event) })) }` block). `hooks/composer-state/provider-runtime-sync.ts`: replace lines 235–245 (`const slugRequest = target.kind === 'environment' ? callRuntimeRpc<…>(target, 'github.repoSlug', …) : (window.api.gh.repoSlug(…) as Promise<…>)`) with `const slugRequest = Promise.resolve<GitHubRepositoryIdentity | null>(null)`; delete the now-unused `callRuntimeRpc`/`getActiveRuntimeTarget` imports if `pnpm tc:web` reports them unused. `hooks/composer-state/composer-target-store.ts`: delete lines 76, 94 and 197 (`prefetchWorkItems`). `store/slices/agent-status-batch.test.ts:199-200`: delete both `expect(...refreshGitHubForWorktreeIfStale)` lines. `hooks/ipc-events/runtime-client-ipc-bridge-ownership.test.ts:135`: delete the `linearIssueCache` comparison branch. `store/slices/settings.test.ts:439-447`: delete the three `expect(store.getState().prCache | linearIssueCache | jiraIssueCache).toEqual({...})` assertions. Expected: `pnpm test src/renderer/src/app-shell src/renderer/src/store/slices/agent-status-batch.test.ts src/renderer/src/store/slices/settings.test.ts` passes.

- [ ] **Step 7: Sidebar PR status, PR grouping inputs, and dashboard/status-bar cache readers.** `components/sidebar/WorktreeList.tsx`: delete line 18 and replace lines 94–96 with `const prCache = null` and `const hostedReviewCache = null`; keep lines 134, 166 and 340–341 as they are (they now pass `null`). `rendered-sidebar-worktree-order.ts`: delete line 17 and replace lines 50–54 with `const prCache = null`. Change the type `AppState['prCache'] | null` → `Record<string, unknown> | null` and `AppState['hostedReviewCache'] | null` → `Record<string, unknown> | null` in `worktree-list/listing/use-collapsed-groups.ts:27`, `worktree-list/listing/use-section-rows.ts:34`, `worktree-list/navigation/pending-reveal-inputs.ts:43`, `worktree-list/rows/folder-row.tsx:34`, `worktree-list/viewport/viewport-props.ts:78`, and `components/cmd-j/worktree-palette-cache-inputs.ts:4-6,17` (also replace its `Pick<AppState, 'prCache' | 'issueCache' | 'hostedReviewCache'>` parameter with `_state: unknown` and return `EMPTY_WORKTREE_PALETTE_CACHE_INPUTS` unconditionally; update `worktree-palette-cache-inputs.test.ts` to assert the empty object). `components/use-worktree-jump-palette-worktrees.ts`: delete line 11 and the `buildWorktreeChecksReviewIndex({…})` call at line 231 (pass an empty `Map()` / the type the consumer expects — `pnpm tc:web` names the field). `components/sidebar/WorkspaceKanbanDrawer.tsx`: delete line 12 and the `const maybeSyncWorkspaceBoardTaskStatuses = useWorkspaceBoardTaskStatusSync({…})` hook call at line 120 together with every `maybeSyncWorkspaceBoardTaskStatuses(` call in the file (board status changes no longer push to Linear). `worktree-list/grouping/group-keys.ts`: delete lines 14–17 (imports) and replace lines 108–150 (`getPRGroupKey`) with:
  ```ts
  export function getPRGroupKey(
    _worktree: Worktree,
    _repoMap: Map<string, Repo>,
    _prCache: Record<string, unknown> | null,
    _settings?: AppState['settings']
  ): PRGroupKey {
    // Why: without a forge there is never a PR entry, which the original function mapped to 'in-progress'.
    return 'in-progress'
  }
  ```
  (`PRGroupKey = 'done' | 'in-review' | 'in-progress' | 'closed'` at line 21 is unchanged; `PR_GROUP_ORDER` stays; also delete the now-unused `isGitHubPRSuppressed` import at the top of the file). `worktree-list/rows/folder-row.tsx`: delete line 18 and the `getFolderWorkspaceCardPrDisplay(...)` call (render nothing for the PR slot). `worktree-list/viewport/VirtualizedWorktreeViewport.tsx`: delete line 15 and the `useVisiblePrRefreshReporting(...)` call. `worktree-list/viewport/use-row-measurement.ts`: delete lines 52–53 and remove `prCacheLen, issueCacheLen` from the dependency array at line 99. `worktree-list-lineage-store-state.ts:120` and `worktree-list-pinned-store-state.ts:47`: delete the `prCache: {},` fixture line. `WorktreeCardMeta.tsx`: delete lines 18 and 28 and the `<WorktreeCardReviewDetailSection …/>` element and the `getReviewLabel(...)` use. `WorktreeCardMetaBadges.tsx:7` and `WorktreeCardStatusSlot.tsx:12`: delete the import and the `ReviewIcon`/`getReviewLabel` JSX they feed (the PR badge). `WorktreeMetaDialog.tsx`: delete lines 22 and 36, the `useWorktreeIssueLink(...)` call and the `<WorktreeReviewLinkField …/>` elements. `use-worktree-card-foundation.ts`: delete lines 39, 41, 42, 213, 215, 216. `use-worktree-card-controller.ts:8`, `use-worktree-card-lifecycle-effects.ts:11`, `use-worktree-card-linked-details.ts:16`, `use-worktree-card-secondary-details.ts:13`, `use-worktree-card-workspace-actions.ts:12`: delete the import and the `reviewDetails` parameter/field each one threads (`pnpm tc:web` names each site). `worktree-card-secondary-rows.tsx:8`: delete the import and the two `<LinearAgentSkillSetupPrompt …/>` elements. `components/activity/activity-thread-hover-card.tsx`: delete lines 18, 25, 29 and the review-detail section they render. `components/status-bar/use-workspace-space-manager-bindings.ts`: delete lines 36–38 and 90–92. `components/status-bar/workspace-space-decision-details.ts`: delete lines 14–15, the `hostedReviewCache`/`issueCache`/`settings` input fields (lines 53–70) and the two lookups at lines 133–162 (the decision details no longer show PR/issue titles). `components/workspace-cleanup/use-workspace-cleanup-facet-rows.ts`: delete line 102 and `hostedReviewCache` from lines 115, 126, 130. `workspace-cleanup-presentation.ts:1` (+ use), `workspace-cleanup-candidate-row.tsx:42-45` (+2 uses), `workspace-cleanup-confirm-remove.tsx:22` (+1): delete the import and the review-state icon/tone rendering. `components/dashboard/dashboard-card-context.ts`: delete lines 2, 13–17 and the three cache lookups (the card context no longer carries a PR field; `dashboard-popout/AgentKanbanCard.tsx` does not import this module, so no popout edit is needed). `useLiveDashboardSnapshot.ts`: delete lines 30–31, 84–85, 127–128. `useDashboardPopoutBridge.ts`: delete lines 58–59. `components/cmd-j/PaletteCreateWorktreeRow.tsx:7` (+2 uses), `use-worktree-jump-palette-controller.ts:14` (+1), `use-worktree-jump-palette-create-action.ts:11` (+1), `use-worktree-jump-palette-local-state.ts:9` (+1), `worktree-jump-palette-create-worktree.ts:7,25` (+2), `lib/worktree-palette-search.ts:32-35` (+2), `lib/worktree-palette-document.ts:2,98-109`: delete the task-URL/work-item lookups (the palette no longer creates worktrees from a pasted issue/PR URL; the `title` lookup in `worktree-palette-document.ts` returns `''`). `components/editor/CheckRunDetailsPanel.tsx:9` (+1): delete the "Fix with AI" hook and button. `components/automations/use-automation-source-host-availability.ts:8-11` (+2): delete the import and return `{ available: false }` from the repo-backed branch. `components/feature-wall/FeatureWallBody.tsx:18` (+3), `FeatureWallSetupChecklist.tsx:17` (+2), `FeatureWallTourSurface.tsx:25` (+1), `use-feature-wall-completion.ts:51-52` (replace with `const githubConfigured = false`), `components/setup-guide/use-setup-guide-progress.ts:24` (+1): delete the integration rows/checklist. `components/new-workspace/smart-workspace-name-field-surface.tsx:12` (+1), `smart-workspace-repo-slug.ts:3-6` (+2), `use-smart-workspace-name-field-actions.ts:5,13` (+2), `use-smart-workspace-name-field-controller.ts:16-17` (+2), `use-smart-workspace-name-field-foundation.ts:11-12` (+2), `use-smart-workspace-secondary-searches.ts:3` (+1), `use-smart-workspace-field-availability.ts:76` (replace with `const localGitlabAvailable = false`): delete the provider searches. `hooks/composer-state/composer-external-sync.ts:6` (+1), `composer-source-state.ts:9` (+1), `linked-item-lookup-effects.ts:33-36` (+2), `hooks/ipc-events/new-workspace-command.ts:1` (+1), `composer-name-source-selection.test.ts:7`: delete the GitHub lookup/selection hooks and the Linear linked-item builder call. `components/sidebar/WorkspaceKanbanDrawer.search.test.tsx:161-162`: delete the `vi.mock('./workspace-board-task-status-sync' …)` block. `store/slices/worktrees/metadata/update-worktree-meta.ts`: delete lines 8–9 and replace lines 167–240 (from `const cacheKey =` through the final `return { … }`) with:
  ```ts
      if (
        nextWorktrees === s.worktreesByRepo &&
        nextDetectedWorktrees === s.detectedWorktreesByRepo
      ) {
        return s
      }
      return {
        ...(nextWorktrees !== s.worktreesByRepo
          ? { worktreesByRepo: nextWorktrees, sortEpoch: s.sortEpoch + 1 }
          : {}),
        ...(nextDetectedWorktrees !== s.detectedWorktreesByRepo
          ? { detectedWorktreesByRepo: nextDetectedWorktrees }
          : {})
      }
  ```
  `store/slices/worktrees-metadata-persistence.test.ts:5-6` and `store/slices/repos.test.ts:3`: delete the imports and the assertions that read `prCache`/`hostedReviewCache`/`workItemsCache` keys. Expected: `pnpm tc:web` passes.

- [ ] **Step 8: Preflight-shape consumers in the renderer (status becomes `{ git: { installed } }`).** `components/landing-preflight-issues.ts`: delete line 18 (`gh: { installed: boolean; authenticated: boolean }`) and lines 55–77 (the `if (!status.gh.installed) {…} else if (!status.gh.authenticated) {…}` chain); `landing-preflight-issues.test.ts`: delete the `gh:` lines at 20, 28 and the test at 52–60 that expects `gh-auth`; `landing-preflight-runtime-boundary.test.ts:14`: delete the `gh:` line. `components/onboarding/OnboardingFlow.test.tsx:138,164,192`: delete the `gh:` lines. `store/slices/preflight.test.ts`: delete the `gh:`/`glab:` fixture lines (72–73) and the eight `expect(...preflightStatus?.glab?.installed)` assertions (134, 173, 189, 325, 363, 411, 426, 454). `store/slices/ui/ui-slice-task-actions.ts` already lost its `glab` read in Step 3. Expected: `pnpm test src/renderer/src/components/landing-preflight-issues.test.ts src/renderer/src/store/slices/preflight.test.ts` passes (the extra fields are optional on the renderer side until Task U10.2/U10.3 narrow the type — run them again after U10.3).

- [ ] **Step 9: Onboarding integrations step (TDD).** Add to `src/renderer/src/components/onboarding/use-onboarding-flow.test.ts`:
  ```ts
  import { shouldSkipIntegrationsStep, getGitHubTaskSourceStatus } from './onboarding-flow-state'

  describe('local-only onboarding', () => {
    // Why the gh field: the preload status type still carries it until Task U10.2 Step 4, which deletes these two `gh:` lines.
    it('always skips the integrations step', () => {
      expect(
        shouldSkipIntegrationsStep({ git: { installed: true }, gh: { installed: false, authenticated: false } })
      ).toBe(true)
      expect(shouldSkipIntegrationsStep(null)).toBe(true)
    })
    it('reports the GitHub task source as not installed', () => {
      expect(
        getGitHubTaskSourceStatus({ git: { installed: true }, gh: { installed: true, authenticated: true } }, false)
      ).toBe('not_installed')
    })
  })
  ```
  Run `pnpm test src/renderer/src/components/onboarding/use-onboarding-flow.test.ts` — expected RED (`shouldSkipIntegrationsStep` returns `false`). Then in `onboarding-flow-state.ts` replace lines 19–21 with `export function shouldSkipIntegrationsStep(_status: AppState['preflightStatus']): boolean { return true }`, replace the body of `getGitHubTaskSourceStatus` (lines 57–68) with `return 'not_installed'` (keep the signature) and the body of `getLinearTaskSourceStatus` (lines 70–78) with `return 'not_connected'`. `use-onboarding-flow.ts`: delete lines 46–47 (`linearStatus`, `linearStatusChecked` selectors) and pass `linearStatus: { connected: false }, linearStatusChecked: true` at lines 251–252. `OnboardingFlow.tsx`: delete line 10 and line 332 (`{currentStep.id === 'integrations' && <IntegrationsStep />}`); keep the `integrations` copy objects (lines 62–68, 113–117) and `StepId`/`STEPS` so persisted v4 progress still resumes. Run the test again — expected GREEN. Also run `pnpm test src/renderer/src/components/onboarding`.

- [ ] **Step 10: i18n tests, gates and config references.** `src/renderer/src/i18n/settings-status-label-localization.test.ts`: delete lines 55–56 (the `LinearAgentSkillGuide.setupUnverified` entry). `technical-literal-catalog-values.test.ts:28`: delete the `['zh', 'auto.components.github.IssueSourceSelector.643d7e9496'],` row. Locale catalogs (`src/renderer/src/i18n/locales/*.json`, `en-runtime-required.json`) are NOT edited: `verify:localization-extraction` reports orphaned English keys without failing, and leaving them avoids upstream catalog conflicts. `config/reliability-gates.jsonc`: in gate `cmd-j-tabs.host-qualified-candidate-ownership` delete the `testFiles` entry, the `commands` entry and the `assertionRefs` block that name `src/renderer/src/components/cmd-j/worktree-checks-review-index.test.ts` (keep the gate). `config/scripts/check-changed-code-quality.mjs`: delete lines 58–59. `package.json`: delete the override block whose `files` are `src/renderer/src/components/use-task-page-github-issue-draft.ts` and `use-task-page-jira-creation-state.ts` (lines 355–362). Expected: `pnpm run check:reliability-gates` and `pnpm run verify:localization-catalogs && pnpm run verify:localization-extraction && pnpm run verify:localization-coverage` pass; if `verify:localization-runtime-catalog` fails, run `pnpm run sync:localization-runtime-catalog` and commit the regenerated `en-runtime-required.json`.

- [ ] **Step 11: Verify.** `pnpm tc:web` → no errors. `pnpm test src/renderer src/shared/keybindings src/main/window src/main/browser` → no new failing files versus `notes/local-only/before/failing-files.txt`. `pnpm run check:code-quality:changed` → passes. `rg -l "api\.(gh|gl|hostedReview|bitbucket|linear|jira)\b" src/renderer/src --glob '!src/renderer/src/web/**'` → prints nothing.

- [ ] **Step 12: Commit.**
  ```
  refactor(local-only): remove renderer git-provider surfaces and store slices

  Deletes the task page, PR page, checks panel, GitHub/GitLab item dialogs,
  Linear/Jira workspaces, integrations settings, sidebar PR status and the
  github/hosted-review/linear/jira store slices. Pure shared types and
  renderer parsers stay (U10 scope rule 2).

  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01PskLbdTqJNXxJ7KRnDoDoD
  ```

---

### Task U10.2: Remove the preload provider bridges

**Files:**
Delete: `src/preload/gitlab.ts`, `src/preload/api/bitbucket-bridge.ts`, `src/preload/api/gh-bridge-mutations-and-projects.ts`, `src/preload/api/gh-bridge-pull-requests-and-work-items.ts`, `src/preload/api/gh-bridge.ts`, `src/preload/api/github-account-api.ts`, `src/preload/api/github-pull-request-api.ts`, `src/preload/api/github-work-item-api.ts`, `src/preload/api/gitlab-api.ts`, `src/preload/api/gl-bridge.ts`, `src/preload/api/hosted-review-api.ts`, `src/preload/api/hosted-review-bridge.ts`, `src/preload/api/jira-api.ts`, `src/preload/api/jira-bridge.ts`, `src/preload/api/linear-api.ts`, `src/preload/api/linear-bridge.ts`.
Modify: `src/preload/index.ts:27-32,122-127`, `src/preload/api-types.ts:32-38,89-94`, `src/preload/api/worktree-api.ts:38,73-91`, `src/preload/api/worktrees-bridge.ts:46,48`, `src/preload/api/preflight-api.ts:10-27`, `src/preload/api/preflight-bridge.ts:10-27`, `config/tsconfig.tc.web.json:13`, `src/renderer/src/components/onboarding/use-onboarding-flow.test.ts` (drop the two `gh:` fields added in U10.1 Step 9).
Keep: `src/preload/api/workspace-session-api.ts` (`cache.getGitHub/setGitHub` read a local persisted cache), `src/preload/api/cache-bridge.ts`, `src/preload/api/repository-api.ts:2` (type import from kept `src/shared/github/account-binding`).

**Interfaces:** Consumes: Task U10.1 (no renderer caller of the removed namespaces). Produces: `window.api` without `gh`, `hostedReview`, `gl`, `bitbucket`, `linear`, `jira`; `window.api.worktrees` without `resolvePrBase`/`resolveMrBase`; `PreflightStatus` in preload typed as `{ git: { installed: boolean } }` (Task U10.3 makes main match).

- [ ] **Step 1: Delete the bridge files.** `git rm -q src/preload/gitlab.ts src/preload/api/bitbucket-bridge.ts src/preload/api/gh-bridge-mutations-and-projects.ts src/preload/api/gh-bridge-pull-requests-and-work-items.ts src/preload/api/gh-bridge.ts src/preload/api/github-account-api.ts src/preload/api/github-pull-request-api.ts src/preload/api/github-work-item-api.ts src/preload/api/gitlab-api.ts src/preload/api/gl-bridge.ts src/preload/api/hosted-review-api.ts src/preload/api/hosted-review-bridge.ts src/preload/api/jira-api.ts src/preload/api/jira-bridge.ts src/preload/api/linear-api.ts src/preload/api/linear-bridge.ts`.

- [ ] **Step 2: `src/preload/index.ts` — delete lines only.** Delete lines 27–32:
  ```ts
  import { ghApi } from './api/gh-bridge'
  import { hostedReviewApi } from './api/hosted-review-bridge'
  import { glApiBridge } from './api/gl-bridge'
  import { bitbucketApi } from './api/bitbucket-bridge'
  import { linearApi } from './api/linear-bridge'
  import { jiraApi } from './api/jira-bridge'
  ```
  and lines 122–127 inside `const api = {`:
  ```ts
    gh: ghApi,
    hostedReview: hostedReviewApi,
    gl: glApiBridge,
    bitbucket: bitbucketApi,
    linear: linearApi,
    jira: jiraApi,
  ```

- [ ] **Step 3: `src/preload/api-types.ts` — delete lines only.** Delete lines 32–38 (the seven `import type … from './api/github-account-api' | github-pull-request-api | github-work-item-api | gitlab-api | hosted-review-api | jira-api | linear-api` lines) and lines 89–94 (`gh: Merged<…>`, `hostedReview: HostedReviewApi`, `gl: GitLabApi`, `bitbucket: BitbucketApi`, `linear: LinearApi`, `jira: JiraApi`). If `Merged` becomes unused, delete its declaration too.

- [ ] **Step 4: Worktree review-base IPC and preflight shape.** Delete the two `gh: { installed: …, authenticated: … }` fields from the `local-only onboarding` tests added in Task U10.1 Step 9 (`src/renderer/src/components/onboarding/use-onboarding-flow.test.ts`). `src/preload/api/worktree-api.ts`: delete line 38 (`GitHubPrStartPoint,` in the type import) and lines 73–91 (`resolvePrBase: …` and `resolveMrBase: …` members). `src/preload/api/worktrees-bridge.ts`: delete lines 46 and 48 (`resolvePrBase:` / `resolveMrBase:`). `src/preload/api/preflight-api.ts`: replace lines 10–27 (the `gh`, `glab?`, `bitbucket?`, `azureDevOps?`, `gitea?` members) so the status type is exactly `{ git: { installed: boolean } }`; same edit in `src/preload/api/preflight-bridge.ts:10-27`. `config/tsconfig.tc.web.json`: delete line 13 (`"../src/preload/gitlab.ts",`).

- [ ] **Step 5: Verify.** `pnpm tc` → no errors in `src/preload` (main still compiles because its handlers are untouched). `pnpm test src/preload` → passes. `rg -n "gh-bridge|hosted-review-bridge|gl-bridge|bitbucket-bridge|linear-bridge|jira-bridge|preload/gitlab" src config` → prints nothing.

- [ ] **Step 6: Commit.**
  ```
  refactor(local-only): remove preload git-provider bridges

  Drops the gh/gl/hostedReview/bitbucket/linear/jira window.api namespaces,
  the worktree resolvePrBase/resolveMrBase IPC and the provider fields of
  the preflight status type.

  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01PskLbdTqJNXxJ7KRnDoDoD
  ```

---

### Task U10.3: Remove the main-process IPC handlers, RPC methods, CLI subcommands and preflight probes

**Files:**
Delete: `src/main/ipc/` (45): `bitbucket.ts filesystem-pull-request-field-generation.test.ts filesystem-pull-request-linked-issue-lifetime.test.ts github-account-handlers.ts github-ipc-module-mocks.ts github-ipc-test-harness.ts github-issue-mutation-handlers.ts github-issue-source-preference.test.ts github-pr-mutation-handlers.ts github-pr-read-handlers.ts github-pr-refresh-handlers.ts github-pr-refresh-routing.test.ts github-pr-review-handlers.ts github-project-view-handlers.ts github-repo-access-guards.test.ts github-repo-routing.ts github-ssh-connection-routing.test.ts github-star-telemetry.test.ts github-work-item-args.test.ts github-work-item-args.ts github-work-item-handlers.ts github-work-item-mutation-events.ts github-wsl-runtime-routing.test.ts github.ts gitlab-ci-job-handlers.ts gitlab-issue-handlers.ts gitlab-merge-request-mutation-handlers.ts gitlab-merge-request-query-handlers.ts gitlab-repo-access.test.ts gitlab-repo-access.ts gitlab-work-item-handlers.ts gitlab.test.ts gitlab.ts hosted-review.test.ts hosted-review.ts jira-cancellable-requests.test.ts jira-cancellable-requests.ts jira.ts linear-custom-view-handlers.ts linear-ipc-args.ts linear-issue-handlers.ts linear-project-handlers.ts linear-team-handlers.ts linear.test.ts linear.ts`; `src/main/ipc/worktrees/create/register-review-base-handlers.ts`; `src/main/runtime/rpc/methods/` (25): `github-account-binding-methods.ts github-issue-methods.ts github-issue-update-schema.ts github-pr-refresh-reason.test.ts github-project-methods.ts github-pull-request-methods.ts github-pull-request-update-methods.ts github-repo-target-schemas.ts github-repo-work-item-methods.ts github.test.ts github.ts gitlab.test.ts gitlab.ts hosted-review.test.ts hosted-review.ts jira.test.ts jira.ts linear-agent-access.test.ts linear-agent-access.ts linear-agent-project-access.test.ts linear-issue-attribute-filter-schema.ts linear-issue-list-method.ts linear-project-create.ts linear.test.ts linear.ts`; `src/shared/rpc-contract/` (16): `github-account-binding-params.ts github-issue-params.ts github-issue-update-params.ts github-project-params.ts github-pull-request-params.ts github-pull-request-update-params.ts github-repo-target-params.ts github-repo-work-item-params.ts gitlab-params.ts hosted-review-params.ts jira-params.ts linear-agent-access-params.ts linear-issue-attribute-filter-params.ts linear-issue-list-params.ts linear-params.ts linear-project-create-params.ts`; `src/cli/` : `handlers/linear.ts handlers/linear.test.ts handlers/linear-list-issues.ts handlers/linear-relation-write.ts handlers/linear-save-issue.ts linear-format.ts linear-format.test.ts linear-request-builders.ts linear-save-issue-request.ts`; `src/main/ssh/ssh-remote-linear-relation-write.test.ts`.
Create: `src/shared/rpc-contract/repo-selector-params.ts` (moved `RepoSelector`).
Modify: `src/main/ipc/register-core-handlers/register-core-handlers.ts:12-17,157-162`, `src/main/ipc/register-core-handlers/register-core-handlers.test.ts:189-190,372-389`, `src/main/ipc/worktrees.ts:7,91`, `src/main/ipc/worktrees-test-runtime-stub.ts:14,41`, `src/main/runtime/rpc/methods/index.ts:26-31,86-91`, `src/main/runtime/rpc/methods/repo.ts:4`, `src/main/runtime/rpc/methods/worktree.ts:21-22,192-214`, `src/shared/rpc-contract/repo-params.ts:4`, `src/shared/rpc-contract/worktree-params.ts:192-215`, `src/shared/rpc-contract/rpc-params-catalog.generated.ts` (regenerated), `src/shared/protocol-version.ts:68-72`, `src/main/runtime/orca-runtime-tests/runtime-availability.spec.ts:50`, `src/cli/handler-group-manifest.ts:213-245`, `src/main/preflight/agent-detection.ts:13-16,32-36,50-74,256-290,368-396`, `src/main/ipc/preflight-agent-detection.test.ts:78-87`, `src/main/ipc/preflight-agent-detection-no-subprocess.test.ts:52-56`, `src/main/ipc/preflight-agent-refresh.test.ts:78-87`, `src/main/ipc/preflight-host-cli-status.test.ts:78-87`, `src/main/ipc/preflight-remote-ssh.test.ts:76-85`, `src/main/global-fetch-call-site-audit.test.ts:19-22,33`.

**Interfaces:** Consumes: Task U10.2 (no preload caller). Produces: `RepoSelector` exported from `src/shared/rpc-contract/repo-selector-params.ts`; `PreflightStatus = { git: { installed: boolean } }` from `src/main/preflight/agent-detection.ts`; RPC dispatcher without `github.*`, `gitlab.*`, `hostedReview.*`, `linear.*`, `jira.*`, `worktree.resolvePrBase`, `worktree.resolveMrBase`; `orca linear …` CLI group removed. Task U10.4 relies on `src/main/runtime/runtime-*-commands.ts` still existing at the end of this task (they are now unreferenced by RPC but still installed on the runtime).

- [ ] **Step 1: Delete the handler, method, params and CLI files.** `git rm -q` every path in the Delete list (all exact). Then `git rm -q src/main/ipc/worktrees/create/register-review-base-handlers.ts`.

- [ ] **Step 2: Registration sites — delete lines only.** `src/main/ipc/register-core-handlers/register-core-handlers.ts`: delete lines 12–17 (`import { registerGitHubHandlers } from '../github'` … `import { registerBitbucketHandlers } from '../bitbucket'`) and lines 157–162 (`registerGitHubHandlers(store, stats)` … `registerBitbucketHandlers()`); leave line 11 and line 148 (`registerUsageProviderHandlers`, U9) untouched. `register-core-handlers.test.ts`: delete the `vi.mock('../github' …)` block at 189–190 and the five blocks at 372–389 (`../linear`, `../jira`, `../bitbucket`, `../gitlab`, `../hosted-review`). `src/main/ipc/worktrees.ts`: delete line 7 and line 91 (`registerReviewBaseHandlers(context)`). `src/main/ipc/worktrees-test-runtime-stub.ts`: delete line 14 (`resolveManagedMrBase: ReturnType<typeof vi.fn>`) and line 41. `src/main/runtime/rpc/methods/index.ts`: delete lines 26–31 (`GITHUB_METHODS`, `GITLAB_METHODS`, `HOSTED_REVIEW_METHODS`, `LINEAR_METHODS`, `LINEAR_AGENT_ACCESS_METHODS`, `JIRA_METHODS` imports) and lines 86–91 (the six spreads). `src/main/runtime/rpc/methods/worktree.ts`: delete lines 21–22 (`WorktreeResolveMrBase,` `WorktreeResolvePrBase,`) and lines 192–214 (the `worktree.resolvePrBase` and `worktree.resolveMrBase` `defineMethod` blocks). `src/shared/rpc-contract/worktree-params.ts`: delete the `WorktreeResolvePrBase` (192–204) and `WorktreeResolveMrBase` (206–215) schemas. `src/cli/handler-group-manifest.ts`: delete lines 213–245 (the `{ name: 'linear', keys: [...], load: … LINEAR_HANDLERS }` entry). `src/shared/protocol-version.ts`: delete lines 68–69 (`LINEAR_ISSUE_ATTRIBUTE_FILTER_RUNTIME_CAPABILITY`) and lines 70–72 (`JIRA_USER_FIELDS_RUNTIME_CAPABILITY`, `JIRA_USER_FIELDS_UPDATE_REQUIRED_MESSAGE`) together with the places that register those capabilities (`rg -n "LINEAR_ISSUE_ATTRIBUTE_FILTER_RUNTIME_CAPABILITY|JIRA_USER_FIELDS_RUNTIME_CAPABILITY" src` — each is a single list element to delete); `src/main/runtime/orca-runtime-tests/runtime-availability.spec.ts:50`: delete `expect(status.capabilities).toContain('linear.issue-attribute-filter.v1')`.

- [ ] **Step 3: Preflight probes (TDD).** Append to `src/main/ipc/preflight-agent-detection.test.ts` inside `describe('preflight', …)`:
  ```ts
  it('reports only the git binary and spawns no forge CLI auth probes', async () => {
    const seen: string[] = []
    execFileAsyncMock.mockImplementation(async (command, args) => {
      seen.push([String(command), ...args.map(String)].join(' '))
      return { environmentResolved: true, code: 0, stdout: '/usr/bin/git\n', stderr: '', timedOut: false }
    })
    const status = await runPreflightCheck(true)
    expect(status).toEqual({ git: { installed: true } })
    expect(seen.some((line) => /\b(gh|glab) auth status\b/.test(line))).toBe(false)
  })
  ```
  (`runPreflightCheck(force = false, context?)` is exported at `agent-detection.ts:291`; import it the way the file's existing tests import `detectInstalledAgents` at line 92.) Run `pnpm test src/main/ipc/preflight-agent-detection.test.ts` — expected RED (`gh`/`glab` keys present, `bitbucket`/`azureDevOps`/`gitea` mocks invoked). Then edit `src/main/preflight/agent-detection.ts`: delete lines 13–16 (the four provider imports), replace lines 50–74 with `export type PreflightStatus = { git: { installed: boolean } }`, delete `isGhAuthenticated` (256–274) and `isGlabAuthenticated` (275–290), delete the now-unused helper imports at lines 32–33 and 36 (`execCommandInWslOrThrow`, `execLocalPreflightCommandOrThrow`, `shellQuote` — their only callers were the two deleted probes), delete the `_resetKnownHostsCache()` call and its comment (inside `executePreflightCheck`), and replace lines 376–396 with:
  ```ts
    const gitProbe = await detectCommandRuntime('git', context)
    return { git: { installed: gitProbe.installed } }
  ```
  Delete the `vi.mock('../bitbucket/client' …)`, `vi.mock('../azure-devops/client' …)`, `vi.mock('../gitea/client' …)` blocks in `preflight-agent-detection.test.ts:78-87`, `preflight-agent-detection-no-subprocess.test.ts:52-56`, `preflight-agent-refresh.test.ts:78-87`, `preflight-host-cli-status.test.ts:78-87`, `preflight-remote-ssh.test.ts:76-85`, and any assertion in those files on `gh`/`glab`/`bitbucket`/`azureDevOps`/`gitea` (`rg -n "gh\b|glab|bitbucket|azureDevOps|gitea" src/main/ipc/preflight-*.test.ts`). Run the five preflight test files — expected GREEN.

- [ ] **Step 4: Move `RepoSelector` out of the GitHub params file.** Create `src/shared/rpc-contract/repo-selector-params.ts`:
  ```ts
  import { z } from 'zod'
  import { requiredString } from './rpc-param-primitives'

  export const RepoSelector = z.object({
    repo: requiredString('Missing repo selector')
  })
  ```
  `src/shared/rpc-contract/repo-params.ts:4`: change `from './github-repo-target-params'` to `from './repo-selector-params'`. `src/main/runtime/rpc/methods/repo.ts:4`: replace `import { RepoSelector } from './github-repo-target-schemas'` with `import { RepoSelector } from '../../../../shared/rpc-contract/repo-selector-params'`. (`SlugRepo` had no kept importer and goes with the deleted file.)

- [ ] **Step 5: Regenerate the RPC params catalog.** Run `pnpm run generate:rpc-params-catalog`; commit the regenerated `src/shared/rpc-contract/rpc-params-catalog.generated.ts` (never hand-edit). Expected: `pnpm run verify:rpc-params-catalog` passes and the catalog has no `github.`, `gitlab.`, `hostedReview.`, `linear.`, `jira.`, `worktree.resolvePrBase` or `worktree.resolveMrBase` keys. If the generator refuses the new module, the fix is to import `RepoSelector` in `repo.ts` the way the generator's `RPC_DIR` scan expects (it bundles every params module the dispatcher imports).

- [ ] **Step 6: Fetch-audit ratchet.** `src/main/global-fetch-call-site-audit.test.ts`: delete lines 19, 20, 21, 22 (`main/azure-devops/azure-devops-api-request.ts`, `main/bitbucket/client.ts`, `main/bitbucket/user-request.ts`, `main/gitea/client.ts`) and line 33 (`main/source-control/hosted-review-api-request.ts`). The audited files are deleted in Task U10.4; the audit test enumerates files on disk, so this edit is prepared here and exercised by `pnpm test src/main/global-fetch-call-site-audit.test.ts` after U10.4 Step 1 (until then the test still passes because the files and their single `fetch(` line are both present only if the entries are present — keep this edit in the same commit as U10.4 if the test fails here).

- [ ] **Step 7: Verify.** `pnpm tc` → no errors. `pnpm test src/main/ipc src/main/runtime/rpc src/cli src/shared/rpc-contract src/main/runtime/orca-runtime-tests/runtime-availability.spec.ts` → no new failing files versus baseline. `pnpm run verify:rpc-params-catalog` → passes. `node out/cli/index.js linear status set 2>&1 | head -1` (after `pnpm build:cli`) → prints the unknown-command error.

- [ ] **Step 8: Commit.**
  ```
  refactor(local-only): remove git-provider IPC handlers, RPC methods and CLI

  Unregisters the GitHub/GitLab/hosted-review/Linear/Jira/Bitbucket IPC and
  RPC surfaces, the `orca linear` CLI group, the PR/MR base resolvers and the
  gh/glab/Bitbucket/Azure/Gitea preflight auth probes; preflight now reports
  only the git binary. RPC params catalog regenerated.

  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01PskLbdTqJNXxJ7KRnDoDoD
  ```

---

### Task U10.4: Remove the main-process provider libraries, gh/glab runners, hosted-review creation and the Linear SDK

**Files:**
Delete (whole directories): `src/main/azure-devops/` (10), `src/main/bitbucket/` (16), `src/main/gitea/` (10), `src/main/gitlab/` (53), `src/main/jira/` (32), `src/main/linear/` (63), `src/main/github/client/` (60), `src/main/github/project-view/` (24), `src/main/github/__fixtures__/` (1).
Delete (files): `src/main/github/` (129 — every remaining file in the directory except the three moved by the `git mv` lines in Step 1: `auth-diagnose.test.ts auth-diagnose.ts client-create-pr.test.ts client-file-viewed.test.ts client-issue-origin-preference.test.ts client-issue-source.test.ts client-merge-queue-auto-merge.test.ts client-merged-pr-visibility.test.ts client-pr-branch-discovery.test.ts client-pr-check-details.test.ts client-pr-checks.test.ts client-pr-comment-reactions.test.ts client-pr-conflict-summary.test.ts client-pr-fallback-number.test.ts client-pr-linked-lookup.test.ts client-pr-local-runtime.test.ts client-pr-push-target.test.ts client-pr-state.test.ts client-rate-limit-block.test.ts client-ssh-provider-execution-boundary.test.ts client-stack-merge-guard.test.ts client-starred.test.ts client-test-harness.ts client-test-mocks.ts client-tracked-upstream-fork-owner.test.ts client-tracked-upstream-snapshot.test.ts client-work-item-check-summary.test.ts client-work-items-query-paging.test.ts client-work-items.test.ts client.ts comment-reactions.test.ts comment-reactions.ts conflict-summary-cache.ts conflict-summary.test.ts conflict-summary.ts default-branch-stale-pr.test.ts gh-account-binding-inventory.ts gh-account-token.test.ts gh-account-token.ts gh-capability-state.test.ts gh-capability-state.ts gh-error-classification.ts gh-utils-concurrency.test.ts gh-utils.test.ts gh-utils.ts github-api-repository-probe.ts github-api-repository-remote-probe.ts github-api-repository-validation.test.ts github-api-repository-validation.ts github-api-repository.test.ts github-api-repository.ts github-enterprise-repository.test.ts github-enterprise-repository.ts github-owner-repo-selection.ts github-pr-stack-async-merge.ts github-pr-stack.test.ts github-pr-stack.ts github-repository-host.ts github-repository-identity.fork-owner-repo.test.ts github-repository-identity.gh-account.test.ts github-repository-identity.signed-cache.test.ts github-repository-identity.ssh-host-alias.test.ts github-repository-identity.ts github-ssh-host-alias-resolution.ts github-stack-api-responses.ts issue-comment.ts issue-create.ts issue-field-options.ts issue-timeline.ts issue-update.ts issue-work-item-details.ts issues.test.ts issues.ts mappers.ts merged-pr-commit-membership.ts pr-head-tracking-ref.test.ts pr-head-tracking-ref.ts pr-refresh-candidate-policy.ts pr-refresh-coordinator-active-burst-pacing.test.ts pr-refresh-coordinator-active-visible-priority.test.ts pr-refresh-coordinator-alias-coalescing.test.ts pr-refresh-coordinator-rate-limit-budget.test.ts pr-refresh-coordinator-refresh-events.test.ts pr-refresh-coordinator-test-harness.ts pr-refresh-coordinator-test-mocks.ts pr-refresh-coordinator-visible-follow-up.test.ts pr-refresh-coordinator.ts pr-refresh-error-classification.test.ts pr-refresh-error-classification.ts pr-refresh-event-publisher.ts pr-refresh-pacing.ts pr-refresh-queue-drainer.ts pr-refresh-queue-growth-bound.test.ts pr-refresh-queue.ts pr-refresh-rate-limit-gate.ts pr-refresh-retry-state.ts pr-refresh-validation-backoff.test.ts pr-refresh-validation-backoff.ts pr-refresh-visibility.ts pr-review-comment-lines.test.ts pr-review-comment-lines.ts pr-start-point-compare-base.test.ts pr-start-point.test.ts pr-start-point.ts project-view-host-auth.test.ts project-view.test.ts project-view.ts pull-request-file-contents.ts pull-request-file-data.ts rate-limit.test.ts rate-limit.ts review-head-remote.test.ts review-head-remote.ts stacked-pr-creation.test.ts stacked-pr-creation.ts work-item-details-concurrency.test.ts work-item-details-enterprise-host.test.ts work-item-details-file-viewed.test.ts work-item-details-pr-files.test.ts work-item-details.test.ts work-item-details.ts work-item-participants.ts work-item-search-fallback-environment.test.ts work-item-search-freshness.test.ts work-item-search-isolation.test.ts work-item-search-pagination.test.ts work-item-search-semantics.test.ts work-item-search-test-harness.ts`); `src/main/git/` : `gh-rate-limit-breaker.test.ts gh-rate-limit-breaker.ts runner-gh-account-binding.test.ts runner-gh-host-args.test.ts runner-gh-rate-limit-breaker.test.ts runner-wsl-gh-fallback.test.ts`; `src/main/git/command-runner/` : `gh-bound-account-env.ts gh-exec-file-deadline.test.ts gh-exec-file.ts gh-host-args.ts gh-idempotency.ts gh-retry-policy.ts gh-spawn-boundary.test.ts github-cli-host-fallback.ts glab-exec-file.ts hosted-cli-deadline-log.test.ts hosted-cli-deadline-log.ts`; `src/main/source-control/` : `forge-provider.test.ts forge-provider.ts forge-review-mappers.ts hosted-review-active-branch-claims.ts hosted-review-api-request.ts hosted-review-azure-devops.integration.test.ts hosted-review-base-ref-suffix.test.ts hosted-review-bitbucket.integration.test.ts hosted-review-branch-cache.test.ts hosted-review-branch-cache.ts hosted-review-creation-blocking.ts hosted-review-creation-eligibility.test.ts hosted-review-creation-git-state.ts hosted-review-creation-gitlab-self-hosted.test.ts hosted-review-creation-provider.ts hosted-review-creation-shared-symlinks.test.ts hosted-review-creation.test.ts hosted-review-creation.ts hosted-review-dirty-preflight-wsl-paths.test.ts hosted-review-execution-host-routing.test.ts hosted-review-execution-host.ts hosted-review-gitea.integration.test.ts hosted-review-git-options.ts hosted-review-inflight-invalidation.test.ts hosted-review-inflight-lookups.test.ts hosted-review-inflight-lookups.ts hosted-review-lookup-backoff.ts hosted-review-refresh-pacing.ts hosted-review-scope-generations.ts hosted-review-unsettled-lookups.ts hosted-review.test.ts hosted-review.ts pull-request-linked-issue.test.ts repo-default-branch.test.ts repo-default-branch.ts stacked-hosted-review-creation.test.ts stacked-hosted-review-creation.ts`; `src/main/runtime/` : `linear-save-issue.test.ts orca-runtime-linear-commands.ts runtime-client-settings-linear-team-projection.test.ts runtime-github-issue-comment-commands.ts runtime-github-project-commands.ts runtime-github-repository-query-commands.ts runtime-github-review-mutation-commands.ts runtime-github-review-query-commands.ts runtime-github-worktree-base.ts runtime-gitlab-fork-mr-base.ts runtime-gitlab-issue-source-remote.ts runtime-gitlab-mutation-commands.ts runtime-gitlab-query-commands.ts runtime-gitlab-worktree-base.ts runtime-hosted-review-commands.ts runtime-jira-commands.ts runtime-linear-browse-commands.ts runtime-linear-command-base.ts runtime-linear-command-dependencies.ts runtime-linear-command-surface.ts runtime-linear-comment-commands.ts runtime-linear-comment-lookup-commands.ts runtime-linear-connection-commands.ts runtime-linear-context-commands.ts runtime-linear-create-commands.ts runtime-linear-dedupe-commands.ts runtime-linear-label-write-commands.ts runtime-linear-project-write-commands.ts runtime-linear-read-commands.test.ts runtime-linear-read-commands.ts runtime-linear-retry-commands.ts runtime-linear-save-commands.ts runtime-linear-save-fields-commands.ts runtime-linear-state-commands.ts runtime-linear-task-fields-commands.ts runtime-linear-team-write-commands.ts runtime-linear-write-result-commands.ts runtime-review-command-surface.ts runtime-repository-fork-backfill.ts repo-icon-fork-backfill.test.ts selected-review-branch.ts`; `src/main/runtime/orca-runtime-tests/` : `gitlab-and-pr-bases.spec.ts gitlab-and-pr-bases-part-02.spec.ts gitlab-and-pr-bases-part-03.spec.ts hooks-and-hosted-review.spec.ts hooks-and-hosted-review-part-02.spec.ts hooks-and-hosted-review-part-03.spec.ts`.
Move: `src/main/github/local-git-config-signature.ts` → `src/main/git/local-git-config-signature.ts`; `src/main/github/github-remote-identity-parsing.ts` (+ `.test.ts`) → `src/main/git/github-remote-identity-parsing.ts`.
Modify: `src/main/git/runner.ts:41-44`, `src/main/git/remote-name-listing.ts:1`, `src/main/git/remote-name-listing.test.ts:20`, `src/main/git/admission-tier-plumbing.test.ts:2`, `src/main/ipc/worktree-push-target-cleanup.ts:11`, `src/main/ipc/worktree-push-target-remote-scan.test.ts:7`, `src/main/ipc/worktree-remote.ts:5,32,51-52,734-742,839-951,1825-1835,2382-2383,2413,2452-2510,2534-2539`, `src/main/ipc/worktrees/removal/worktree-removal-ownership.ts:13,97-98`, `src/main/persistence/tracking-repos/repo-update-operations.ts:9,230-236`, `src/main/repo-icon-autodetect.ts:11,102-118,169-174`, `src/main/source-control/pull-request-linked-issue.ts` (trim to the type), `src/main/ipc/filesystem/filesystem-git-pull-request-generation-handlers.ts:24,85-93,127-131,148-157,193-197`, `src/main/runtime/runtime-git-generation-commands.ts:8,171-185,210-214`, `src/main/runtime/orca-runtime.ts:1,23`, `src/main/runtime/orca-runtime-core.ts:13,16-17,339,342-343`, `src/main/runtime/orca-runtime-state-fields.ts:2,24,45,133-155`, `src/main/runtime/orca-runtime-file-commands.ts:9-17,140-202`, `src/main/runtime/orca-runtime-create-managed-remote-worktree.ts:12,17-18,185-213`, `src/main/runtime/orca-runtime-create-managed-worktree.ts:170`, `src/main/runtime/orca-runtime-restore-structured-agent-session-tabs-once.ts:263-291`, `src/main/runtime/orca-runtime-preserved-branch-cleanup.ts:41,294-297`, `src/main/runtime/orca-runtime-get-status.ts:181-186`, `src/main/runtime/runtime-edge-command-controller.ts:6,24,138` (+ `jira` field uses), `src/main/runtime/runtime-repository-command-surface.ts:1-2,75-76,88-89,110-111,145-162`, `src/main/runtime/runtime-local-worktree-create.ts:17,29,101`, `src/main/runtime/runtime-local-worktree-create-candidate.ts:4,27-37,62,139-186`, `src/main/runtime/runtime-worktree-create-git.ts:1,4,9-16,79-116`, `src/main/runtime/orca-runtime-test-mocks/setup.spec.ts:128-192,237-302,437-545,609-674`, `src/main/runtime/orca-runtime-test-mocks.spec.ts:192-256`, `src/main/runtime/orca-runtime-tests/local-worktree-creation-part-02.spec.ts`, `src/main/runtime/orca-runtime-tests/repository-project-operations.spec.ts`, `src/main/runtime/orca-runtime-tests/repository-project-operations-part-02.spec.ts`, `src/main/runtime/orca-runtime-tests/mobile-creation-and-orchestration-part-04.spec.ts:178-200`, `src/main/runtime/orca-runtime-git.test.ts:61-62`, `src/main/runtime/runtime-git-generation-admission.test.ts:25`, `src/main/ipc/worktrees-test-module-mocks.ts:61-62,64-65,151-159`, `src/main/ipc/worktrees-local-create-flow.test.ts` (new test, Step 5), the 9 `src/main/ipc/filesystem-*.test.ts` and `src/main/ipc/filesystem.test.ts` `vi.mock('../source-control/pull-request-linked-issue' …)` blocks, the 34 `src/main/ipc/worktrees-*.test.ts` `vi.mock('../github/client' …)` / `vi.mock('../source-control/hosted-review' …)` blocks (list in Step 8), `package.json:183`, `.oxlintrc.json:104-108`, `config/packaged-runtime-node-modules.cjs:20`, `config/scripts/packaged-source-map-prune.test.mjs:14,58,82,89`, `config/tsconfig.tc.web.json:21`, `config/ts-nocheck-baseline.txt` (prune), `pnpm-lock.yaml` (via `pnpm install`).
Keep untouched: `src/main/git/hosted-remote-url.ts` (URL parsing for "open commit/file in browser"), `src/main/source-control/pull-request-template.ts` (reads the local PR template file for AI PR-body generation), `src/shared/pull-request-generation.ts`, `src/main/text-generation/*`, `src/renderer/src/store/slices/pull-request-generation.ts` (local AI PR title/body generation stays), `src/main/ipc/settings.ts:334` and `src/main/persistence/loading-store/profile-preferences.ts:122` (`getGitHubCache` reads a local persisted cache; harmless and hot), `src/main/runtime/runtime-worktree-ps-summaries.ts:14`.

**Interfaces:** Consumes: Task U10.3 (handlers gone, so these libraries have no callers outside the runtime mixins edited here). Produces: `readLocalGitConfigSignature(context: { repoPath: string; connectionId?: string | null; wslDistro?: string })` from `src/main/git/local-git-config-signature.ts`; `parseGitHubOwnerRepo` from `src/main/git/github-remote-identity-parsing.ts`; `PullRequestLinkedIssueMeta` still exported from `src/main/source-control/pull-request-linked-issue.ts`; no `@linear/sdk` dependency; `src/main` has no `fetch(` call site under `azure-devops|bitbucket|gitea|source-control/hosted-review-api-request`. For the Tier-3 guard author: the kept `src/shared/github/links.ts`, `src/shared/linear/links.ts`, `src/shared/jira-issue-url.ts`, `src/shared/new-workspace/{github-links,gitlab-links}.ts` and `src/main/git/hosted-remote-url.ts` contain `github.com`/`gitlab.com`/`linear.app`/`atlassian.net` literals used only to build web URLs for `shell.openExternal` (I1-allowed); the guard must match `api.github.com` and `gitlab.com/api`, not bare hosts.

- [ ] **Step 1: Delete directories and files.**
  ```bash
  git rm -r -q src/main/azure-devops src/main/bitbucket src/main/gitea src/main/gitlab src/main/jira src/main/linear src/main/github/client src/main/github/project-view src/main/github/__fixtures__
  git mv src/main/github/local-git-config-signature.ts src/main/git/local-git-config-signature.ts
  git mv src/main/github/github-remote-identity-parsing.ts src/main/git/github-remote-identity-parsing.ts
  git mv src/main/github/github-remote-identity-parsing.test.ts src/main/git/github-remote-identity-parsing.test.ts
  git rm -r -q src/main/github
  ```
  then `git rm -q` the listed files under `src/main/git`, `src/main/git/command-runner`, `src/main/source-control`, `src/main/runtime`, `src/main/runtime/orca-runtime-tests`. Run `pnpm test src/main/global-fetch-call-site-audit.test.ts` — expected GREEN (entries were removed in U10.3 Step 6).

- [ ] **Step 2: Fix the two moved modules.** `src/main/git/local-git-config-signature.ts`: replace line 5 (`import type { GitHubRepoContext } from './github-repository-identity'`) with
  ```ts
  type LocalGitConfigContext = {
    repoPath: string
    connectionId?: string | null
    wslDistro?: string
  }
  ```
  and change the parameter type at line 23 from `GitHubRepoContext` to `LocalGitConfigContext`; line 4 (`'../git/coalesced-probe'`) becomes `'./coalesced-probe'`. `src/main/git/remote-name-listing.ts:1`: `from '../github/local-git-config-signature'` → `from './local-git-config-signature'`; `remote-name-listing.test.ts:20`: `vi.mock('../github/local-git-config-signature'` → `vi.mock('./local-git-config-signature'`. `src/main/git/github-remote-identity-parsing.ts`: its two imports (`../../shared/git-remote-host-alias`, `../../shared/github/pull-request-types`) resolve unchanged from the new directory, and its test imports only `vitest` and `./github-remote-identity-parsing` (verified), so the move needs no edit; `src/main/ipc/worktree-push-target-cleanup.ts:11` and `worktree-push-target-remote-scan.test.ts:7`: `from '../github/gh-utils'` → `from '../git/github-remote-identity-parsing'`. Delete `src/main/git/admission-tier-plumbing.test.ts` line 2 and the one test that uses `hostedReviewOptionArgs`.

- [ ] **Step 3: `src/main/git/runner.ts` — delete lines 41–44:**
  ```ts
  export { isTransientGhError } from './command-runner/gh-retry-policy'
  export { applyGhHostToArgs } from './command-runner/gh-host-args'
  export { ghExecFileAsync, ghExecFileWithScopeAsync } from './command-runner/gh-exec-file'
  export { glabExecFileAsync, redirectPortedHostnameToEnv } from './command-runner/glab-exec-file'
  ```

- [ ] **Step 4: Linked-issue lookup becomes type-only.** `src/main/source-control/pull-request-linked-issue.ts`: delete lines 6–7 (`import { getIssue as getGitHubIssue } from '../github/issues'`, `import { getIssue as getGitLabIssue } from '../gitlab/issues'`) and the entire `export async function loadPullRequestLinkedIssue(…)` plus any helper only it uses; keep `export type PullRequestLinkedIssueMeta`. In `src/main/ipc/filesystem/filesystem-git-pull-request-generation-handlers.ts` delete line 24, lines 86–93 and 149–157 (the `const linkedIssueDetailsPromise = loadPullRequestLinkedIssue({…})` statements and the `void linkedIssueDetailsPromise.catch(() => undefined)` lines) and at 127–131 / 193–197 delete `const linkedIssueDetails = await linkedIssueDetailsPromise` and the `...(linkedIssueDetails ? { linkedIssueDetails } : {})` spread (keep `...withLinkedIssueDraftContext(context, issueMeta?.linkedIssue)` and the `provider` spread). Same three deletions in `src/main/runtime/runtime-git-generation-commands.ts` (line 8; lines 172–185; lines 210 and 214). Delete the `vi.mock('../source-control/pull-request-linked-issue' …)` block in `src/main/ipc/filesystem-branch-compare-diff.test.ts:59-60`, `filesystem-commit-message-generation.test.ts:61-62`, `filesystem-commit-message-model-discovery.test.ts:58-59`, `filesystem-download-transfers.test.ts:62-63`, `filesystem-git-commit-dispatch.test.ts:55-56`, `filesystem-git-status-staging.test.ts:67-68`, `filesystem-list-files-handler-name-filter.test.ts:49-50`, `filesystem-markdown-document-listing.test.ts:69-70`, `filesystem.test.ts:67-68`, `src/main/runtime/orca-runtime-git.test.ts:61-62`, `src/main/runtime/runtime-git-generation-admission.test.ts:25`. Expected: `pnpm test src/main/ipc/filesystem.test.ts src/main/runtime/orca-runtime-git.test.ts` passes.

- [ ] **Step 5: Worktree creation no longer consults a forge (TDD).** Add to `src/main/ipc/worktrees-local-create-flow.test.ts` inside its existing `describe` (the file already imports `handlers`, `store`, `listWorktreesMock`, `addWorktreeMock`, `getBranchConflictKindMock` from `./worktrees-test-module-mocks` / `./worktrees-test-harness`; add `getPRForBranchMock` to the same import list for the RED run):
  ```ts
  it('suffixes a remote branch collision without probing a forge for an existing PR', async () => {
    getBranchConflictKindMock.mockResolvedValueOnce('remote').mockResolvedValueOnce(null)
    listWorktreesMock.mockResolvedValue([])

    await handlers['worktrees:create'](null, {
      repoId: 'repo-1',
      name: 'fix-title',
      baseBranch: 'origin/main'
    })

    expect(getBranchConflictKindMock).toHaveBeenCalledTimes(2)
    expect(addWorktreeMock).toHaveBeenCalledTimes(1)
    expect(getPRForBranchMock).not.toHaveBeenCalled()
  })
  ```
  Run `pnpm test src/main/ipc/worktrees-local-create-flow.test.ts` — expected RED: the second suffix attempt calls `getLocalGitHubPrForBranch`, so `getPRForBranchMock` is called once. GREEN comes from the edits below; in the same GREEN step delete the `expect(getPRForBranchMock).not.toHaveBeenCalled()` line and the `getPRForBranchMock` import, because Step 8 removes that mock export (the two remaining assertions keep the contract: one add after two local conflict probes, no PR-collision error). Then: `src/main/ipc/worktree-remote.ts`: delete line 5 (`import { getRepoHostedReviewExecutionHostId } from '../source-control/hosted-review-execution-host'`), lines 32, 51–52; delete `getLocalGitHubPrForBranch` (734–742); delete lines 839–951 (`SelectedReviewBranchInput`, `SelectedReviewBranch`, `getSelectedReviewBranch`, `isSelectedGitHubPrBranchOverride`, `isSelectedReviewBranchOverride`, `isMatchingSelectedGitHubPr`, `isAllowedPushTargetRemoteConflict`, `getSelectedReviewLookupHints`, `getSelectedHostedReviewForBranch`); replace lines 1825–1835 with:
  ```ts
      if (lastBranchConflictKind) {
        continue
      }
  ```
  delete lines 2382–2383 (`lastExistingPR`, `lastExistingReviewNumber`) and 2413 (`lastExistingReviewNumber = null`); replace lines 2452–2510 (from `const allowedPushTargetRemoteConflict =` through the `if (suffix > 1 && !checkoutExistingBranch) { … }` block) with:
  ```ts
        if (lastBranchConflictKind) {
          continue
        }
  ```
  and replace lines 2534–2539 (`const existingReviewNumber = …` through its `throw`) with nothing (the following `if (lastBranchConflictKind)` collision error stays). `src/main/runtime/runtime-worktree-create-git.ts`: delete lines 1, 4, 9–16 and lines 79–116 (`getLocalGitHubPrForBranch`, `getSelectedHostedReviewForBranch`); keep `resolveCreateBranchName` and `canCheckoutExistingLocalBranch`. `src/main/runtime/runtime-local-worktree-create-candidate.ts`: delete line 4, the imports of `getLocalGitHubPrForBranch`/`getSelectedHostedReviewForBranch`/`isMatchingSelectedGitHubPr`/`getSelectedReviewBranch`/`isAllowedPushTargetRemoteConflict` (lines 27–37), line 62 (`hostedReviewExecutionContext?: …`), and replace lines 139–186 (from `const allowedPushTargetRemoteConflict =` through the closing `}` of `if (!checkoutExistingBranch && !selectedReviewConflictMatched) {…}`) with:
  ```ts
    if (branchConflictKind) {
      continue
    }
  ```
  `src/main/runtime/runtime-local-worktree-create.ts`: delete lines 17, 29 and 101 (`hostedReviewExecutionContext`). `src/main/runtime/orca-runtime-create-managed-worktree.ts:170`: delete `hostedReviewExecutionContext: this.getHostedReviewExecutionOptions(repo),`. `src/main/runtime/orca-runtime-restore-structured-agent-session-tabs-once.ts`: delete lines 263–291 (`resolveHostedReviewTarget`, `getHostedReviewExecutionOptions`). Run the new test — expected GREEN. Then `pnpm test src/main/ipc/worktrees-local-create-flow.test.ts src/main/runtime/orca-runtime-tests/local-worktree-creation.spec.ts`.

- [ ] **Step 6: Runtime mixin chain and command surfaces.** `src/main/runtime/orca-runtime-state-fields.ts`: line 2 → `import { OrcaRuntimeWithFileCommands } from './orca-runtime-file-commands'`; line 45 → `export class OrcaRuntimeWithStateFields extends OrcaRuntimeWithFileCommands {`; delete line 24 and lines 143–144 (`hostedReviews:`, `gitHubRepositoryQueries:`) and lines 148–155 (the `installRuntimeReviewCommandSurface(runtime, {…})` call). `src/main/runtime/orca-runtime.ts`: delete line 1 and line 23 (`installRuntimeLinearCommandSurface(OrcaRuntimeServiceExport.prototype)`). `src/main/runtime/orca-runtime-core.ts`: delete lines 13, 17, 339 (`RuntimeLinearCommandSurface &`) and 343 (`RuntimeReviewCommandSurface &`). `src/main/runtime/orca-runtime-file-commands.ts`: delete lines 9–17 and lines 140–202 (the `hostedReviews`, `gitHubRepositoryQueries`, `gitLabQueryCommands`, `gitLabMutationCommands`, `gitHubReviewQueries`, `gitHubReviewMutations`, `gitHubIssueComments`, `gitHubProjectCommands` fields). `src/main/runtime/runtime-repository-command-surface.ts`: delete lines 1–2, 75–76 (`& Pick<RuntimeHostedReviewCommands, …> & Pick<RuntimeGitHubRepositoryQueryCommands, …>` — end the type at `writeRepoIssueCommand: …` with `}`), 88–89, the `const reviews = …`/`const queries = …` lines (110–111) and lines 145–162 (`getRepoSlug` … `validateGitHubAccountBinding` bindings); also delete the now-unused `HostedReviewCommandName`/`GitHubRepositoryQueryCommandName` type aliases. `src/main/runtime/runtime-edge-command-controller.ts`: delete line 6, line 24 (`PublicMethods<RuntimeJiraCommands> &`), line 138 and every `this.jira` binding in the file. `src/main/runtime/orca-runtime-create-managed-remote-worktree.ts`: delete lines 12 (`GitHubPrStartPoint` from the type import — keep `GitPushTarget` only if still used), 17–18 and 185–213 (`resolveManagedPrBase`, `resolveManagedMrBase`). `src/main/runtime/orca-runtime-preserved-branch-cleanup.ts`: delete line 41 and lines 294–297; `orca-runtime-get-status.ts`: delete lines 183–184 inside `setNotifier` (`if (notifier) { this.repositoryForkBackfill.start() }`). `src/main/ipc/worktrees/removal/worktree-removal-ownership.ts`: delete line 13 and lines 97–98. `src/main/persistence/tracking-repos/repo-update-operations.ts`: delete line 9 and lines 230–236 (the `if ('ghAccount' in updates) {…}` block). `src/main/repo-icon-autodetect.ts`: delete line 11, replace the body of `detectGitHubAvatarIcon` (lines 102–118) with `return null` (keep the export — U11 removes the function with `shared/repo-icon.ts`), and replace lines 171–174 with `const upstream = null`. `config/ts-nocheck-baseline.txt`: run `pnpm run check:ts-nocheck-ratchet` and remove the stale `src/main/runtime/orca-runtime-linear-commands.ts` line it names.

- [ ] **Step 7: Runtime test support.** `src/main/runtime/orca-runtime-test-mocks/setup.spec.ts`: delete the provider mock declarations inside the `vi.hoisted` block (lines 237–302, `createHostedReviewMock` through `updateGitLabMRReviewersMock`, plus `getIssueMock`), the destructured names at lines 128–192, the `vi.mock` blocks at 437–545 (`../../source-control/hosted-review-creation`, `../../source-control/stacked-hosted-review-creation`, `../../source-control/hosted-review`, `../../github/client`, `../../gitlab/client`, `../../gitlab/gl-utils`, `../../gitlab/work-item-details`, `../../github/work-item-details`, `../../github/issues`) and the export lines 609–674 for the same names. `src/main/runtime/orca-runtime-test-mocks.spec.ts`: delete lines 192–256 (the same names in the re-export block). `orca-runtime-tests/local-worktree-creation-part-02.spec.ts`: delete the `getHostedReviewForBranchMock` import (line 8) and the eleven PR-branch-override `it` blocks (lines 17–83, 84–137, 138–209, 210–267, 268–316, 317–375, 376–426, 427–482, 483–end); if nothing remains, `git rm` the file. `repository-project-operations.spec.ts` and `-part-02.spec.ts`: delete the `getRepoUpstreamMock` import and every `getRepoUpstreamMock.mockResolvedValue*(…)` line (125, 204, 256, 343, 534 and 36, 116); the surrounding tests keep passing because `repo.upstream` is now always `null`. `mobile-creation-and-orchestration-part-04.spec.ts:178-200`: delete the `it('reads the linked-PR state from the renderer repoId-keyed GitHub cache', …)` block. Expected: `pnpm test src/main/runtime/orca-runtime-tests` → no new failing files.

- [ ] **Step 8: Worktree IPC tests — delete the two provider `vi.mock` blocks in each.** First `src/main/ipc/worktrees-test-module-mocks.ts`: delete lines 61–62 (`getPRForBranchMock`, `getHostedReviewForBranchMock`), lines 64–65 (`getWorkItemMock`, `getPullRequestPushTargetMock`) and lines 151–159 (`githubClientModuleMock`, `hostedReviewModuleMock`); then `rg -n "getPRForBranchMock|getHostedReviewForBranchMock|getWorkItemMock|getPullRequestPushTargetMock" src/main/ipc` and delete every `it(` block that contains a hit (for example `worktrees-wsl-runtime-routing.test.ts:375-420` "routes selected PR branch conflict lookup through the selected WSL project runtime") plus the matching import names. Then delete `vi.mock('../github/client' …)` and `vi.mock('../source-control/hosted-review' …)` in: `worktrees-authoritative-local-metadata-pruning.test.ts:39,42`, `worktrees-background-removal.test.ts:34,37`, `worktrees-create-execution-host-routing.test.ts:27,30`, `worktrees-create-metadata-persistence.test.ts:64,67`, `worktrees-delete-pty-teardown.test.ts:36,39`, `worktrees-detected-scan-cache.test.ts:28,31`, `worktrees-discovery-metadata-backfill.test.ts:23,26`, `worktrees-existing-branch-checkout.test.ts:31,34`, `worktrees-forget-local.test.ts`, `worktrees-issue-command-overrides.test.ts`, `worktrees-lineage-hydration.test.ts:29,32`, `worktrees-listing-fallback-rows.test.ts:25,28`, `worktrees-local-base-ref-resolution.test.ts:31,34`, `worktrees-local-create-flow.test.ts:43,46`, `worktrees-mutation-scan-generation-order.test.ts:36,39`, `worktrees-orphan-directory-cleanup.test.ts:36,39`, `worktrees-preserved-branch-fork-remote.test.ts:29,32`, `worktrees-removal-recovery.test.ts:48,51`, `worktrees-remove-archive-hooks.test.ts:43,46`, `worktrees-remove-host-disambiguation.test.ts:30,33`, `worktrees-remove-preflight.test.ts:37,40`, `worktrees-setup-launch-sparse-checkout.test.ts:31,34`, `worktrees-ssh-base-ref-resolution.test.ts:27,30`, `worktrees-ssh-branch-conflict-suffixing.test.ts:26,29`, `worktrees-ssh-create-base-prefetch.test.ts:26,29`, `worktrees-ssh-fork-push-target-remote.test.ts:25,28`, `worktrees-ssh-local-base-refresh-overlap.test.ts:23,26`, `worktrees-ssh-local-base-refresh.test.ts:22,25`, `worktrees-ssh-pr-head-fetch.test.ts:30,33` (then delete its PR-head `it` blocks; `git rm` if empty), `worktrees-ssh-provider-authority.test.ts:28,31`, `worktrees-ssh-repo-owner-resolution.test.ts:36,39`, `worktrees-ssh-setup-launch.test.ts:30,33`, `worktrees-windows.test.ts:103-104`, `worktrees-wsl-runtime-routing.test.ts:45,48`. Any `it` in those files that sets `linkedPR`/`linkedGitLabMR` on the create args or asserts a PR-number collision message is deleted with the mocks. Expected: `pnpm test src/main/ipc` → no new failing files; the reliability gates that cite `worktrees-lineage-hydration`, `worktrees-ssh-repo-owner-resolution`, `worktrees-delete-pty-teardown`, `worktrees-remove-archive-hooks`, `worktrees-orphan-directory-cleanup`, `worktrees-remove-preflight` keep their test files (edited, not deleted) so `pnpm run check:reliability-gates` passes.

- [ ] **Step 9: Drop the Linear SDK and config references.** `package.json:183`: delete `"@linear/sdk": "^82.1.0",`. `.oxlintrc.json:104-108`: delete the `{ "name": "@linear/sdk", … }` restricted-import entry. `config/packaged-runtime-node-modules.cjs:20`: delete `'@linear/sdk',`. `config/scripts/packaged-source-map-prune.test.mjs`: rename the fixture package in lines 14, 58, 82, 89 from `@linear/sdk` to `@parcel/watcher` (the test exercises source-map pruning of any packaged dependency). `config/tsconfig.tc.web.json:21`: delete `"../src/main/gitlab/mappers.ts",`. Run `pnpm install` and commit `pnpm-lock.yaml`. Expected: `rg -n "@linear/sdk" --glob '!pnpm-lock.yaml' --glob '!node_modules/**' .` prints nothing.

- [ ] **Step 10: Orphan sweep.** Run
  ```bash
  for f in src/main/source-control/pull-request-template.ts src/main/git/hosted-remote-url.ts src/main/git/local-git-config-signature.ts src/main/git/github-remote-identity-parsing.ts src/main/runtime/runtime-worktree-create-git.ts src/main/runtime/runtime-repository-command-surface.ts; do printf '%s %s\n' "$(rg -l "$(basename "${f%.ts}")'" src --glob '!*.test.ts' | wc -l | tr -d ' ')" "$f"; done
  ```
  Every line must print a count ≥ 1; a `0` means the module lost its last importer in this task and must be `git rm`'d in the same commit. Then `rg -l "ghExecFileAsync|glabExecFileAsync|getPRForBranch|getHostedReviewForBranch|loadLinearSdk|RuntimeLinearCommands|RuntimeJiraCommands|RuntimeHostedReviewCommands" src` must print nothing.

- [ ] **Step 11: Verify.** `pnpm tc` → no errors. `pnpm test src/main src/shared` → no new failing files versus `notes/local-only/before/failing-files.txt`. `pnpm run check:code-quality:changed`, `pnpm run check:max-lines-ratchet`, `pnpm run check:ts-nocheck-ratchet`, `pnpm run check:reliability-gates`, `pnpm run verify:rpc-params-catalog`, `pnpm test src/main/global-fetch-call-site-audit.test.ts` → all pass. `rg -n "fetch\(" src/main/azure-devops src/main/bitbucket src/main/gitea src/main/source-control 2>/dev/null` → prints nothing (directories gone). `git status --short | rg '^D' | wc -l` for this task → 566 files under `src/main` plus the 9 `src/cli` files already removed in U10.3 are not counted here.

- [ ] **Step 12: Commit.**
  ```
  refactor(local-only): remove git-provider libraries, gh/glab runners and hosted reviews

  Deletes the GitHub/GitLab/Bitbucket/Azure DevOps/Gitea/Jira/Linear main
  libraries, the gh and glab subprocess runners, hosted-review creation and
  the Linear SDK. Worktree creation no longer probes a forge on branch
  collisions; local git config signature and owner/repo parsing move under
  src/main/git.

  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01PskLbdTqJNXxJ7KRnDoDoD
  ```
---

## Closing tasks

### Task Z.1: Make the guard clean and wire it into `pnpm lint`

**Files:**
- Modify: `config/local-only-allowlist.txt`
- Modify: `package.json` (the `lint` script)
- Modify: `config/scripts/check-local-only.test.mjs` (add a repo-level assertion)

**Interfaces:**
- Consumes: `scanLocalOnly`, `readAllowlist` from Task 0
- Produces: `pnpm lint` fails on any local-only regression. Upstream merges use this.

- [ ] **Step 1: Write the failing repo-level test**

Append to `config/scripts/check-local-only.test.mjs`:

```js
import { readAllowlist } from './check-local-only.mjs'

describe('repository', () => {
  it('has no local-only violations outside the allowlist', () => {
    const rootDir = path.resolve(import.meta.dirname, '../..')
    expect(scanLocalOnly({ rootDir, allowlist: readAllowlist(rootDir) })).toEqual([])
  })
})
```

- [ ] **Step 2: Run the test**

Run: `pnpm test config/scripts/check-local-only.test.mjs`
Expected: PASS if all prior tasks left zero violations. If not, it FAILS and lists the exact `file:line [rule]` entries.

- [ ] **Step 3: Resolve each remaining violation**

Delete the remaining code if it is a missed cloud path. If it is a sanctioned exception, add an allowlist entry with a one-line justification. Planners named these sanctioned exceptions:

```
# Spec B transfer rails (SSH/paired skill install) — removed with SSH in Spec B.
src/main/skills/skill-package-download.ts:forbidden-host
# Pasteable npx command shown to the user; Orca never runs it.
src/shared/agent-feature-install-commands.ts:forbidden-host
```

Only add entries for violations that the test actually reports.

- [ ] **Step 4: Wire the guard into lint**

In `package.json`, change `"lint": "oxlint && ...` to `"lint": "oxlint && pnpm run check:local-only && ...`, keeping the rest of the chain unchanged.

- [ ] **Step 5: Verify**

Run: `pnpm run check:local-only && pnpm test config/scripts/check-local-only.test.mjs`
Expected: `check-local-only: clean`, and the tests PASS.

- [ ] **Step 6: Commit**

```bash
git add config/local-only-allowlist.txt config/scripts/check-local-only.test.mjs package.json
git commit -m "feat(local-only): enforce check-local-only in lint

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01PskLbdTqJNXxJ7KRnDoDoD"
```

### Task Z.2: Architecture and upstream-sync docs, AGENTS.md, README

**Files:**
- Create: `docs/reference/local-only-architecture.md`
- Create: `docs/reference/local-only-upstream-sync.md`
- Modify: `.gitignore` (allowlist the two new reference docs, next to the existing tracked `docs/reference/*` entries)
- Modify: `AGENTS.md` (add a "Local-only fork" section at the top; remove or trim the "Remote Wire Compatibility" section and the mobile references in "Agent Status"; leave the SSH sections for Spec B)
- Modify: `README.md` (state the fork is local-only; remove mobile, cloud, download/update, and provider-integration claims; `pnpm run check:readme-local-links` must pass)

**Interfaces:**
- Consumes: the final guard rule list (Task 0/Z.1) and the removal list (all U tasks)
- Produces: the documents that the change summary (Z.4) links to

- [ ] **Step 1: Write `docs/reference/local-only-architecture.md`**

Required sections, filled from the spec and the final tree:
- Invariants I1–I3, copied verbatim from the spec.
- Remaining listeners. Re-derive this list with `rg -n "\.listen\(|createServer\(|new WebSocketServer\(" src -g '!*.test.*'` and give file:line plus bind address for each.
- Remaining egress exceptions: git CLI, browser pane, openExternal, speech-model and scrcpy downloads, SSH (Spec B), and the allowlist entries.
- Local telemetry: file path, format, rotation, and the consent gate.
- Removed subsystems, one line each.

- [ ] **Step 2: Write `docs/reference/local-only-upstream-sync.md`**

Required sections:
- One-time setup: `git remote add upstream https://github.com/stablyai/orca.git`. This is a user action and is documented, not run.
- The merge loop:
  1. `git fetch upstream`
  2. `git merge upstream/main`
  3. Resolve modify/delete conflicts on deleted files with `git rm`.
  4. Resolve Tier-2 hot files with the playbook below.
  5. `pnpm install`
  6. `pnpm tc`
  7. `pnpm run check:local-only`
  8. `pnpm test`
- A per-file conflict playbook, one row per Tier-2 hot file that the tasks edited. Each row gives the file, what we removed, and the rule "keep our deletion; drop upstream's new registration of removed features". Build the file list with `git diff --stat main...HEAD --diff-filter=M`.
- How to classify a new upstream feature (local, or cloud to remove) and how to extend the guard.

- [ ] **Step 3: Update `.gitignore`, `AGENTS.md`, and `README.md` as listed under Files.**

- [ ] **Step 4: Verify**

Run: `pnpm run check:readme-local-links && git status --short docs/reference`
Expected: the check passes, and both new docs show as untracked (not ignored).

- [ ] **Step 5: Commit**

```bash
git add .gitignore AGENTS.md README.md docs/reference/local-only-architecture.md docs/reference/local-only-upstream-sync.md
git commit -m "docs(local-only): add architecture and upstream-sync guides

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01PskLbdTqJNXxJ7KRnDoDoD"
```

### Task Z.3: After-scans and runtime acceptance check

**Files:**
- Create (gitignored): `notes/local-only/after/*`

**Interfaces:**
- Consumes: baseline in `notes/local-only/before/`
- Produces: the inputs for Z.4

- [ ] **Step 1: Static checks**

```bash
A=notes/local-only/after; mkdir -p $A
ORCA_BACKGROUND_LAUNCH=1 pnpm tc > $A/tc.log 2>&1; echo tc=$?
ORCA_BACKGROUND_LAUNCH=1 pnpm test > $A/test.log 2>&1; echo test=$?
pnpm lint > $A/lint.log 2>&1; echo lint=$?
gitleaks dir . --no-banner --redact --report-format json --report-path $A/gitleaks.json; echo gitleaks=$?
pnpm audit --json > $A/pnpm-audit.json; echo audit=$?
pnpm run check:local-only > $A/check-local-only.txt 2>&1
```

Expected: `tc=0` and `lint=0`. Every test-file failure must already appear in `notes/local-only/before/failing-files.txt`; extract the list the same way the baseline was extracted and diff it. `check-local-only` prints `clean`.

- [ ] **Step 2: Hostname and listener diff**

Re-run the two `rg` commands that produced `before/hostnames.txt` and `before/listeners.txt` into `after/`, then run `diff` on each pair. Expected: hostnames only drop, with nothing added; no listener lines are added.

- [ ] **Step 3: Runtime acceptance**

```bash
pnpm build:electron-vite
ORCA_BACKGROUND_LAUNCH=1 pnpm exec electron . > $A/app.log 2>&1 &
APP=$!; sleep 30
lsof -a -i -P -n -p "$(pgrep -d, -P $APP),$APP" > $A/lsof.txt; kill $APP
```

Expected: every line in `lsof.txt` is `127.0.0.1`, `[::1]`, or `localhost`. There is no `*:` LISTEN and no ESTABLISHED connection to a non-loopback address. If the app cannot launch headless in this environment, record that and note the gap in the summary.

### Task Z.4: Change summary

**Files:**
- Create: `docs/local-only/2026-10-01-spec-a-change-summary.md`

- [ ] **Step 1: Write the summary**

Sections:
1. What changed, per unit U1–U12 with commit SHAs from `git log --oneline main..HEAD`.
2. Before/after table: tc, failing test files, gitleaks counts by rule, pnpm audit counts by severity, forbidden-host hits, forbidden-import files, listener lines, and the lsof result.
3. Remaining network surfaces, as sanctioned by the spec.
4. Behaviour changes users will notice (taken from the planners' risk notes: empty non-Claude usage meters, no in-app updates, no share links, and so on).
5. Known gaps and Spec B scope.

- [ ] **Step 2: Commit**

```bash
git add docs/local-only/2026-10-01-spec-a-change-summary.md
git commit -m "docs(local-only): add Spec A change summary

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01PskLbdTqJNXxJ7KRnDoDoD"
```
