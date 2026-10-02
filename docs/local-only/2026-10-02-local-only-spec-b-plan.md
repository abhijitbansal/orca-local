# Local-only Orca — Spec B Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove SSH remotes, the SSH relay (except the WSL relays), remote runtime environments and the pairing client, orcad, ephemeral VMs and VM recipes, the serve-update handoff, the skill-transfer rails, pinned runtime downloads and the WSL OpenCode vault reader, so that Orca reaches only loopback plus the exceptions the user kept.

**Architecture:** Hard removal of the capability with rebase-friendly seams. Execution-host type unions stay as inert values. The SSH provider getters become stub registries that return `undefined`. The WSL relay closure and its 8 transport files stay in place. Persisted ssh/runtime rows are stripped at load. The guard gains rules for ssh2 and tweetnacl imports and for the nodejs.org and storage.googleapis.com hosts.

**Tech Stack:** Electron, electron-vite, React, TypeScript, vitest, oxlint, pnpm 12 (`npx -y pnpm@12.0.0` shim).

**Spec:** `docs/local-only/2026-10-02-local-only-spec-b-design.md`

## Global Constraints

- Branch `local-only/spec-b`. Each task is one commit (B6.2 also absorbs B3.2 in the same commit) and leaves `pnpm tc` green. A task must add no new failing test files compared with `notes/local-only/after/failing-files.txt` (the Spec A after baseline: 13 files). `pnpm run check:local-only` must stay clean at every commit; B0.1 adds temporary Spec B allowlist rows for this, and B0.2 removes them.
- Commit trailer, verbatim: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` and `Claude-Session: https://claude.ai/code/session_01PskLbdTqJNXxJ7KRnDoDoD`. Commits are authorized. Pushing, rebasing, amending earlier tasks and creating branches are NOT authorized.
- Keep: local and WSL execution, folder workspaces, the git CLI (including `GIT_SSH_COMMAND` handling), the browser pane, the Mobile Emulator and the scrcpy download, the speech-model download, the local CLI over the unix socket or named pipe, `orca serve` as a local headless runtime, the managed agent hook installers (`import type { SFTPWrapper } from 'ssh2'`, and `@types/ssh2` stays a devDependency), the WSL relay closure in `src/relay`, and the WSL transport files in `src/main/ssh`.
- Do not narrow `ExecutionHostKind` / `ExecutionHostId`. Do not edit `if (connectionId)` callers unless a stub returning `undefined` would let them treat a remote row as local. Fail closed with a typed "unsupported in this build" error, and never fall back to local.
- Never add `max-lines` disables. Never delete ratchet tests; update their counts and entries instead.
- Line numbers were read at `57f87b013d`. Re-anchor on the quoted content and delete bottom-up.
- Localization: run the 3 `verify:localization-*` gates. If they fail, prune keys in all six locales, then run `pnpm run sync:localization-runtime-catalog`. Regenerate the rpc params catalog and the bundled skill guides and manifest when their inputs change.
- Per task: `pnpm tc`, then `pnpm test <listed paths>`, then the path-string sweep for every deleted path (rg across src/ tests/ config/ .github/ skills/ skill-guides/ docs/site), then `pnpm run check:code-quality:changed`, then `pnpm run check:local-only`.
- Run apps and e2e only with `ORCA_BACKGROUND_LAUNCH=1`.

## Review Focus

1. **Upgrading a profile that holds SSH or remote-runtime repos, worktrees, terminals, leases or targets.** The app boots, the profile loads local-only, and no remote path is probed locally. Owner: B7.2 (legacy-profile tests).
2. **WSL keeps working.** The WSL agent hooks, the WSL browser-network relay and WSL terminals are unaffected. `pnpm build:mac` and `build:relay` still produce the WSL relay bundles. Owners: B6.1 and B6.2 (closure tests); verified again in Z.
3. **A legacy `ssh:`/`runtime:` value reaching a kept seam** (git or filesystem dispatch, PTY spawn, worktree create or remove) gets a typed unsupported error and never a local fallback. Owners: B6.2 and B5.2, which add seam tests.
4. **`orca serve` still works headless.** It starts, `orca status` connects over the socket, and promotion to the desktop works without the update handoff. Owner: B2.1.
5. **Managed agent hook install still works locally and in WSL** after the ssh2 runtime dependency is removed. Owner: B6.4.

## Execution order

B0.1 → B1.1 → B1.2 → B1.3 → B1.4 → B2.1 → B3.1 → B4.2 → B4.1 → B5.1 … B5.6 → B7.1 → B7.2 → B6.1 → B6.2 (+B3.2, same commit) → B6.3 → B6.4 → B6-2.1 … B6-2.9 → B0.2 → B8.1 → B8.2 → B8.3 → Z (after-scans, packaging, runtime check, summary, checklist, push).

---


---

## Planner group: b0-b1-b2

## Unit B0 — Guard extension

Decision: **B0 lands in two tasks.** B0.1 lands first (before B1) and adds the rules plus a clearly delimited block of temporary `# Spec B` allowlist rows for the eleven violations that exist today (all in files B4/B5/B6 delete). The repository test in `check-local-only.test.mjs` runs under vitest, so the tree must be guard-clean at every commit; a baseline count would weaken the guard, rows keep it strict. B0.2 lands after B6 and strips the block, adding a stale-row ratchet so no row can outlive its file again.

### Task B0.1: Forbid ssh2/tweetnacl imports and the pinned-download hosts (TDD)

**Files:**
- Modify: `config/scripts/check-local-only.mjs:7-21` (FORBIDDEN_HOSTS), `:22-28` (FORBIDDEN_MODULES), `:46` (MODULE_SPECIFIER), `:67-93` (scanSource), `:95-108` (scanPackage), `:152-159` (scanLocalOnly allowlist filter)
- Modify: `config/local-only-allowlist.txt` (append one block after line 27)
- Modify: `docs/reference/local-only-architecture.md:136-137` (guard rule list)
- Test: `config/scripts/check-local-only.test.mjs`

**Interfaces:** Consumes `scanLocalOnly({ rootDir, allowlist })`, `readAllowlist(rootDir)`. Produces the same exports with three new behaviours: `forbidden-host` for `nodejs.org/dist` and `storage.googleapis.com`; `forbidden-import`/`forbidden-dependency` for `ssh2`, `ssh2/*`, `ssh2-*`, `tweetnacl` with type-only imports exempt; allowlist rows may carry a third `:match` segment.

- [ ] **Step 1: Write the RED tests.** Append to the `scanLocalOnly` describe in `config/scripts/check-local-only.test.mjs`:
  ```js
  it('flags the pinned Node and skill-package download hosts', () => {
    const v = scanLocalOnly({
      rootDir: base({
        'src/shared/pin.ts':
          "const official = 'https://nodejs.org/dist'\nconst grant = 'https://storage.googleapis.com/x'\n"
      }),
      allowlist: new Set()
    })
    expect(v.map((x) => x.match)).toEqual(['nodejs.org/dist', 'storage.googleapis.com'])
  })

  it('flags value imports of ssh2, its subpaths and ssh2-* packages', () => {
    const v = scanLocalOnly({
      rootDir: base({
        'src/main/a.ts': "import { Client } from 'ssh2'\n",
        'src/main/b.ts': "const c = require('ssh2/lib/protocol/constants.js')\n",
        'src/main/c.ts': "import sftp from 'ssh2-sftp-client'\n",
        'src/shared/d.ts': "import nacl from 'tweetnacl'\n"
      }),
      allowlist: new Set()
    })
    expect(v.map((x) => [x.rule, x.match]).sort()).toEqual([
      ['forbidden-import', 'ssh2'],
      ['forbidden-import', 'ssh2-sftp-client'],
      ['forbidden-import', 'ssh2/lib/protocol/constants.js'],
      ['forbidden-import', 'tweetnacl']
    ])
  })

  it('ignores type-only ssh2 imports, single-line and multi-line', () => {
    const root = base({
      'src/main/hook-service.ts': "import type { SFTPWrapper } from 'ssh2'\n",
      'src/main/provider.ts': "import type {\n  Stats,\n  SFTPWrapper\n} from 'ssh2'\n",
      'src/main/reexport.ts': "export type { ClientChannel } from 'ssh2'\n"
    })
    expect(scanLocalOnly({ rootDir: root, allowlist: new Set() })).toEqual([])
  })

  it('still flags a mixed value and inline-type ssh2 import', () => {
    const v = scanLocalOnly({
      rootDir: base({ 'src/main/a.ts': "import { utils, type ParsedKey } from 'ssh2'\n" }),
      allowlist: new Set()
    })
    expect(v.map((x) => x.rule)).toEqual(['forbidden-import'])
  })

  it('flags ssh2 and tweetnacl dependencies but not @types/ssh2', () => {
    const root = fixture({
      'package.json': JSON.stringify({
        dependencies: { ssh2: '1', tweetnacl: '1' },
        devDependencies: { '@types/ssh2': '1' }
      }),
      'config/electron-builder.config.cjs': minimalBuilder
    })
    expect(scanLocalOnly({ rootDir: root, allowlist: new Set() }).map((x) => x.match)).toEqual([
      'ssh2',
      'tweetnacl'
    ])
  })

  it('honours path:rule:match allowlist entries', () => {
    const root = fixture({
      'package.json': JSON.stringify({ dependencies: { ssh2: '1', tweetnacl: '1' } }),
      'config/electron-builder.config.cjs': minimalBuilder
    })
    expect(
      scanLocalOnly({
        rootDir: root,
        allowlist: new Set(['package.json:forbidden-dependency:ssh2'])
      }).map((x) => x.match)
    ).toEqual(['tweetnacl'])
  })
  ```
  Run `pnpm test config/scripts/check-local-only.test.mjs`. Expected: the six new tests fail (hosts and modules unknown, type-only import flagged, three-segment row ignored); the existing tests pass.

- [ ] **Step 2: Extend the host and module lists.** In `check-local-only.mjs` replace lines 7-28 with:
  ```js
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
    'chatgpt.com/backend-api',
    'api.openai.com',
    'nodejs.org/dist',
    'storage.googleapis.com'
  ]
  // Entries ending in '/' or '-' are prefixes; every other entry matches the bare name or a subpath.
  export const FORBIDDEN_MODULES = [
    'posthog-node',
    'posthog-js',
    'electron-updater',
    '@octokit/',
    '@sentry/',
    'ssh2',
    'ssh2-',
    'tweetnacl'
  ]
  export function isForbiddenModule(name) {
    return FORBIDDEN_MODULES.some((m) =>
      m.endsWith('/') || m.endsWith('-') ? name.startsWith(m) : name === m || name.startsWith(`${m}/`)
    )
  }
  ```

- [ ] **Step 3: Exempt type-only imports.** Below the `MODULE_SPECIFIER` constant (line 46) add:
  ```js
  // `import type … from 'x'` is erased by TypeScript and loads nothing at runtime. The specifier
  // clause is matched exactly (`* as x`, an identifier, or one brace block) so a multi-line type
  // import is recognised without letting the match run into a later value import.
  const TYPE_ONLY_IMPORT =
    /\b(?:import|export)\s+type\s+(?:\*\s+as\s+\w+|\w+|\{[^}]*\})\s*from\s*['"]([^'"]+)['"]/g

  function typeOnlyImportKeys(text) {
    const keys = new Set()
    for (const match of text.matchAll(TYPE_ONLY_IMPORT)) {
      const line = text.slice(0, match.index + match[0].length).split('\n').length
      keys.add(`${line}:${match[1]}`)
    }
    return keys
  }
  ```
  In `scanSource`, read the file once (`const source = readFileSync(file, 'utf8')`, `const typeOnly = typeOnlyImportKeys(source)`), iterate `source.split('\n')` (the per-line callback keeps its `text` variable), and replace the forbidden-import block (lines 76-83) with:
  ```js
  for (const [, specifier] of text.matchAll(MODULE_SPECIFIER)) {
    if (typeOnly.has(`${line}:${specifier}`)) {
      continue
    }
    if (isForbiddenModule(specifier)) {
      violations.push({ file: rel, line, rule: 'forbidden-import', match: specifier })
    }
  }
  ```

- [ ] **Step 4: Package and allowlist matching.** In `scanPackage` replace the `.filter(...)` predicate (lines 102-104) with `.filter((name) => isForbiddenModule(name))`. In `scanLocalOnly` replace the final filter (line 158) with:
  ```js
  ].filter(
    (v) =>
      !allowlist.has(`${v.file}:${v.rule}`) && !allowlist.has(`${v.file}:${v.rule}:${v.match}`)
  )
  ```
  Run `pnpm test config/scripts/check-local-only.test.mjs`. Expected: the six new tests pass; the `repository` test now FAILS listing exactly these violations (verify the list matches before step 5; if it differs, the sweep below moved — fix the rows, never the rule): `src/relay/skill-install-handler.ts:116,132`, `src/main/runtime/runtime-skill-install-commands.ts:89,171`, `src/main/skills/skill-ssh-package-transfer.ts:33`, `src/shared/node-runtime-pin.ts:173` (forbidden-host); `src/shared/e2ee-crypto.ts:4`, `src/main/ssh/ssh-agent-identity-filter.ts:11`, `src/main/ssh/ssh-auth-resolution.ts:2`, `src/main/ssh/ssh-connection.ts:3`, `src/main/ssh/ssh-host-key-verifier.ts:81` (forbidden-import); `package.json` ssh2 and tweetnacl (forbidden-dependency). `ssh-connection.ts:41` is the closing line of an `import type {` block (`sed -n 33,41p src/main/ssh/ssh-connection.ts`), so the new rule leaves it unflagged; that is the carve-out working, not a miss. Note `node-runtime-pin.ts:174` (`unofficial-builds.nodejs.org/download/release`) is not matched by `nodejs.org/dist`; B4 deletes the file.

- [ ] **Step 5: Add the temporary Spec B rows.** Append to `config/local-only-allowlist.txt`:
  ```
  # ---- Spec B: temporary rows for code that later Spec B units delete. Remove each row with its file; B0.2 strips this block. ----
  # B4 skill-transfer rails and the pinned Node download (storage.googleapis.com, nodejs.org/dist).
  src/relay/skill-install-handler.ts:forbidden-host
  src/main/runtime/runtime-skill-install-commands.ts:forbidden-host
  src/main/skills/skill-ssh-package-transfer.ts:forbidden-host
  src/shared/node-runtime-pin.ts:forbidden-host
  # B5 end-to-end encryption for paired runtimes (tweetnacl).
  src/shared/e2ee-crypto.ts:forbidden-import
  package.json:forbidden-dependency:tweetnacl
  # B6 ssh2 client (value imports; type-only `import type { SFTPWrapper }` sites are exempt by rule).
  src/main/ssh/ssh-agent-identity-filter.ts:forbidden-import
  src/main/ssh/ssh-auth-resolution.ts:forbidden-import
  src/main/ssh/ssh-connection.ts:forbidden-import
  src/main/ssh/ssh-host-key-verifier.ts:forbidden-import
  package.json:forbidden-dependency:ssh2
  # ---- end Spec B ----
  ```
  Run `pnpm test config/scripts/check-local-only.test.mjs` and `pnpm run check:local-only`. Expected: all tests pass; `check-local-only: clean`.

- [ ] **Step 6: Document the rules.** In `docs/reference/local-only-architecture.md` line 136 append `nodejs.org/dist`, `storage.googleapis.com` to the forbidden-host list; line 137 append `ssh2` (and `ssh2/*`, `ssh2-*`), `tweetnacl` and the sentence `Type-only imports (`import type … from 'ssh2'`) are exempt, which is what keeps `@types/ssh2` for the managed hook installers.`; after line 140 add `- Allowlist rows are `path:rule` or `path:rule:match`; the three-segment form exempts one dependency name.`

- [ ] **Step 7: Verify and commit.** Run `pnpm tc`, `pnpm test config/scripts/check-local-only.test.mjs`, `pnpm run check:code-quality:changed`, `pnpm run check:local-only`. Expected: all green. Commit:
  ```
  feat(local-only): forbid ssh2, tweetnacl and pinned-download hosts in the guard

  Adds nodejs.org/dist and storage.googleapis.com to the forbidden hosts, ssh2/ssh2-*/tweetnacl to the forbidden modules with a type-only import carve-out, and path:rule:match allowlist rows. Temporary Spec B rows cover the files B4-B6 delete.

  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01PskLbdTqJNXxJ7KRnDoDoD
  ```

### Task B0.2: Strip the Spec B allowlist rows and fail on stale rows (TDD; lands after B6)

**Files:**
- Modify: `config/scripts/check-local-only.mjs` (new export `findStaleAllowlistRows`, `main`)
- Modify: `config/local-only-allowlist.txt` (delete the Spec B block from B0.1; delete line 23 `src/relay/port-scan-handler.ts:wildcard-bind`; delete lines 24-25 `# Remote-runtime pairing fixtures…` and `src/shared/mobile-relay-pairing-fixtures.ts:forbidden-host`)
- Modify: `docs/reference/local-only-architecture.md:121` (delete the pairing-fixtures bullet)
- Test: `config/scripts/check-local-only.test.mjs`

**Interfaces:** Consumes the allowlist file. Produces `findStaleAllowlistRows({ rootDir, allowlist }) → string[]` and a `main()` that exits 1 when a row names a missing file.

- [ ] **Step 1: RED test.** Add to the test file:
  ```js
  describe('findStaleAllowlistRows', () => {
    it('reports rows whose file no longer exists', () => {
      const root = base({ 'src/main/present.ts': '' })
      expect(
        findStaleAllowlistRows({
          rootDir: root,
          allowlist: new Set([
            'src/main/present.ts:forbidden-host',
            'src/main/gone.ts:forbidden-import',
            'package.json:forbidden-dependency:ssh2'
          ])
        })
      ).toEqual(['src/main/gone.ts:forbidden-import'])
    })
  })
  ```
  and to the `repository` describe: `it('has no stale allowlist rows', () => { const rootDir = path.resolve(import.meta.dirname, '../..'); expect(findStaleAllowlistRows({ rootDir, allowlist: readAllowlist(rootDir) })).toEqual([]) })`. Import `findStaleAllowlistRows`. Run; expected: fails (export missing).

- [ ] **Step 2: Implement.** Add `existsSync` to the `node:fs` import and:
  ```js
  export function findStaleAllowlistRows({ rootDir, allowlist }) {
    return [...allowlist].filter((row) => !existsSync(path.join(rootDir, row.split(':')[0])))
  }
  ```
  In `main`, before the violation loop: `for (const row of findStaleAllowlistRows({ rootDir, allowlist })) { console.error(`${row} [stale-allowlist-row] file does not exist`) }` and include the stale count in the non-zero exit condition.

- [ ] **Step 3: Strip rows.** Delete the whole `# ---- Spec B` … `# ---- end Spec B ----` block and the two pre-existing Spec B rows named above (confirm with `ls src/relay/port-scan-handler.ts src/shared/mobile-relay-pairing-fixtures.ts` that both are gone; if either still exists, the owning unit has not landed — stop). Run `pnpm run check:local-only`. Expected: `check-local-only: clean`, no stale rows.

- [ ] **Step 4: Verify and commit.** `pnpm tc`, `pnpm test config/scripts/check-local-only.test.mjs`, `pnpm run check:code-quality:changed`, `pnpm run check:local-only`. Commit:
  ```
  chore(local-only): drop the Spec B guard allowlist rows and fail on stale rows

  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01PskLbdTqJNXxJ7KRnDoDoD
  ```

## Unit B1 — Ephemeral VMs, VM recipes, `orca vm`, per-workspace-env guide, serve recipe rail

Decisions: `experimentalEphemeralVms` (settings types, defaults, telemetry schema), `Worktree.ephemeralVmCheckoutMode` / `WorktreeMeta.ephemeralVmCheckoutMode`, `EphemeralVmCheckoutMode`, `PersistedTrustedOrcaHookRepo.vmRecipe`, the plugin manifest field `contributes.vmRecipes` (the schema is `.strict()`, so dropping it would reject installed third-party manifests), `hasInstructionalPluginContributions`'s vmRecipes clause (it feeds the consent fingerprint), `hooks.ts:146` `'environmentRecipes'` in RECOGNIZED_ORCA_YAML_KEYS (recognised-but-ignored, so repos carrying the key do not get an unsatisfiable "update Orca" hint), `RuntimeEnvironmentSourceSchema`'s `'ephemeral-vm'` member, and the `'runtime:pending-ephemeral-vm'` id strings in tests all **stay inert**. `isEphemeralVmRuntimeEnvironment` + its callers (`project-host-setup-options.ts`, `use-add-repo-host-selection.ts`) go with B5; `isRuntimeOwnedSshTargetId`, `RUNTIME_OWNED_SSH_TARGET_ID_PREFIX`, `RemoveFolderDialog.tsx:57-62` and the per-workspace-env comments in SSH files go with B6. Order inside B1: renderer first so every commit typechecks.

### Task B1.1: Remove the ephemeral VM renderer and preload surfaces

**Files:**
- Delete: `src/renderer/src/components/settings/{CloudVmSetupGuide.tsx,CloudVmSetupGuide.test.tsx,ephemeral-vms-search.ts,EphemeralVmCleanupStopDialog.tsx,EphemeralVmRecipeRow.tsx,EphemeralVmRuntimeRow.tsx,EphemeralVmRuntimesSection.tsx,EphemeralVmRuntimesSection.test.tsx,EphemeralVmsExperimentalSetting.tsx,EphemeralVmsPane.tsx,EphemeralVmsPane.test.tsx,PluginVmRecipeConsentPreview.tsx}`; `src/renderer/src/hooks/useEphemeralVmRecipeOptions.ts` (+`.test.tsx`); `src/renderer/src/lib/{ephemeral-vm-failed-create-cleanup,ephemeral-vm-runtime-cleanup,ephemeral-vm-workspace-target,ephemeral-vm-worktree-creation,provisioned-root-create-options}.ts` and their tests (`ephemeral-vm-workspace-target.integration.test.ts` included); `src/renderer/src/store/slices/repos-ephemeral-vm-cleanup-retention.test.ts`; `src/renderer/src/store/slices/worktrees/teardown/orphaned-runtime-ssh-project-purge.ts` (loses both importers in this task); `src/preload/api/ephemeral-vm-api.ts`, `src/preload/api/ephemeral-vm-bridge.ts`.
- Modify (line deletes unless noted): `src/preload/index.ts:49,138`; `src/preload/api-types.ts:28,106`; `src/preload/api/plugin-host-api.ts:57-66`; `src/preload/api/worktree-api.ts:27,64`; `src/preload/api/worktrees-bridge.ts:31`; `src/renderer/src/components/settings/ExperimentalPane.tsx:13,269`; `experimental-search.ts:7,183,225-227`; `RuntimeEnvironmentsPane.tsx:7-8,235-238` (the `cloud-vm` wrapper div and its two children; also remove the `cloud-vm` entry from the workflow tab list in that file — `rg -n "'cloud-vm'" src/renderer/src/components/settings`); `PluginConsentDialog.tsx:7,56,225`; `PluginMarketplacePreviewDialog.tsx:76-88`; `src/renderer/src/hooks/composer-state/runtime-target-selection.ts:20,28,206-227,277-283` (`selectedRecipeRepoId`/`selectedRecipeRepoConnectionId` have no consumer outside this file and `runtime-target-model.ts` — confirmed with `rg -n selectedRecipeRepo src/renderer`); `runtime-target-model.ts:6,47-53`; `composer-card-props.ts:23-25,80,102,150-155`; `composer-card-contract.ts:12-14,63`; `composer-submit-orchestration.ts:195-196,208`; `quick-creation-execution.ts:8-9,21,56-57,69,163-197,218,282-283,295` plus two rewrites (`:205-207` → `executionHostId: workspaceRunContext?.hostId ?? selectedRepoExecutionHostId ?? undefined`; `:219-221` → `indeterminateProgress: getActiveRuntimeTarget(selectedRepoSettings).kind !== 'local'`); `quick-creation-request.ts:13,60`; `composer-target-input-contracts.ts:9`; `composer-target-state.ts:42`; `composer-target-store.ts:19,43,164`; `target-store-model.ts:27`; `src/renderer/src/hooks/useComposerState.ts:34`; `src/renderer/src/components/NewWorkspaceComposerModal.tsx:40,144`; `src/renderer/src/components/NewWorkspaceComposerCard.tsx:32,84,131,307`; `new-workspace/new-workspace-composer-card-props.ts:24,28,49-52` (drop the `OrcaHooks` import if now unused); `new-workspace/run-target-options.ts:1,9,12,19,21-50,68,71,88-93,107-109` (keep `buildRunTargetRows` returning `{ rows }` only; drop `recipes` and `matchedRecipes`); `new-workspace/RunTargetCombobox.tsx:20-23 (keep RUN_TARGET_ADD_HOST_KEY and buildRunTargetRows),26 (drop RecipesSubmenuRow),32-34,213-216` plus the `RecipesSubmenuRow` render and recipe state inside the component (read the file; delete the `selectedRecipe`, `recipesOpen` state and the `kind === 'recipes'` row branch); `new-workspace/RunTargetSubmenus.tsx:2 (Cloud icon),7-12,17-~120` (delete `RecipesSubmenuRow` whole; keep `AddHostSubmenuRow`); `new-workspace/NewWorkspaceComposerProjectSection.tsx:9,30-32,40,68-70,75,154-156,162-170`; `src/renderer/src/lib/pending-worktree-creation.ts:23 (→ `'preparing' | 'fetching' | 'creating'`),45-62,140,173-175`; `src/renderer/src/store/slices/worktree-helpers.ts:231,234-236` (drop `provisioningLog` and the `cleanupVm` option; line 236 becomes `removePendingWorktreeCreation: (creationId: string) => void`); `src/renderer/src/lib/worktree-creation-completion.ts:21` (drop the `, { cleanupVm: false }` argument — `rg -n cleanupVm src` must return nothing afterwards; do not widen the type to keep a caller compiling); `src/renderer/src/lib/worktree-creation-flow.ts:117,142-146` (→ `phase: 'fetching',`); `worktree-creation-flow-startup.ts:46-50` (delete `getInitialWorktreeCreationPhase`; at `worktree-creation-flow.ts:113` write `phase: 'fetching',`); `worktree-creation-flow-execute.ts:5-10,59,61-62 (→ `const backendStartup = structuredLaunch ? undefined : resolveBackendDraftStartup(preparedRequest)`),109,121-123,130,142-149`; `src/renderer/src/components/worktree-creation/WorktreeCreationPanel.tsx:45-47,103-~125 (the `isVmCreation ? <VmProvisioningStatus …/> :` branch; keep the non-VM branch),171-end (`VmProvisioningStatus`)`; `src/renderer/src/store/repos/repo-removal.ts:17,20,64-75`; `store/slices/worktrees/teardown/host-qualified-worktree-removal.ts:26-27,229-232`; `teardown/removed-worktree-renderer-teardown.ts:6,13,62-73`; `store/slices/worktrees/create/pending-worktree-creation.ts:4,63-81` (and the now-unused `options` parameter); `create/worktree-create-payload.ts:19-23`; `create/create-worktree.ts:47,51-55 (→ `target.kind === 'local' ? …` directly),184-186`; `src/renderer/src/hooks/composer-state/composer-store-actions.ts:59-63`; `src/renderer/src/components/sidebar/sleep-worktree-flow.ts:191-193`; `src/renderer/src/lib/sidebar-worktree-activation.ts:29-48` (then drop unused `toast`/`translate` imports); `src/renderer/src/lib/orca-hook-trust.ts:3` (→ `'setup' | 'archive' | 'issueCommand'`); `src/renderer/src/components/sidebar/OrcaYamlTrustDialog.tsx:21,28,61-62` (ternary ends `: 'setup'`); `src/renderer/src/lib/ensure-hooks-confirmed.ts:49-~62 (getVmRecipeTrustContent),299-300`; `src/shared/agent-feature-install-commands.ts:8,111-117`; `src/renderer/src/lib/agent-feature-install-commands.ts:8-10`; `src/shared/feature-interaction-catalog.ts:31,100`; `src/shared/feature-interaction-categories.ts:50`; `tests/e2e/worktree-lineage.spec.ts:256`.
- Test (prune the VM cases / mocks): `src/renderer/src/store/slices/worktrees-slice-test-harness.ts:71,107-111,225`; `repos-runtime-routing-fixture.ts:59-60,91-92,124-127`; `NewWorkspaceComposerCard.test.tsx`; `ExperimentalPane.test.tsx:18,191,199`; `SettingsSidebar.test.tsx:87`; `hooks/useSettingsNavigationMetadata.test.ts:181-183`; `PluginConsentDialog.test.tsx`; `PluginMarketplaceBrowser.test.tsx`; `sidebar/{active-worktree-focus-after-delete,sidebar-filter-state,sleep-worktree-activation-race,sleep-worktree-flow}.test.ts`; `terminal-pane/pty-transport-spawn-errors.test.ts`; `workspace-cleanup/workspace-cleanup-scanned-host-confirmation-removal.test.tsx`; `hooks/composer-state/quick-creation-request.test.ts`; `lib/{ensure-hooks-confirmed,sidebar-worktree-activation,worktree-creation-flow-dedupe,worktree-creation-flow-ready-toast,worktree-creation-flow-stranded-surface,worktree-creation-flow}.test.ts`; `store/slices/{workspace-cleanup-wrong-host-removal-guard,workspace-cleanup-wrong-host-removal,worktrees-create-base-status,worktrees-pending-creation-state,worktrees-remote-runtime-removal,worktrees-removal-state-cleanup,worktrees-workspace-selection-state}.test.ts`; `src/shared/agent-feature-install-commands.test.ts:122`; `src/shared/feature-interactions.test.ts:60`.

**Interfaces:** Consumes `window.api.ephemeralVm` (removed), `window.api.worktrees.adoptProvisionedRoot` (removed), `OrcaHooks.environmentRecipes` (still present until B1.2). Produces a composer "Run on" picker with hosts and Add host only, a worktree-creation flow with phases `preparing | fetching | creating`, and `PluginHostListEntry` without `vmRecipes`.

- [ ] **Step 1: Delete the files** listed under Delete (`git rm` each path; `git rm -r` is not needed, all are single files).
- [ ] **Step 2: Preload and shared cuts.** Apply the `src/preload/**`, `src/shared/agent-feature-install-commands.ts`, `feature-interaction-*` edits. Run `pnpm tc:web` (or `pnpm tc`) and let the error list drive the renderer edits in step 3; every error must map to a path above or be a new importer to add to this task.
- [ ] **Step 3: Renderer cuts.** Apply the Modify list top to bottom. Rules: delete lines; the only rewrites are the three single-expression collapses named inline (`executionHostId`, `indeterminateProgress`, `backendStartup`), `phase: 'fetching'`, the `OrcaHookScriptKind` union, and the trust-dialog ternary tail. Where a destructured parameter, import or `useCallback` dependency becomes unused, delete that line too (oxlint `no-unused-vars` is a gate).
- [ ] **Step 4: Tests.** Prune the VM cases and mocks in the Test list. For `worktrees-pending-creation-state.test.ts:191-…` delete the provisioned-root cleanup test; for `ensure-hooks-confirmed.test.ts` delete the `vmRecipe` cases; for `ExperimentalPane.test.tsx` delete the `ephemeral-vms` section assertions; `tests/e2e/worktree-lineage.spec.ts:256` delete (e2e typecheck is baselined at 166 errors, one new one is a regression).
- [ ] **Step 5: Verify.** `pnpm tc`; `pnpm test src/renderer/src/components/NewWorkspaceComposerCard.test.tsx src/renderer/src/hooks src/renderer/src/lib src/renderer/src/store src/renderer/src/components/settings src/renderer/src/components/sidebar src/shared/agent-feature-install-commands.test.ts src/shared/feature-interactions.test.ts`; `pnpm run check:code-quality:changed`; `pnpm run check:local-only`. Expected: tc clean, no new failing test files against `notes/local-only/after/`, guard clean. Confirm `rg -n "ephemeralVm|EphemeralVm|provisionedRoot|vmRecipe\b" src/renderer src/preload --glob '!*.test.*'` returns only `default-branch-workspace.ts:10` (inert meta read) and B5/B6-owned lines named in the unit decision.
- [ ] **Step 6: Commit.**
  ```
  refactor(local-only): remove the ephemeral VM renderer and preload surfaces

  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01PskLbdTqJNXxJ7KRnDoDoD
  ```

### Task B1.2: Remove ephemeral VM runtimes, VM recipes, the plugin recipe registry and `orca vm`

**Files:**
- Delete: `src/main/ephemeral-vm-{failed-start-cleanup,provisioned-root-source,recipe-runner,resume-integrity,runtime-attachment,runtime-cleanup-control,runtime-provisioning-persistence,runtime-service,runtime-ssh-cleanup,runtime-ssh}.ts` and `ephemeral-vm-{recipe-runner,resume-integrity,runtime-service,runtime-ssh-cleanup}.test.ts`; `src/main/provisioned-root-ssh-adoption.ts` (+`.test.ts`); `src/main/ipc/{ephemeral-vm,ephemeral-vm-runtime-handlers,ephemeral-vm-recipe-context}.ts` and `src/main/ipc/{ephemeral-vm,ephemeral-vm-provision-cancel,ephemeral-vm-provisioned-root-ref,ephemeral-vm-runtime-handler-cleanup}.test.ts`; `src/main/plugins/{plugin-approved-vm-recipes,plugin-vm-recipe-registry}.ts` (+`plugin-vm-recipe-registry.test.ts`); `src/shared/ephemeral-vm-*.ts` (all 22 files: `recipe-checkout-mode`, `recipe-destroy-result`, `recipe-diagnostics`, `recipe-doctor`, `recipe-lifecycle-payload`, `recipe-process`, `recipe-repo-url`, `recipe-runner`, `recipes`, `runtime-feature-store`, `runtime-rollback-projection`, `runtime-store`, `runtimes`, plus every `ephemeral-vm-*.test.ts`); `src/shared/plugins/plugin-vm-recipe-artifact.ts` (+`.test.ts`); `src/cli/handlers/vm.ts`; `src/cli/specs/vm.ts`; `src/cli/index-vm-recipe-doctor.test.ts`; `config/scripts/ephemeral-vm-runtime-store-cross-version.test.ts`; `config/scripts/run-ephemeral-vm-runtime-store-rollback-repro.mjs`; `tests/e2e/ephemeral-vm-cleanup-retry.spec.ts`; `tests/e2e/ephemeral-vm-provisioned-root.spec.ts`; `resources/plugins/launch/stablyai.orca-multipass-recipes/` (directory, 2 files).
- Modify: `src/main/ipc/register-core-handlers/register-core-handlers.ts:19,202`; `src/main/ipc/worktrees/create/register-worktree-create-handlers.ts:6,28,122-~166` (the whole `ipcMain.handle('worktrees:adoptProvisionedRoot', …)` call; drop `app` from the electron import if unused); `src/main/ipc/worktrees.ts:39`; `src/shared/worktree/create-types.ts:157-162`; `src/shared/orca-yaml-hook-types.ts:14-15,33-49` (keep `:31` and `:76`); `src/shared/orca-yaml.ts:5-6,101-194,235-237,249-250,264-265` plus the `ORCA_VM_RECIPE_ID_PATTERN`/`ORCA_VM_RECIPE_ID_RULE` constants if no other reference remains; `src/main/plugins/plugin-content-pack-registry.ts:8,15,26,48-49 (drop the `|| plugin.manifest.contributes.vmRecipes.length > 0` clause),74,76 (→ `await languagePacks`),100`; `src/main/plugins/plugin-list-projection.ts:10,68-73,117,188-193`; `src/main/plugins/plugin-artifact-validation.ts:5,54-59,165-192` (delete `validatePluginInstallContent` and its callers — `rg -n validatePluginInstallContent src`); `src/cli/index.ts:40`; `src/cli/handler-group-manifest.ts:202-206`; `src/cli/specs/index.ts:16,35`; `src/cli/root-help-text-primary.ts:38-40`; `resources/plugins/launch/orca-marketplace.json:15-24` (the multipass entry; fix the trailing comma of the previous entry); `src/shared/child-process/__fixtures__/child-process-import-allowlist.txt:166-167`; `config/reliability-gates.jsonc` gates `ephemeral-vm-recipe.output-tail-parity` (object at lines 256-341) and `ephemeral-vm-runtime.rollback-readable-sidecar` (2370-2585) — delete both objects whole and fix the separating commas; `config/scripts/pr-e2e-source-routing.mjs:59-66`; `config/scripts/pr-e2e-gate-contract.test.mjs:45-47,402-409`; `config/scripts/windows-cmd-shim-spawn-boundary.test.mjs:42`; `.github/workflows/pr.yml:218-237`; `.github/workflows/e2e.yml:309-313` (keep only the `grep -l 'ORCA_E2E_SSH_DOCKER'` clause; B6 removes the rest).
- Test: `src/main/ipc/register-core-handlers/register-core-handlers.test.ts:29,88,283-285,387`; `src/main/ipc/worktrees-create-metadata-persistence.test.ts:21`; `src/main/hooks-orca-yaml-parsing.test.ts:181-~235` (both recipe tests); `src/main/refused-tree-kill-root-termination.test.ts:30` (+ the case using `killRecipeProcess`); `src/main/plugins/{plugin-content-pack-registry,plugin-content-safety,plugin-discovery,plugin-kill-list-content-revocation,plugin-launch-content,plugin-list-projection}.test.ts` (`plugin-launch-content.test.ts:68-70,75` → expected set `['language', 'command-keybinding']`); `src/shared/plugins/{plugin-consent-fingerprint,plugin-content-pack-contributions,plugin-language-pack-artifact}.test.ts`; `src/cli/handler-group-manifest.test.ts` (any `vm` row); `src/shared/constants.test.ts` (check for VM keys).

**Interfaces:** Consumes nothing new. Produces `OrcaHooks` without `environmentRecipes`/`environmentRecipeDiagnostics`, no `worktrees:adoptProvisionedRoot` channel, no `vm` CLI group, `PluginContentPackRegistry` with language packs and commands only.

- [ ] **Step 1: Delete the files**, then `pnpm tc` to list the importers; every error must map to the Modify list.
- [ ] **Step 2: Apply the Modify edits.** Line deletes only, except the three expression collapses named inline. For the two gate objects, verify boundaries before cutting: `node -e "const {parse}=require('jsonc-parser');const g=parse(require('fs').readFileSync('config/reliability-gates.jsonc','utf8')).gates;console.log(g.findIndex(x=>x.id==='ephemeral-vm-recipe.output-tail-parity'),g.findIndex(x=>x.id==='ephemeral-vm-runtime.rollback-readable-sidecar'))"` then delete each object from its `{` line to its closing `},`.
- [ ] **Step 3: Apply the Test edits.** Delete the VM cases; keep every unrelated case.
- [ ] **Step 4: Verify.** `pnpm tc`; `pnpm test src/main/ipc src/main/plugins src/main/hooks-orca-yaml-parsing.test.ts src/main/refused-tree-kill-root-termination.test.ts src/shared/plugins src/shared/child-process/child-process-import-boundary.test.ts src/cli config/scripts/pr-e2e-gate-contract.test.mjs config/scripts/windows-cmd-shim-spawn-boundary.test.mjs`; `pnpm run check:reliability-gates`; `pnpm run check:code-quality:changed`; `pnpm run check:local-only`. Expected: all green; the child-process ratchet reports no stale row. Confirm `rg -n "ephemeral-vm|EphemeralVm|VmRecipe|vm-recipe|provisioned-root" src --glob '!*.test.*'` leaves only the inert sites listed in the unit decision.
- [ ] **Step 5: Commit.**
  ```
  refactor(local-only): remove ephemeral VM runtimes, VM recipes and the orca vm CLI

  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01PskLbdTqJNXxJ7KRnDoDoD
  ```

### Task B1.3: Drop the `orca serve` VM-recipe rail (`--recipe-json`, `--serve-recipe-json`, `--serve-project-root`)

**Files:**
- Delete: `src/shared/serve-option-validation.ts`, `src/shared/serve-option-validation.test.ts`
- Modify: `src/cli/specs/serve.ts:7-12`; `src/cli/handlers/core.ts:6,84-102`; `src/cli/runtime/launch.ts:4,10-13,22,80-100,105,112-116,134-136,150-233`; `src/cli/root-help-text-secondary.ts:39`; `src/main/startup/serve-options.ts:1-4,8-9,22-81,89-93,97-107`; `src/main/startup/serve-mode-argv.ts:13,16,24-25,138-141`; `src/main/startup/main-process-serve.ts:1-2,12-22,37-39`; `src/main/server/serve-readiness.ts:40-42,68-77`
- Test: `src/cli/index-serve-command.test.ts:62-66,69-92`; `src/cli/runtime/launch.test.ts` (the `RECIPE_JSON`/`SSH_RECIPE_JSON` constants, `startRecipeJsonServer`, and the four recipe tests at the end of the file); `src/main/server/serve-readiness.test.ts:94-112`; `src/main/startup/serve-options.test.ts`; `src/main/startup/serve-mode-argv.test.ts:29-40,56,61-67,95-110,130-158,161-167,186-187,195-207`; `src/main/startup/serve-mode-argv-cli-redirect-order.test.ts:23,36`

**Interfaces:** Consumes `serveOrcaApp`, `getServeOptions`, `normalizeServeModeArgv`, `renderServeReadiness`. Produces `serveOrcaApp(args: { json?: boolean })`, `ServeOptions = { json: boolean }`, `ServeReadinessOutput = { mode: 'human' | 'json' }`; `orca serve --recipe-json` is rejected by the generic unknown-flag check.

- [ ] **Step 1: RED test.** Replace `src/cli/index-serve-command.test.ts:69-92` with:
  ```ts
  it('rejects the removed --recipe-json flag as unknown', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const priorExitCode = process.exitCode

    await main(['serve', '--recipe-json'], '/tmp/repo')

    expect(serveOrcaAppMock).not.toHaveBeenCalled()
    expect([...logSpy.mock.calls, ...errSpy.mock.calls].flat().join('\n')).toMatch(/recipe-json/)
    expect(process.exitCode).toBe(1)

    process.exitCode = priorExitCode
  })
  ```
  and change the expectation at `:62-66` to `toHaveBeenCalledWith({ json: true })`. Run `pnpm test src/cli/index-serve-command.test.ts`; expected: both fail (the flag is still allowed and the call still carries `recipeJson`/`projectRoot`).
- [ ] **Step 2: CLI spec and handler.** `src/cli/specs/serve.ts` → `usage: 'orca serve [--json]'`, `allowedFlags: [...GLOBAL_FLAGS]`, delete the `Use --recipe-json …` note. `src/cli/handlers/core.ts`: delete line 6; replace the `serve` handler with:
  ```ts
  serve: async ({ json }) => {
    process.exitCode = await serveOrcaApp({ json })
  },
  ```
  `src/cli/root-help-text-secondary.ts:39` → `'  orca serve [--json]',`.
- [ ] **Step 3: launch.ts.** Delete the `StringDecoder` import (:4), the `ephemeral-vm-recipes` import (:10-13), `IGNORED_NON_RECIPE_STDOUT` (:22) and `waitForRecipeJson` (:150-233). Replace `serveOrcaApp` (:80-148) with:
  ```ts
  export function serveOrcaApp(args: { json?: boolean } = {}): Promise<number> {
    const executable = resolveForegroundOrcaExecutable()
    const childArgs = [...getExecutableAppArgs(executable)]
    childArgs.push('--serve')
    if (args.json) {
      childArgs.push('--serve-json')
    }

    const handoffPath = getMacAppBundlePath(executable)
      ? getServeUpdateHandoffPath(getDefaultUserDataPath())
      : null
    const childEnv = stripElectronRunAsNode(process.env)
    if (handoffPath) {
      childEnv[SERVE_UPDATE_HANDOFF_PATH_ENV] = handoffPath
    }
    const spawnOptions: SpawnOptions = {
      detached: false,
      cwd: resolveAppRoot(),
      stdio: handoffPath ? ['inherit', 'inherit', 'inherit', 'ipc'] : 'inherit',
      ...getExecutableSpawnOptions(executable),
      env: childEnv
    }
    const interruptedHandoff = handoffPath ? readServeUpdateHandoffSync(handoffPath) : null
    if (interruptedHandoff?.phase === 'install-requested') {
      // Why: the node-mode CLI is not an NSRunningApplication, so it can retain launchd ownership while ShipIt swaps the app.
      return resumeInterruptedServeUpdate({
        executable,
        childArgs,
        spawnOptions,
        spawnChild: spawnProcess,
        handoffPath: handoffPath!,
        handoff: interruptedHandoff
      })
    }
    const child = spawnProcess(executable, childArgs, spawnOptions)
    return superviseForegroundServe({
      executable,
      childArgs,
      spawnOptions,
      spawnChild: spawnProcess,
      child,
      handoffPath,
      expectedHandoff: null
    })
  }
  ```
  (B2.1 replaces this body again; the handoff lines are kept here on purpose so each commit is self-contained.)
- [ ] **Step 4: Main-process option parsing.** `serve-options.ts`: delete the validation import (:1-4), the two fields (:8-9), `lastValueOccurrence`/`valueAfter`/`lastBooleanValue` (:22-81), the typo check (:89-93) and the recipe fields/validation (:97-107) so the file ends with:
  ```ts
  export function getServeOptions(argv: readonly string[]): ServeOptions {
    const optionsArgv = optionsBeforeTerminator(argv)
    return {
      // The CLI uses `flags.has('json')`, so even `--json=false` enables JSON output.
      json: hasFlag(optionsArgv, ['--serve-json', '--json'])
    }
  }
  ```
  `serve-mode-argv.ts`: delete the `['--recipe-json', '--serve-recipe-json']` entry (:13); line 16 → `const CLI_TO_SERVE_VALUE_FLAG = new Map<string, string>()` (the value-flag rewrite stays as the #12677 guard; B5 removes `--environment`/`--pairing-code` from `VALUE_TAKING_FLAGS`); delete `...CLI_TO_SERVE_VALUE_FLAG.keys(),` and `'--serve-project-root',` (:24-25); delete the `--recipe-json=false` comment lines (:138-141). `main-process-serve.ts`: delete `statSync`/`isAbsolute` imports (:1-2), the recipe validation (:12-22), and replace the output ternary (:37-39) with `{ mode: options.json ? 'json' : 'human' }`. `serve-readiness.ts`: `ServeReadinessOutput` → `export type ServeReadinessOutput = { mode: 'human' | 'json' }` (:40-42); delete the `recipe-json` branch (:68-77).
- [ ] **Step 5: Tests.** `serve-readiness.test.ts:94-112` delete both recipe tests. `serve-options.test.ts`: keep `parses a valid launch` (expected `{ json: true }`), `keeps JSON enabled for an equals-form global flag`, add `it('accepts Chromium switches', () => { expect(getServeOptions(['/AppRun', '--serve', '--disable-gpu', '--disable-features=Vulkan']).json).toBe(false) })` and `ignores serve-looking arguments after the terminator` (expected `{ json: false }`, argv `['/AppRun', '--serve', '--', '--serve-json']`); delete the rest. `serve-mode-argv.test.ts`: `--user-data-dir` is in `VALUE_TAKING_FLAGS` but not in `CLI_TO_SERVE_VALUE_FLAG`, so it is passed through, never rewritten to a `--serve-*` form. Therefore **delete** every case that asserts a `--serve-project-root` output (`:29-40`, `:61-67` recipe-json, `:95-110`, `:130-158`, `:161-167`) and **retarget** only the value-consumption cases: `:56` → `argvRequestsServeMode(['/AppRun', 'serve', '--user-data-dir', 'help'])` is `true`; `:186-187` → `['/AppRun', 'serve', '--json', '--', '--user-data-dir', '1']` rewrites to `['/AppRun', '--serve', '--serve-json', '--', '--user-data-dir', '1']`; in the fuzz alphabet (`:195-207`) replace `'--project-root'` with `'--user-data-dir'`, `'--project-root=1'` with `'--user-data-dir=1'`, and delete `'--recipe-json=false'`. `serve-mode-argv-cli-redirect-order.test.ts:23` → `'--user-data-dir'`, `:36` → `expect(rewritten).toContain('--user-data-dir')` (passthrough, not a `--serve-*` form). `launch.test.ts`: delete `RECIPE_JSON`, `SSH_RECIPE_JSON`, `INVALID_SSH_RECIPE_JSON`, the `SSH_*` secret constants, `IGNORED_NON_RECIPE_STDOUT`, `startRecipeJsonServer`, the `encodePairingOffer`/`PAIRING_OFFER_VERSION` import, and the four recipe tests (`prints recipe JSON…`, `waits past startup status lines…`, `preserves UTF-8 recipe JSON…`, `rejects when the server exits without valid recipe JSON`).
- [ ] **Step 6: Verify.** `pnpm tc`; `pnpm test src/cli src/main/startup src/main/server src/shared/serve-option-validation.test.ts`; `pnpm run check:code-quality:changed`; `pnpm run check:local-only`. Expected: green; `serve-electron-flag-parity.test.ts` still has `json` as a translated flag so its guard case passes. Confirm `rg -n "recipe-json|recipeJson|serve-project-root|projectRoot" src/cli src/main/startup src/main/server src/shared --glob '!*.test.*'` returns nothing.
- [ ] **Step 7: Commit.**
  ```
  refactor(local-only): drop the orca serve VM-recipe rail

  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01PskLbdTqJNXxJ7KRnDoDoD
  ```

### Task B1.4: Remove the per-workspace-env skill guide and regenerate catalogs, manifests and i18n

**Files:**
- Delete: `skill-guides/orca-per-workspace-env.md`; `skill-guides/orca-per-workspace-env/` (directory, `references/*.md`); `skill-stubs/orca-per-workspace-env.md`; `skills/orca-per-workspace-env/` (directory); `config/scripts/skill-recipe-shell.test.mjs`
- Modify: `config/scripts/generate-bundled-skill-guides.mjs:20,31,45`; `config/scripts/generate-bundled-skill-guides.test.mjs:38-44,52-57` (and the three per-workspace-env `it` blocks starting at ~:100, ~:118, ~:160); `config/scripts/skill-critical-guidance.test.mjs:23-29`; `config/scripts/locale-ko-key-overrides.json:2237-2242`; `src/renderer/src/i18n/ko-ui-semantic-mistranslations.test.ts:11-12`; `config/scripts/ci-shard-timings.json` (prune the 35 keys matching `ephemeral-vm|EphemeralVm|vm-recipe|VmRecipe|provisioned-root|CloudVmSetupGuide|index-vm-recipe-doctor|useEphemeralVmRecipeOptions|repos-ephemeral-vm|serve-option-validation`)
- Generated (never hand-edited): `src/cli/bundled-skill-guides.ts`; `resources/skills/current-manifest.json` (and `snapshot-registry.json`/`release-mapping.json` only if the generator rewrites them); `src/renderer/src/i18n/locales/{en,es,fr,ja,ko,zh}.json`; `src/renderer/src/i18n/en-runtime-required.json`
- Test: `src/renderer/src/i18n/locale-english-regression.test.ts`, `src/renderer/src/i18n/plugin-chrome-allowlist.test.ts` (only if the sync removes a key they pin)

**Interfaces:** Consumes the generators `generate-bundled-skill-guides.mjs`, `generate-skill-bundle-manifest.mjs`, `verify-localization-catalog.mjs --fix`, `generate-runtime-required-english-catalog.mjs --fix`. Produces a skill bundle of `computer-use`, `orca-cli`, `orca-emulator`, `orca-emulator-android`, `orchestration` and locale catalogs without the VM namespaces.

- [ ] **Step 1: Delete the guide, stub and skill directories** (`git rm -r`), delete `skill-recipe-shell.test.mjs`, and remove `'orca-per-workspace-env'` from the three lists in `generate-bundled-skill-guides.mjs` (lines 20, 31, 45).
- [ ] **Step 2: Regenerate skill artifacts.** Run `node config/scripts/generate-bundled-skill-guides.mjs --write` then `node config/scripts/generate-skill-bundle-manifest.mjs --write`, then `pnpm run verify:bundled-skill-guides && pnpm run verify:skill-bundle-manifest`. Expected: both verifiers pass; `resources/skills/current-manifest.json` no longer lists the skill. If `verify:skill-bundle-manifest` rejects the stale `orca-per-workspace-env` rows in `snapshot-registry.json:1796` or `release-mapping.json`, read `generate-skill-bundle-manifest.mjs:455-560` and apply its documented removal path (the history rows describe released tags, which still contain the skill tree).
- [ ] **Step 3: Script tests.** Delete the per-workspace-env entries and the three `it` blocks that read the corpus in `generate-bundled-skill-guides.test.mjs`; delete the `preserves paid approvals and provision retry authority` test in `skill-critical-guidance.test.mjs`. Run `pnpm test config/scripts/generate-bundled-skill-guides.test.mjs config/scripts/skill-critical-guidance.test.mjs`.
- [ ] **Step 4: i18n.** First delete the two `EphemeralVmsPane` entries from `config/scripts/locale-ko-key-overrides.json:2237-2242` and from `ko-ui-semantic-mistranslations.test.ts:11-12` (`locale-key-override-merge.mjs` applies `KO_KEY_OVERRIDES` during `--fix`, so a stale override would be re-injected into `ko.json` and fail the verifier). Then run `pnpm run sync:localization-catalog && pnpm run sync:localization-runtime-catalog`, then `pnpm run verify:localization-catalogs && pnpm run verify:localization-extraction && pnpm run verify:localization-coverage`. Expected: the six locale files and `en-runtime-required.json` lose the `EphemeralVmsPane`, `EphemeralVmRuntimesSection`, `CloudVmSetupGuide`, `PluginVmRecipeConsentPreview`, `ephemeralVms`, `NewWorkspaceComposerCard.ephemeralVm`/`perWorkspaceEnvHint`/`destroy*`, `PluginMarketplacePreviewDialog.vmRecipes*`, `sidebarWorktreeActivation.wakeEphemeralVmFailed` and `lib.ephemeralVmWorkspaceTarget` keys; verifiers pass. Then run `pnpm test src/renderer/src/i18n config/scripts/locale-ko-key-overrides.test.mjs`.
- [ ] **Step 5: Shard timings.** Prune the stale keys from `config/scripts/ci-shard-timings.json` (optional per the brief; do it here so the file is touched once).
- [ ] **Step 6: Verify and commit.** `pnpm tc`; the tests above; `pnpm run check:code-quality:changed`; `pnpm run check:local-only`. Commit:
  ```
  chore(local-only): regenerate skill guides, catalogs and CI after the VM removal

  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01PskLbdTqJNXxJ7KRnDoDoD
  ```

## Unit B2 — Serve-update handoff

Decision: the handoff had one producer, the auto-updater removed in Spec A. Removing it also removes the IPC stdio channel, so the macOS-only "serve child quits when the CLI parent disconnects" behaviour (`installServeSupervisorDisconnectQuit`) goes with it; signal forwarding (SIGINT/SIGTERM/SIGHUP) and exit-code propagation stay. The reduced supervisor lives in a new file named after what it does; `serve-update-supervisor.ts` is deleted rather than rewritten.

### Task B2.1: Remove the serve-update handoff and keep a plain foreground supervisor (TDD)

**Files:**
- Delete: `src/main/serve-update-handoff.ts`, `src/main/serve-update-handoff.test.ts`, `src/main/serve-update-handoff.app-environment.test.ts`, `src/shared/serve-update-handoff.ts`, `src/cli/runtime/serve-update-supervisor.ts`
- Create: `src/cli/runtime/serve-foreground-supervisor.ts`
- Modify: `src/cli/runtime/launch.ts` (imports `:6-9,14,16-20` and the `serveOrcaApp` body from B1.3); `src/cli/runtime/mac-app-update-bundle.ts:1-2,5,17-85` (keep `getMacAppBundlePath`); `src/main/startup/main-process-serve.ts:3,42`; `src/main/startup/main-process-preflight.ts:20,292-298` (line 291 is the live `installDevParentSignalQuit(shouldCoupleToDevParent)` call and stays); `src/main/startup/browser-process-user-agent-ordering.test.ts:81`; `src/shared/child-process/__fixtures__/child-process-import-allowlist.txt:35` (row becomes `src/cli/runtime/serve-foreground-supervisor.ts`; the ratchet counts type-only `node:child_process` imports); `config/reliability-gates.jsonc` gate `runtime.headless-desktop-promotion-continuity`: `:3556` (surface `"update install handoff"`, fix the preceding comma), `:3572` (command), `:3580` (testFile), `:3597-3606` (launch.test.ts assertions), `:3607-3614` (the `serve-update-handoff.test.ts` ref object), `:3616-3618` (signal-test assertion), `:3692-3701` (the 2026-07-21 evidenceRun, whose command no longer matches any gate command — `check-reliability-gates.mjs:200` rejects it), and the handoff clauses in `coverageNotes`/`invariant`/`oracle` (`:3559,3563,3564`); `config/scripts/ci-shard-timings.json:3595-3596`
- Test: `src/cli/runtime/launch.test.ts` (imports `:6-14`; delete the four `it.runIf(process.platform === 'darwin')` handoff tests; add the RED test below); `src/cli/runtime/serve-signal-exit-diagnostic.test.ts:2-4,7-11,38-47,155-185` (`superviseUntilExit` at 30-35 stays)

**Interfaces:** Consumes `serveSignalExitError`, `QUIT_RENDERER_ACK_TIMEOUT_MS`, `WILL_QUIT_TEARDOWN_DEADLINE_MS`. Produces `superviseForegroundServe(child: ChildProcess): Promise<number>`, `SERVE_CHILD_FORCE_KILL_GRACE_MS`, `SERVE_CHILD_FORCE_KILL_SCHEDULING_MARGIN_MS`; `serveOrcaApp` spawns with `stdio: 'inherit'` and no `ORCA_SERVE_UPDATE_HANDOFF_PATH`.

- [ ] **Step 1: RED test.** Add to the `serveOrcaApp` describe in `launch.test.ts` (it needs no new imports):
  ```ts
  it('spawns a plain foreground child with inherited stdio and no update handoff', async () => {
    const child = new FakeChildProcess()
    spawnMock.mockReturnValue(child)

    const result = serveOrcaApp({ json: true })
    queueMicrotask(() => child.emit('exit', 0, null))
    await expect(result).resolves.toBe(0)

    expect(spawnMock).toHaveBeenCalledWith(
      '/Applications/Orca.app/Contents/MacOS/Orca',
      ['--serve', '--serve-json'],
      expect.objectContaining({
        stdio: 'inherit',
        env: expect.not.objectContaining({ ORCA_SERVE_UPDATE_HANDOFF_PATH: expect.anything() })
      })
    )
  })
  ```
  Run `pnpm test src/cli/runtime/launch.test.ts`. Expected on macOS: fails (`stdio` is the four-element array and the env carries the handoff path because `getMacAppBundlePath` resolves the `.app`).
- [ ] **Step 2: Create `src/cli/runtime/serve-foreground-supervisor.ts`:**
  ```ts
  import type { ChildProcess } from 'node:child_process'
  import {
    QUIT_RENDERER_ACK_TIMEOUT_MS,
    WILL_QUIT_TEARDOWN_DEADLINE_MS
  } from '../../shared/quit-teardown-deadline'
  import { serveSignalExitError } from './serve-signal-exit-diagnostic'

  export const SERVE_CHILD_FORCE_KILL_SCHEDULING_MARGIN_MS = 5_000
  export const SERVE_CHILD_FORCE_KILL_GRACE_MS =
    QUIT_RENDERER_ACK_TIMEOUT_MS +
    WILL_QUIT_TEARDOWN_DEADLINE_MS +
    SERVE_CHILD_FORCE_KILL_SCHEDULING_MARGIN_MS

  /** Keeps a foreground `orca serve` child under the CLI's signals and propagates its exit. */
  export async function superviseForegroundServe(child: ChildProcess): Promise<number> {
    const result = await waitForForegroundChild(child)
    if (typeof result.code === 'number' || result.signalWasForwarded) {
      return result.code ?? 0
    }
    throw serveSignalExitError(result.signal)
  }

  function waitForForegroundChild(child: ChildProcess): Promise<{
    code: number | null
    signal: NodeJS.Signals | null
    signalWasForwarded: boolean
  }> {
    return new Promise((resolveWait, reject) => {
      const forwardsHangup = process.platform === 'linux'
      const forwardedSignals = new Set<NodeJS.Signals>()
      let forceKillTimer: ReturnType<typeof setTimeout> | null = null
      const forwardSignal = (signal: NodeJS.Signals): void => {
        // A Windows console delivers Ctrl-C to parent and child; child.kill would terminate the child mid-teardown.
        if (process.platform !== 'win32') {
          forwardedSignals.add(signal)
          child.kill(signal)
        }
        forceKillTimer ??= setTimeout(() => child.kill('SIGKILL'), SERVE_CHILD_FORCE_KILL_GRACE_MS)
      }
      const cleanup = (): void => {
        process.off('SIGINT', forwardSignal)
        process.off('SIGTERM', forwardSignal)
        if (forwardsHangup) {
          process.off('SIGHUP', forwardSignal)
        }
        if (forceKillTimer) {
          clearTimeout(forceKillTimer)
        }
      }
      process.on('SIGINT', forwardSignal)
      process.on('SIGTERM', forwardSignal)
      if (forwardsHangup) {
        process.on('SIGHUP', forwardSignal)
      }
      const handleExit = (code: number | null, signal: NodeJS.Signals | null): void => {
        cleanup()
        resolveWait({
          code,
          signal,
          signalWasForwarded: signal !== null && forwardedSignals.has(signal)
        })
      }
      child.once('error', (error) => {
        cleanup()
        child.off('exit', handleExit)
        reject(error)
      })
      child.once('exit', handleExit)
    })
  }
  ```
- [ ] **Step 3: launch.ts.** Delete the `serve-update-handoff` import (:6-9), the `getDefaultUserDataPath` import (:14) and the supervisor import block (:16-20); add `import { superviseForegroundServe } from './serve-foreground-supervisor'`. Replace `serveOrcaApp` with:
  ```ts
  export function serveOrcaApp(args: { json?: boolean } = {}): Promise<number> {
    const executable = resolveForegroundOrcaExecutable()
    const childArgs = [...getExecutableAppArgs(executable)]
    childArgs.push('--serve')
    if (args.json) {
      childArgs.push('--serve-json')
    }
    const spawnOptions: SpawnOptions = {
      detached: false,
      cwd: resolveAppRoot(),
      stdio: 'inherit',
      ...getExecutableSpawnOptions(executable),
      env: stripElectronRunAsNode(process.env)
    }
    return superviseForegroundServe(spawnProcess(executable, childArgs, spawnOptions))
  }
  ```
  (`getMacAppBundlePath` stays imported for `launchOrcaApp`.)
- [ ] **Step 4: Delete the handoff files** and trim `mac-app-update-bundle.ts` to:
  ```ts
  import { dirname } from 'node:path'

  export function getMacAppBundlePath(executable: string): string | null {
    if (process.platform !== 'darwin') {
      return null
    }
    const macOsDir = dirname(executable)
    const contentsDir = dirname(macOsDir)
    const appBundlePath = dirname(contentsDir)
    return appBundlePath.endsWith('.app') ? appBundlePath : null
  }
  ```
  `main-process-serve.ts`: delete lines 3 and 42. `main-process-preflight.ts`: delete line 20 and lines 292-298 (the six-line "Why not at module scope" comment at 292-297 plus the `installServeSupervisorDisconnectQuit(state.isServeMode)` call at 298; line 291 `installDevParentSignalQuit(shouldCoupleToDevParent)` stays). `browser-process-user-agent-ordering.test.ts:81`: delete the `vi.mock('../serve-update-handoff', …)` line. Allowlist row `:35` → `src/cli/runtime/serve-foreground-supervisor.ts` (keep the list sorted: it follows `src/cli/runtime/launch.ts`).
- [ ] **Step 5: Signal-diagnostic test.** In `serve-signal-exit-diagnostic.test.ts` import `SERVE_CHILD_FORCE_KILL_GRACE_MS`, `SERVE_CHILD_FORCE_KILL_SCHEDULING_MARGIN_MS`, `superviseForegroundServe` from `./serve-foreground-supervisor`; replace `superviseChild` (:38-47) with `function superviseChild(child: FakeChildProcess): Promise<number> { return superviseForegroundServe(child as never) }` (the `as never` already exists on the `child` argument today); delete the `does not terminate an exited child when update handoff completion fails late` test (:155-185) and the now-unused `mkdtemp`/`rm`/`tmpdir`/`join` imports (:2-4). In `launch.test.ts` delete the `serve-update-handoff` and `serve-update-supervisor` imports (:6-14) and the four darwin handoff tests (`keeps the serve supervisor alive…`, `records a replacement version mismatch…`, `records replacement spawn failure…`, `fails a replacement that never reports runtime readiness…`).
- [ ] **Step 6: Reliability gate.** Apply the `reliability-gates.jsonc` edits listed under Files: delete the `"update install handoff"` surface, the `src/main/serve-update-handoff.test.ts` token from the first command, its `testFiles` row and its `assertionRefs` object, the 2026-07-21 `evidenceRuns` object, and the three handoff clauses in `coverageNotes`/`invariant`/`oracle`; replace the `launch.test.ts` assertion strings with `"a foreground serve child inherits stdio and receives no update-handoff environment"` and `"the Electron child cwd is pinned to the app root"`, and the `serve-signal-exit-diagnostic.test.ts` assertion with `"a child exit through the caller-forwarded SIGINT is graceful"`. Run `pnpm run check:reliability-gates`. Expected: passes (every `testFiles` entry exists and is named by a command; every evidence run's command matches a gate command). Delete `ci-shard-timings.json:3595-3596`.
- [ ] **Step 7: Verify.** `pnpm tc`; `pnpm test src/cli/runtime/launch.test.ts src/cli/runtime/serve-signal-exit-diagnostic.test.ts src/main/startup/browser-process-user-agent-ordering.test.ts src/main/startup/desktop-startup-ordering.test.ts src/shared/child-process/child-process-import-boundary.test.ts`; `pnpm run check:reliability-gates`; `pnpm run check:code-quality:changed`; `pnpm run check:local-only`. Expected: the step-1 test is GREEN, the signal tests pass unchanged, the child-process ratchet reports no stale and no unlisted row. Then `rg -n "serve-update|ServeSupervisor|SERVE_UPDATE_HANDOFF|waitForMacBundleVersion" src config .github --glob '!tests/e2e/.cross-version-checkouts/**'` returns nothing.
- [ ] **Step 8: Commit.**
  ```
  refactor(local-only): remove the serve-update handoff supervisor

  The auto-updater left Spec A, so nothing produces a handoff. The CLI still forwards SIGINT/SIGTERM/SIGHUP to the serve child and propagates its exit; the macOS disconnect-quit coupling leaves with the IPC channel.

  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01PskLbdTqJNXxJ7KRnDoDoD
  ```
---

## Planner group: b3-b4

## Units B3 (orcad) and B4 (transfer rails, pinned downloads, WSL OpenCode reader)

Shape after reading the code (the design allows a split): the orcad **standalone runtime** (`src/main/orcad/**`, build scripts, template, CI) and the **WSL OpenCode reader** have no B6 importers and land before B6. The orcad **deploy side** (`src/main/ssh/orcad-*`), the **pinned-runtime download rail** and `node-runtime-pin` are imported by ~20 `src/main/ssh/ssh-relay-*`/`remote-node-runtime-store-*`/`src/relay` files that B6 deletes, and they themselves import SSH core (`ssh-connection`, `ssh-relay-deploy-helpers`, `sftp`); `node-pty-precondition.ts:28` imports `../ssh/build-toolchain-diagnosis` (B6). Those files therefore go in **one commit with B6's SSH deletion** (Task B3.2, which absorbs B4.3). The skill-transfer rails (B4.1) can land before B6 with two line-cuts in files B6 deletes anyway.

Keep-inert decisions (executors must not "clean up"): `SkillInstallDestinationSchema`'s `ssh` executionTarget member (existing fail-closed throw `skill-install-ssh-dispatch-required` at `src/main/skills/skill-install-destinations.ts:73-74`); the `'orcad'` literals in `src/shared/telemetry-daemon-event-schemas.ts:212`, `src/main/startup/main-process-state.ts:49`, `src/main/persistence/profile-state/profile-state-startup-authority.ts:10,22-36`; the `orcad-template`/server-slot branches in `config/scripts/verify-linux-glibc-floor.cjs` (dead but harmless packaging guards); the `download-grant`/`staged-upload` ingress members of `src/shared/skill-install-contract.ts` and `skill-bundle-install-contract.ts` (nothing consumes them after B4.1); the `wslOpenCodeReaders` consumer chain in `src/main/ai-vault/session-scanner-opencode-wsl-*.ts` (receives no readers after B4.2; `session-scanner-service-env.ts` and the sqlite process client have local importers).

Line numbers below were verified on `57f87b013d`; B0–B2 may shift them, so match on the quoted text.

### Task B3.1: Delete the standalone orcad runtime, its build pipeline, packaging template, CI and docs (safe before B6)
**Files:**
Delete:
- `src/main/orcad/**` EXCEPT the 7-file quartet KEEP list (deleted in B3.2 because `src/relay/{relay-runtime-self-test,pty-handler,node-pty-binding-survey,node-pty-unavailable-diagnosis}.ts` import them and `node-pty-prebuilt-slot.ts:26` imports `node-runtime-pin`): `native-host-abi.ts`, `native-host-abi.test.ts`, `node-pty-loader-diagnosis.ts`, `node-pty-precondition.ts`, `node-pty-precondition.test.ts`, `node-pty-prebuilt-slot.ts`, `node-pty-prebuilt-slot.test.ts`. Everything else under `src/main/orcad/` goes, including `__fixtures__/fake-orcad-electron-sidecar.cjs`, `orcad-node-slot-fixture.ts`, `orcad-health.ts`, `orcad-entry.ts`, `orcad-session-search.ts`.
- `src/shared/orcad-agent-browser-name.ts` (importers: deleted config scripts and `src/main/orcad/orcad-agent-browser-binary.ts`).
- `config/scripts/`: `build-orcad.mjs`, `build-orcad-node.mjs`, `build-orcad-template.mjs`, `build-orcad-template.test.mjs`, `build-orcad-prebuilds.mjs`, `build-orcad-prebuilds.test.mjs`, `merge-orcad-prebuilds.mjs`, `merge-orcad-prebuilds.test.mjs`, `orcad-artifact-version.mjs`, `orcad-artifact-version.test.mjs`, `orcad-entry-build.mjs`, `orcad-operations-restart-safety.test.mjs`, `orcad-prebuild-slot-contents.mjs`, `orcad-prebuild-slot-contents.test.mjs`, `orcad-prebuild-smoke-child.cjs`, `orcad-prebuild-smoke.mjs`, `orcad-template-release-workflow.test.mjs`, `orcad-template-test-fixture.mjs`, `orcad-watcher-package.mjs`, `orcad-watcher-package.test.mjs`, `orcad-windows-process-tree.mjs`, `orcad-windows-process-tree.test.mjs`, `packaged-orcad-template.cjs`, `packaged-orcad-template.test.mjs`, `verify-packaged-orcad-template.cjs`, `verify-packaged-orcad-template.test.mjs`, `node-server-change-scope.mjs`, `node-server-change-scope.test.mjs`, `node-server-qualification.mjs`, `node-server-qualification.test.mjs`, `node-server-test-paths.mjs`, `run-node-server-tests.mjs`, `profile-state-worker-smoke.mjs`, `profile-state-worker-smoke.test.mjs`. KEEP for B3.2: `check-node-runtime-pin.*`, `update-node-runtime-pin.*`, `node-dist-archive-name.mjs`, `pinned-node-downloads.mjs`, `server-build-target.mjs`.
- `config/scripts/ssh-hostile-hosts-workflow.test.mjs` (B6-owned, but it reads `node-server-tests.yml` at `:29`; deleting it here keeps this commit green — B6 must not expect it).
- `.github/workflows/node-server-tests.yml`
- `docs/reference/orcad-operations.md`
- `src/main/persistence/profile-state/profile-state-cross-runtime.integration.test.ts` (Bun-vs-pinned-Node orcad gate; imports the deleted slot fixture).
Modify: `src/main/server/serve-readiness.ts:2,28-35,90,102-113`; `src/main/server/serve-readiness.test.ts:7,25-44,122-157`; `src/main/daemon/pty-subprocess-io-failure-native.test.ts:4,13`; `src/main/startup/headless-pty-hydration-ordering.test.ts:40-114`; `src/main/ai-vault-search/session-search-host-registration.test.ts:159-185`; `src/main/runtime/orca-runtime-structured-status-sink-wiring.test.ts:58-62`; `tests/e2e/fixtures/daemon-generation-profile-store.ts:1-14`; `config/electron-builder.config.cjs:27-33,104-105,182-185,312,400-404,502`; `package.json:34,46-48,296`; `pnpm-lock.yaml` (via `pnpm install`); `.github/workflows/pr.yml:45,663-700,1110,1146-1147,1186`; `.github/workflows/release-cut.yml:1152-1164,1203,1207-1209,1438-1443,1594-1598,1779-1784,2265`; `.github/workflows/release-mac-build.yml:18,151-157,197`; `config/scripts/release-cut-token-permissions.test.mjs:18-23,30-51`; `config/scripts/ci-cache-warmup-workflow.test.mjs:4,69`; `config/scripts/pr-code-change-scope.mjs:28,110-115,391-392`; `config/scripts/pr-code-change-scope.test.mjs:25,264-282`; `config/scripts/pr-workflow-parallelism.test.mjs:512,523-526`; `config/scripts/check-runtime-electron-ratchet.mjs:37-41,120`; `config/runtime-electron-baseline.txt:4`; `config/scripts/check-runtime-launcher-protocol-ratchet.mjs:13-14,19-23`; `docs/reference/linux-glibc-compatibility.md:93-136`; `config/scripts/ci-shard-timings.json` (prune).
Test: `src/main/server/serve-readiness.test.ts`, `src/main/daemon/pty-subprocess-io-failure-native.test.ts`, `src/main/startup/headless-pty-hydration-ordering.test.ts`, `src/main/ai-vault-search/session-search-host-registration.test.ts`, `src/main/runtime/orca-runtime-structured-status-sink-wiring.test.ts`, `config/scripts/{pr-code-change-scope,pr-workflow-parallelism,release-cut-token-permissions,ci-cache-warmup-workflow,check-runtime-electron-ratchet,check-runtime-launcher-protocol-ratchet,electron-builder-config,skill-sharing-release-workflow}.test.mjs`.
**Interfaces:** Consumes: Spec A tree (no orcad consumer outside `src/main/ssh`, `src/relay`, `serve-readiness.ts`, four tests and one e2e fixture — verified by `rg`). Produces: `ServeReadiness` without the `health` field; `pnpm build:*` with no orcad template extraResource/beforePack/afterPack hooks; `pr.yml` without the `orcad_browser` job; no `test:node-server`/`build:orcad*` scripts; the quartet and `src/main/ssh/orcad-*` left in place for B3.2.
- [ ] **Step 1: Delete the orcad runtime tree except the quartet.** Run `cd /Users/abhijitbansal/projects/orca-local && ls src/main/orcad | grep -v -E '^(native-host-abi|node-pty-loader-diagnosis|node-pty-precondition|node-pty-prebuilt-slot)(\.test)?\.ts$' | sed 's#^#src/main/orcad/#' | xargs git rm -r -q` then `git rm src/shared/orcad-agent-browser-name.ts`. Expected: `ls src/main/orcad` lists exactly the 7 KEEP files.
- [ ] **Step 2: Delete the build/CI scripts, workflow, doc and cross-runtime test.** `git rm config/scripts/build-orcad* config/scripts/merge-orcad-prebuilds* config/scripts/orcad-* config/scripts/packaged-orcad-template.* config/scripts/verify-packaged-orcad-template.* config/scripts/node-server-* config/scripts/run-node-server-tests.mjs config/scripts/profile-state-worker-smoke.* config/scripts/ssh-hostile-hosts-workflow.test.mjs .github/workflows/node-server-tests.yml docs/reference/orcad-operations.md src/main/persistence/profile-state/profile-state-cross-runtime.integration.test.ts`. Expected: `ls config/scripts | grep -iE 'orcad|node-server'` prints nothing.
- [ ] **Step 3: Drop `health` from serve readiness (the Electron host never populated it).** In `src/main/server/serve-readiness.ts` delete line 2 (`import type { OrcadHealth } from '../orcad/orcad-health'`), lines 28-35 (the `/** Build identity ... */` comment and `health?: OrcadHealth`), line 90 (`...(readiness.health ? { health: readiness.health } : {})` — also remove the now-trailing comma on the `pairing: readiness.pairing` line above it), and lines 102-113 (the whole `if (readiness.health) { ... }` block in `renderHumanReadiness`). In `serve-readiness.test.ts` delete line 7, lines 25-44 (`const health: OrcadHealth = {...}` and its blank line) and lines 122-157 (the tests `carries build identity, Node ABI and the daemon self-test in the JSON contract` and `says out loud when the daemon self-test failed`, plus the blank line between). Keep `omits the health block entirely when a host does not report one` unchanged (it still passes). Expected: `pnpm test src/main/server/serve-readiness.test.ts` green.
- [ ] **Step 4: Inline the node-pty loader in the local daemon test.** In `src/main/daemon/pty-subprocess-io-failure-native.test.ts` delete line 4 (`import { loadNodePtyForTests } from '../orcad/orcad-node-slot-fixture'`) and change line 13 from `    nodePty = await loadNodePtyForTests()` to `    nodePty = await import('node-pty')`. Expected: `pnpm test src/main/daemon/pty-subprocess-io-failure-native.test.ts` green on macOS (the gate `pnpm test src/main/daemon/pty-subprocess-io-failure-native.test.ts` in `config/reliability-gates.jsonc:2060` keeps working; no gate edit).
- [ ] **Step 5: Trim tests that read orcad sources.** `src/main/startup/headless-pty-hydration-ordering.test.ts`: delete lines 40-114 (the blank line after the second test's `})` through the end of `captures spool-replayed identity after the orcad runtime is ready`), leaving the final `})` at the old line 115. `src/main/ai-vault-search/session-search-host-registration.test.ts`: delete lines 159-185 (`it('orcad resolves no roots while disabled and discovers late roots when enabled', ...)` through its `})` and the following blank line). `src/main/runtime/orca-runtime-structured-status-sink-wiring.test.ts`: replace lines 58-60 with `/** \`worktree ps\` reads structured rows only from the agent-status store, so an entry point that\n *  constructs a runtime without these lists no agents at all. */` and change line 62 to `  it.each([['startup/main-process-runtime-service.ts']])(`. Expected: all three files green under `pnpm test`.
- [ ] **Step 6: Replace the e2e fixture's orcad host adapters.** Overwrite the top of `tests/e2e/fixtures/daemon-generation-profile-store.ts` so the file reads:
```ts
import path from 'node:path'
import process from 'node:process'
import type { Store } from '../../../src/main/persistence'
import { createProfileStateStore } from '../../../src/main/persistence/profile-state/profile-state-store-factory'
import { setAppEnvironment } from '../../../src/shared/app-environment'
import { setSecretStore } from '../../../src/shared/secret-store'

// Plain-Node host adapters for the fixture child: no Electron, no OS keyring.
function installFixtureHostAdapters(directory: string): void {
  setAppEnvironment({
    getPath: () => directory,
    getAppPath: () => directory,
    getVersion: () => '0.0.0-fixture',
    isPackaged: () => true,
    onWillQuit: () => {},
    exit: (code = 0) => process.exit(code),
    getAppMetrics: () => []
  })
  setSecretStore({
    isEncryptionAvailable: () => false,
    encryptString: () => {
      throw new Error('fixture_secret_sealing_unavailable')
    },
    decryptString: () => {
      throw new Error('fixture_secret_sealing_unavailable')
    },
    describeProtectionGap: () => 'Fixture host has no OS keyring.'
  })
}

export function createDaemonGenerationProfileStore(directory: string): Store {
  installFixtureHostAdapters(directory)
  // The bundled fixture has no profile writer worker; use the synchronous SQLite authority.
  return createProfileStateStore({
    dataFile: path.join(directory, 'orca-data.json'),
    databaseFile: path.join(directory, 'profile-state.sqlite'),
    profileId: 'legacy-close-fixture'
  }).store
}
```
Expected: `rg -n "orcad" tests/e2e` prints nothing; `pnpm exec tsc -p tests/e2e/tsconfig.json --noEmit` reports no new errors beyond the Spec A baseline of 166 (compare against `notes/local-only/after/`).
- [ ] **Step 7: Unwire the orcad template from electron-builder.** In `config/electron-builder.config.cjs` delete lines 27-33 (`const { assertOrcadTemplateBuilt, ..., orcadTemplateMacSignIgnore } = require('./scripts/packaged-orcad-template.cjs')`), lines 104-105 (`orcadTemplateExtraResource,` / `orcadTemplateNodeModulesExtraResource,` in `commonExtraResources`), lines 182-185 (`'!out/orcad{,/**/*}'`, the `// Never in app.asar` comment, `'!out/orcad-*{,/**/*}'`, `'!out/.orcad-*{,/**/*}'`), line 312 (`assertOrcadTemplateBuilt()`), lines 400-404 (`await finalizePackagedOrcadTemplate(resourcesDir, { ... })`), and change line 502 to `    signIgnore: [...bundledRipgrepMacSignIgnore],`. Expected: `pnpm test config/scripts/electron-builder-config.test.mjs` green; `node -e "require('./config/electron-builder.config.cjs')"` exits 0.
- [ ] **Step 8: Remove scripts and the `tar` devDependency.** In `package.json` delete line 34 (`"test:node-server": ...`), lines 46-48 (`build:orcad`, `build:orcad-template`, `build:orcad-prebuilds`) and line 296 (`"tar": "7.5.22",` — its only importer was `config/scripts/orcad-watcher-package.mjs`; confirm with `rg -n "from 'tar'|require\('tar'\)" src config tests` printing nothing). Run `pnpm install` so `pnpm-lock.yaml` drops the `tar` subtree. Expected: `git diff --stat pnpm-lock.yaml` shows only removals.
- [ ] **Step 9: Remove the `orcad_browser` CI job and the template release plumbing.** `.github/workflows/pr.yml`: delete line 45 (`orcad_browser: ${{ ... }}` output), lines 663-700 (the `# Why a separate job: the test needs a real Chrome` comment through the `orcad_browser` job's last step and trailing blank line), line 1110 (`- orcad_browser` in `verify.needs`), lines 1146-1147 (`ORCAD_BROWSER` / `ORCAD_BROWSER_SHOULD_RUN` env), line 1186 (`check_job orcad_browser ...`). `.github/workflows/release-cut.yml`: delete lines 1152-1164 (the `# Design D2` comment and the `orcad-template:` job through `build_template: true` plus blank), line 1203 (`- orcad-template` in `build.needs`), lines 1207-1209 (`env:` / `# beforePack and afterPack fail ...` / `ORCA_REQUIRE_ORCAD_TEMPLATE: '1'`), lines 1438-1443 (`# After the app build ...` comment and the `Download the orcad deployment template` step), lines 1594-1598 (the PowerShell `# The orcad template's Linux/macOS addons ...` comment, `if ($relative -match '^resources[\\/]orcad-template...')`, `$skipped.Add(...)`, `return`, `}`), lines 1779-1784 (`# Why: SignPath rewrote the template's ...` comment and the `Reseal the orcad template over its signed binaries` step), line 2265 (`- orcad-template` in `build-mac.needs`). `.github/workflows/release-mac-build.yml`: delete line 18 (`# actions: read downloads the orcad template ...` — keep `actions: read`, the relay-addons download still needs it until B6), lines 151-157 (`# Design D2 ...` comment and the `Download the orcad deployment template from the release run` step), line 197 (`ORCA_REQUIRE_ORCAD_TEMPLATE: '1'`). Expected: `pnpm test config/scripts/pr-workflow-parallelism.test.mjs config/scripts/release-cut-token-permissions.test.mjs config/scripts/skill-sharing-release-workflow.test.mjs` green after Step 10.
- [ ] **Step 10: Update the workflow-contract tests.** `config/scripts/release-cut-token-permissions.test.mjs`: delete lines 18-23 (the six `.github/workflows/node-server-tests.yml#...` rows) and lines 30-51 (`[`${RELEASE_WORKFLOW}#orcad-template`]` and the six `orcad-template -> node-server-tests.yml#...` rows). `config/scripts/ci-cache-warmup-workflow.test.mjs`: delete line 4 (`import { NODE_SERVER_RUNNERS } from './node-server-qualification.mjs'`) and change line 69 to `    ['windows-2022', 'windows-11-arm']` (the literal `windows-*` subset of the deleted `NODE_SERVER_RUNNERS`). `config/scripts/pr-code-change-scope.mjs`: delete line 28 (`'orcad_browser',`), lines 110-115 (`const ORCAD_BROWSER_PREFIXES = [...]` and its blank line), lines 391-392 (`case 'orcad_browser':` and its `return`). `config/scripts/pr-code-change-scope.test.mjs`: delete line 25 (`'orcad_browser',`) and lines 264-282 (`it('runs orcad browser when Chrome launch, session, or tab modules change', ...)` through its closing `})` and blank line). `config/scripts/pr-workflow-parallelism.test.mjs`: delete line 512 (`'orcad_browser',`) and lines 523-526 (the two `// Why assert this one too` comment lines and the two `ORCAD_BROWSER` expects). Expected: `pnpm test config/scripts/pr-code-change-scope.test.mjs config/scripts/pr-workflow-parallelism.test.mjs config/scripts/release-cut-token-permissions.test.mjs config/scripts/ci-cache-warmup-workflow.test.mjs` green.
- [ ] **Step 11: Trim the runtime ratchets.** `config/scripts/check-runtime-electron-ratchet.mjs`: delete lines 38-41 (the `// Why orcad too:` comment and `path.join(ROOT, 'src', 'main', 'orcad', 'main.ts')`) and drop the trailing comma on line 37 so `ENTRY_POINTS` ends with `runtime-rpc.ts')`; change line 120 to `    '# (\`orca serve\` and the CLI runtime). Any entry means the runtime got less portable;',` and change `config/runtime-electron-baseline.txt` line 4 to the identical text `# (\`orca serve\` and the CLI runtime). Any entry means the runtime got less portable;`. `config/scripts/check-runtime-launcher-protocol-ratchet.mjs`: delete lines 13-14 (`// orcad handoff to its bundled runtime...` and `'src/main/orcad/orcad-bundled-runtime.ts',`) and lines 19-23 (`// orcad slot layout...`, `'src/shared/orcad-artifacts.ts',`, `'config/scripts/build-orcad.mjs',`, `'config/scripts/build-orcad-node.mjs',`, `'config/scripts/build-orcad-template.mjs',`). Leave lines 15-18 and 24-25 for B3.2. Expected: `pnpm run check:runtime-electron-ratchet` prints `ok — 0 entries, unchanged.`; `node config/scripts/check-runtime-electron-ratchet.mjs --write` leaves `git diff config/runtime-electron-baseline.txt` showing only the line-4 wording change; `pnpm test config/scripts/check-runtime-electron-ratchet.test.mjs config/scripts/check-runtime-launcher-protocol-ratchet.test.mjs` green.
- [ ] **Step 12: Prune the glibc doc and stale shard timings.** In `docs/reference/linux-glibc-compatibility.md` delete lines 93-136 (paragraphs **3.** `Check before loading, on hosts that ship without a compiler (orcad)`, **4.** `Ship the binary, built from patched sources.` and the `linux-x64-glibc217` compat-slot paragraph, which link to deleted files and `node-server-tests.yml`); keep the blank line before `## Adding or upgrading a native dependency`. Then run `node -e "const fs=require('fs');const p='config/scripts/ci-shard-timings.json';const t=JSON.parse(fs.readFileSync(p,'utf8'));for(const k of Object.keys(t.unit.timings))if(!fs.existsSync(k))delete t.unit.timings[k];fs.writeFileSync(p,JSON.stringify(t,null,2)+'\n')"`. Expected: `rg -n "orcad|node-server" config/scripts/ci-shard-timings.json` prints nothing; `rg -n "build-orcad|node-server-tests" docs/reference/linux-glibc-compatibility.md` prints nothing.
- [ ] **Step 13: Sweep for stragglers.** Run `rg -n "orcad/|orcad-|build:orcad|test:node-server|node-server-" src tests config .github skills skill-guides docs/site package.json -g '!src/main/ssh/**' -g '!src/relay/**' -g '!src/main/orcad/**' -g '!config/scripts/check-runtime-launcher-protocol-ratchet.*' -g '!config/scripts/ci-shard-timings.json' -g '!config/scripts/*node-runtime-pin*' -g '!config/scripts/pinned-node-downloads.mjs' -g '!config/scripts/server-build-target.mjs' -g '!src/main/ai-vault/opencode-wsl-runtime-preparation*' -g '!.github/workflows/ssh-*.yml' -g '!.github/workflows/release-cut.yml'`. Expected: only comment/prose mentions remain (`src/main/observability/logs-directory.ts:11`, `src/main/runtime/runtime-session-search-settings.ts:7`, `orca-runtime-state-fields.ts:114`, `mobile-session-terminal-retirement.ts:118`, `orca-chromium-process-pids.ts`, `worker-thread-entry-path.ts:30`, `bundled-ripgrep-path.ts:33`, `port-scan-command-client.test.ts`, `verify-linux-glibc-floor*.`, `config/relay-assets/node-pty-*.cjs`, `docs/reference/{agent-status-store,agent-session-search-contract,ci-demand-rollout,ci-runner-efficiency,local-only-architecture}.md` — hand the doc wording to B8). Any import hit is a missed edit.
- [ ] **Step 14: Verify.** `pnpm tc`; `pnpm test src/main/server/serve-readiness.test.ts src/main/daemon/pty-subprocess-io-failure-native.test.ts src/main/startup/headless-pty-hydration-ordering.test.ts src/main/ai-vault-search/session-search-host-registration.test.ts src/main/runtime/orca-runtime-structured-status-sink-wiring.test.ts config/scripts/pr-code-change-scope.test.mjs config/scripts/pr-workflow-parallelism.test.mjs config/scripts/release-cut-token-permissions.test.mjs config/scripts/ci-cache-warmup-workflow.test.mjs config/scripts/check-runtime-electron-ratchet.test.mjs config/scripts/check-runtime-launcher-protocol-ratchet.test.mjs config/scripts/electron-builder-config.test.mjs config/scripts/skill-sharing-release-workflow.test.mjs`; `pnpm run check:reliability-gates`; `pnpm run check:runtime-electron-ratchet`; `pnpm run check:code-quality:changed`; `pnpm run check:local-only`. Expected: all green; no new failing test files against `notes/local-only/after/`.
- [ ] **Step 15: Commit.** `git add -A && git commit -m "refactor(local-only): remove the orcad standalone runtime, its build pipeline and CI" -m "Deletes src/main/orcad (except the four node-pty files the SSH relay still imports), the orcad build/template/node-server scripts, node-server-tests.yml, the orcad_browser PR job, the release template plumbing, docs/reference/orcad-operations.md and the tar devDependency. ServeReadiness loses its never-populated health field." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -m "Claude-Session: https://claude.ai/code/session_01PskLbdTqJNXxJ7KRnDoDoD"`.

### Task B4.2: Remove the WSL OpenCode vault reader and its nodejs.org Node download into WSL (safe before B6)
**Files:**
Delete: `src/main/ai-vault/opencode-wsl-runtime-preparation.ts`, `src/main/ai-vault/opencode-wsl-runtime-preparation.test.ts`.
Modify: `src/main/ai-vault/cached-session-list.ts:11,70`; `src/main/ai-vault/cached-session-list-wsl-probe.test.ts:18-20` plus one new assertion; `config/scripts/ci-shard-timings.json` (prune).
Test: `src/main/ai-vault/cached-session-list-wsl-probe.test.ts` (TDD), `src/main/ai-vault/cached-session-list.test.ts` if present, `src/main/ai-vault-search/session-search-scan-roots.test.ts` if present.
**Interfaces:** Consumes: `localAiVaultScanRoots()` in `cached-session-list.ts` (the only caller of `prepareOpenCodeWslReaders`; verified by `rg`). Produces: `localAiVaultScanRoots()` returns no `wslOpenCodeReaders` key; the downstream `session-scanner-opencode-wsl-*` chain stays in place and sees no readers (AI Vault on Windows loses OpenCode sessions stored inside WSL, per the design decision). Removes the only importer of `src/main/ssh/relay-bundle-paths.ts`, `ssh-remote-platform.ts`, `orcad-deployment-target.ts`, `orcad-remote-node-runtime.ts` and `pinned-runtime-materializer.ts` outside `src/main/ssh`/`src/main/orcad`.
- [ ] **Step 1 (RED): Assert the listing no longer prepares WSL OpenCode readers.** In `src/main/ai-vault/cached-session-list-wsl-probe.test.ts`, inside the test `spawns no wsl.exe for native-only codex homes when no distro is installed` (lines 56-69), append after the existing `expect(scanAiVaultSessionsInWorker).toHaveBeenCalledWith(...)`:
```ts
    expect(scanAiVaultSessionsInWorker).toHaveBeenCalledWith(
      expect.not.objectContaining({ wslOpenCodeReaders: expect.anything() }),
      expect.anything()
    )
```
Run `pnpm test src/main/ai-vault/cached-session-list-wsl-probe.test.ts`. Expected: that test FAILS (the mocked `prepareOpenCodeWslReaders` returns `[]`, so `wslOpenCodeReaders: []` is present).
- [ ] **Step 2: Delete the reader preparation.** `git rm src/main/ai-vault/opencode-wsl-runtime-preparation.ts src/main/ai-vault/opencode-wsl-runtime-preparation.test.ts`. In `src/main/ai-vault/cached-session-list.ts` delete line 11 (`import { prepareOpenCodeWslReaders } from './opencode-wsl-runtime-preparation'`) and line 70 (`    wslOpenCodeReaders: await prepareOpenCodeWslReaders(wslHomeDirs),`). In `cached-session-list-wsl-probe.test.ts` delete lines 18-20 (the `vi.mock('./opencode-wsl-runtime-preparation', ...)` block). Expected: `pnpm test src/main/ai-vault/cached-session-list-wsl-probe.test.ts` GREEN including the Step 1 assertion; `pnpm tc` green (the return type's `Pick<AiVaultScanOptions, 'executionHostId' | 'wslOpenCodeReaders'>` member is optional).
- [ ] **Step 3: Confirm nothing else referenced the file and prune timings.** `rg -n "opencode-wsl-runtime-preparation|prepareOpenCodeWslReaders" src tests config docs` must print nothing except `config/scripts/ci-shard-timings.json`; then run the same shard-timings prune one-liner as B3.1 Step 12. `rg -n "nodejs\.org|orcad-artifacts" src/main/ai-vault` must print nothing.
- [ ] **Step 4: Verify.** `pnpm tc`; `pnpm test src/main/ai-vault src/main/ai-vault-search/session-search-scan-roots.test.ts`; `pnpm run check:code-quality:changed`; `pnpm run check:local-only`. Expected: all green.
- [ ] **Step 5: Commit.** `git add -A && git commit -m "refactor(local-only): drop the WSL OpenCode vault reader and its pinned Node download" -m "AI Vault on Windows no longer downloads the pinned Node from nodejs.org into a WSL distro to read OpenCode's SQLite history; OpenCode sessions stored inside WSL are no longer listed. The downstream wslOpenCodeReaders consumers stay in place and receive no readers." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -m "Claude-Session: https://claude.ai/code/session_01PskLbdTqJNXxJ7KRnDoDoD"`.

### Task B4.1: Remove the skill-transfer RPC family and transfer rails (can land before B6)
**Files:**
Delete: `src/main/skills/skill-package-download.ts`, `skill-package-download.test.ts`, `skill-package-download-availability.ts`, `skill-install-request-service.ts`, `skill-install-request-service.test.ts`, `skill-bundle-install-request-service.ts`, `skill-ssh-package-transfer.ts`, `skill-ssh-relay-client.ts`, `skill-ssh-relay-destination.ts`, `skill-ssh-relay-service.ts`, `skill-ssh-relay-service.test.ts`, `skill-bundle-ssh-relay-service.ts`, `skill-bundle-ssh-relay-service.test.ts`, `skill-transfer-rpc-retry.ts`, `skill-remote-error-category-parity.test.ts`, `skill-windows-workspace.integration.test.ts` (imports the request service), `skill-upload-archive-hash.ts`, `skill-upload-operation-lifecycle.ts`, `skill-upload-process-restart-child.test.ts`, `skill-upload-process-restart.integration.test.ts`, `skill-upload-retained-paths.ts`, `skill-upload-session-admission-regression.test.ts`, `skill-upload-session-record.ts`, `skill-upload-session-service-options.ts`, `skill-upload-session-service.ts`, `skill-upload-session-service.test.ts`, `skill-upload-staging-ownership.ts`; `src/shared/skill-upload-session-contract.ts`, `src/shared/skill-ssh-relay-contract.ts`; `src/relay/skill-install-handler.ts`, `src/relay/skill-install-handler.test.ts`, `src/relay/skill-upload-multi-relay.integration.test.ts`; `src/main/runtime/runtime-skill-install-commands.test.ts` (all three cases are SSH routing).
Modify: `src/main/runtime/rpc/methods/skills.ts:11-35,97-136,151-170`; `src/shared/rpc-contract/skills-params.ts:1,4-10`; `src/main/runtime/runtime-skill-install-commands.ts` (whole file shrinks to the base class below); `src/main/runtime/runtime-skill-install-authority.ts:9,13-14,21,24-92`; `src/main/runtime/runtime-skill-install-queries.ts:7-12,19-20,24,27-28,31,35-45,55-65,75-85,94-135,187-189,205-216`; `src/main/runtime/runtime-skill-command-contract.ts:2-14,26-36,44-45,50-56,98`; `src/main/runtime/runtime-skill-types.ts:16-19`; `src/main/runtime/orca-runtime-state-fields.ts:178`; `src/main/startup/main-process-quit.ts:211,246`; `src/main/ipc/skill-install-management-ipc-handlers.ts:201-204`; `src/shared/relay-work-drain-contract.ts:1,11-12`; `src/relay/relay-work-admission.test.ts:4,62`; `src/relay/relay-daemon.ts:16,153` and `src/relay/relay-runtime-services.ts:24,34,79,105,134-138` (only while those B6 files still exist); `src/main/skills/skill-operation-observability.test.ts:20,265-283,297`; `src/main/runtime/rpc/methods/skills.test.ts:51-58,130-251`; `src/main/runtime/runtime-skill-install-queries.test.ts:3-4,7-12,21-106` plus one new test; `src/main/runtime/runtime-skill-install-authority.test.ts:17`; `src/main/ipc/skill-install-management-ipc-handlers.test.ts` (one new test); `config/scripts/win32-test-lane-registration.test.mjs:116-117`; `config/scripts/skill-sharing-release-workflow.test.mjs:65`; `package.json:35`; `config/reliability-gates.jsonc` (gate `skill-upload.cross-process-staging-ownership`, lines 18029-18166); `src/shared/rpc-contract/rpc-params-catalog.generated.ts` (regenerate); `config/local-only-allowlist.txt` (B0's Spec B rows); `config/scripts/ci-shard-timings.json` (prune).
Test: `src/main/runtime/runtime-skill-install-queries.test.ts`, `src/main/ipc/skill-install-management-ipc-handlers.test.ts` (TDD), `src/main/runtime/rpc/methods/skills.test.ts`, `src/main/runtime/runtime-skill-install-authority.test.ts`, `src/main/skills/skill-operation-observability.test.ts`, `src/main/skills/skill-install-destinations.test.ts`, `src/relay/relay-work-admission.test.ts`, `config/scripts/{skill-sharing-release-workflow,win32-test-lane-registration}.test.mjs`.
**Interfaces:** Consumes: `resolveSkillInstallDestination` (`skill-install-destinations.ts:73-74`) already throws `skill-install-ssh-dispatch-required` for an `ssh` executionTarget — that is the fail-closed seam B4.1 relies on. Produces: RPC methods `skills.install`, `skills.installBundle`, `skills.cancelInstall`, `skills.getInstallProgress`, `skills.beginUpload`, `skills.uploadChunk`, `skills.commitUpload`, `skills.cancelUpload` gone (no renderer/preload/CLI caller — verified by `rg`); `skills.discover/previewDelete/delete/previewInstall/removeInstall/listManagedInstalls` unchanged; `RuntimeSkillCommandSurface` loses the install/progress/cancel/upload members and `skillInstallDestinationUsesSsh`; `listManagedSkillInstalls()` takes no argument; the only remaining `https://storage.googleapis.com` strings are in tests.
- [ ] **Step 1 (RED): IPC listing fails closed for an `ssh:` environment id.** Append to `describe('skill install management IPC', ...)` in `src/main/ipc/skill-install-management-ipc-handlers.test.ts` (add `import { SKILL_INSTALL_UPDATE_REQUIRED_MESSAGE } from '../../shared/skill-install-capability'` next to the existing import):
```ts
  it('fails closed for an ssh environment id instead of listing a remote host', async () => {
    supportsManagementMock.mockResolvedValue(false)
    const listManagedSkillInstalls = vi.fn(async () => [])
    registerSkillInstallManagementIpcHandlers({ listManagedSkillInstalls } as never)
    const handler = handlers.get('skills:listManagedInstalls')
    expect(handler).toBeDefined()

    await expect(handler!(null, 'ssh:host-1')).resolves.toEqual({
      status: 'unsupported',
      message: SKILL_INSTALL_UPDATE_REQUIRED_MESSAGE
    })
    expect(listManagedSkillInstalls).not.toHaveBeenCalled()
  })
```
Run `pnpm test src/main/ipc/skill-install-management-ipc-handlers.test.ts`. Expected: FAILS (today the `ssh:` branch calls `runtime.listManagedSkillInstalls('host-1')` and returns `status: 'ok'`).
- [ ] **Step 2 (RED): preview on an SSH destination rejects instead of dispatching.** In `src/main/runtime/runtime-skill-install-queries.test.ts` add, after the `uses the account-managed Claude config directory` test:
```ts
  it('rejects an SSH destination with skill-install-ssh-dispatch-required instead of dispatching', async () => {
    const host: RuntimeSkillCommandHost = {
      getRuntimeId: () => 'runtime-1',
      getUserDataPath: () => '/tmp/orca-runtime-skill-test',
      isPackaged: () => true,
      getSettings: () => ({}),
      listRepos: () => [],
      listFolderWorkspaces: () => [],
      listResolvedWorktrees: async () => [],
      showManagedWorktree: async () => {
        throw new Error('unused')
      },
      getSshProvider: () => ({ requestHostRpc: vi.fn() }) as never,
      skillTransactionRecovery: Promise.resolve()
    }

    await expect(
      new RuntimeSkillInstallQueries(host).previewSharedSkillInstallRequest({
        package: {
          packageId: 'package-1',
          versionId: 'version-1',
          packageDigest: 'a'.repeat(64),
          archiveSha256: 'b'.repeat(64),
          compressedBytes: 100
        },
        name: 'example',
        destination: { scope: 'global', executionTarget: { kind: 'ssh', connectionId: 'ssh-1' } }
      })
    ).rejects.toThrow('skill-install-ssh-dispatch-required')
  })
```
Run it. Expected: FAILS (today `sshTarget()` finds the provider and routes to `previewSkillInstallOnSshHost`). After Step 6 remove the `getSshProvider:` line from this new test (the host type loses it).
- [ ] **Step 3: Delete the rail files.** `git rm src/main/skills/skill-package-download.ts src/main/skills/skill-package-download.test.ts src/main/skills/skill-package-download-availability.ts src/main/skills/skill-install-request-service.ts src/main/skills/skill-install-request-service.test.ts src/main/skills/skill-bundle-install-request-service.ts src/main/skills/skill-ssh-package-transfer.ts src/main/skills/skill-ssh-relay-client.ts src/main/skills/skill-ssh-relay-destination.ts src/main/skills/skill-ssh-relay-service.ts src/main/skills/skill-ssh-relay-service.test.ts src/main/skills/skill-bundle-ssh-relay-service.ts src/main/skills/skill-bundle-ssh-relay-service.test.ts src/main/skills/skill-transfer-rpc-retry.ts src/main/skills/skill-remote-error-category-parity.test.ts src/main/skills/skill-windows-workspace.integration.test.ts src/main/skills/skill-upload-*.ts src/shared/skill-upload-session-contract.ts src/shared/skill-ssh-relay-contract.ts src/relay/skill-install-handler.ts src/relay/skill-install-handler.test.ts src/relay/skill-upload-multi-relay.integration.test.ts src/main/runtime/runtime-skill-install-commands.test.ts`. Expected: `ls src/main/skills | grep -E 'upload|ssh-relay|ssh-package|package-download|install-request|transfer-rpc|remote-error|windows-workspace'` prints nothing.
- [ ] **Step 4: Remove the RPC methods and their params.** In `src/main/runtime/rpc/methods/skills.ts` replace lines 11-15 with `import {\n  SkillInstallPreviewRequestSchema,\n  SkillRemoveRequestSchema\n} from '../../../../shared/skill-install-contract'`; delete lines 16-24 (the `skill-bundle-install-contract` and `skill-upload-session-contract` imports), line 29 (`SKILL_INSTALL_RESULT_V2_CAPABILITY`), and replace lines 31-35 with `import { SkillsDiscoverParams } from '../../../../shared/rpc-contract/skills-params'`; delete lines 97-136 (the four `defineMethod` blocks `skills.install`, `skills.installBundle`, `skills.cancelInstall`, `skills.getInstallProgress`); delete lines 152-170 (`skills.beginUpload`, `skills.uploadChunk`, `skills.commitUpload`, `skills.cancelUpload`) and change the `skills.listManagedInstalls` closer on line 151 from `  }),` to `  })` so the array ends `  })\n]`. In `src/shared/rpc-contract/skills-params.ts` delete lines 4-10 (`SkillsGetInstallProgressParams`, `SkillsCancelInstallParams`) and line 1 (`import { z } from 'zod'`, now unused). Then run `pnpm run generate:rpc-params-catalog`. Expected: `rg -n "skills\." src/shared/rpc-contract/rpc-params-catalog.generated.ts` lists exactly `skills.delete`, `skills.discover`, `skills.listManagedInstalls`, `skills.previewDelete`, `skills.previewInstall`, `skills.removeInstall`; `pnpm run verify:rpc-params-catalog` passes.
- [ ] **Step 5: Shrink the runtime skill command classes.** Overwrite `src/main/runtime/runtime-skill-install-commands.ts` with:
```ts
import type { RuntimeSkillCommandHost } from './runtime-skill-command-surface'
import {
  createSkillInstallAuthority,
  folderExecutionHostId,
  resolveSkillProviderRoots
} from './runtime-skill-install-authority'

export class RuntimeSkillInstallCommands {
  constructor(protected readonly host: RuntimeSkillCommandHost) {}

  protected userDataPath(): string {
    return this.host.getUserDataPath()
  }
  protected roots(destination: Parameters<typeof resolveSkillProviderRoots>[1]) {
    return resolveSkillProviderRoots(this.host, destination)
  }
  protected authority() {
    return createSkillInstallAuthority(this.host)
  }
  protected folderExecutionHostId(folder: Parameters<typeof folderExecutionHostId>[0]) {
    return folderExecutionHostId(folder)
  }
}
```
In `runtime-skill-install-authority.ts` delete line 9 (`parseExecutionHostId,`), lines 13-14 (`IPtyProvider` and `SkillSshWorkspaceAuthority` imports), change line 21 to `import type { SkillProviderRootOverrides } from './runtime-skill-types'`, and delete lines 24-92 (`export async function resolveSkillSshTarget(...)` through its closing `}` and blank line). In `runtime-skill-install-queries.ts` delete lines 7-12 (`skill-ssh-relay-service` and `skill-bundle-ssh-relay-service` imports), 19-20 (`execution-host` and `worktree/id` imports), the `SkillInstallRequest,` entry on line 24 and lines 27-28 (`SkillUploadBeginRequest`, `SkillUploadChunkRequest`), line 31 (`normalizeSshRelaySkillDestination`), lines 35-45, 55-65, 75-85 (each `const target = await this.sshTarget(...)` / `if (target) { return ...OnSshHost(...) }` block), change line 94 to `  async listManagedSkillInstalls(): Promise<ManagedSkillInstall[]> {` and delete lines 95-135 (the `if (connectionId) { ... }` branch), delete lines 187-189 (`skillInstallDestinationUsesSsh`) and lines 205-216 (the four upload methods). Expected: `pnpm tc` reports only the contract mismatches fixed in Step 6.
- [ ] **Step 6: Trim the surface contract, host wiring and quit path.** In `runtime-skill-command-contract.ts` replace lines 2-8 with `import type {\n  SkillBundleInstallPreview,\n  SkillBundleInstallPreviewRequest\n} from '../../shared/skill-bundle-install-contract'`; delete lines 9-14 (`skill-upload-session-contract` types, `IPtyProvider`, `SkillUploadSessionService`); delete lines 26-36 (`installSharedSkillRequest`, `installSharedSkillBundleRequest`, `getSharedSkillInstallProgress`, `cancelSharedSkillInstall`); change line 44 to `  listManagedSkillInstalls(): Promise<ManagedSkillInstall[]>`; delete line 45 (`skillInstallDestinationUsesSsh`), lines 50-56 (`beginSkillUpload` … `disposeSkillUploadSessions`), and line 98 (`getSshProvider(connectionId: string): IPtyProvider | undefined`). In `runtime-skill-types.ts` delete lines 16-19 (the `skill-upload-session-contract` re-export). In `orca-runtime-state-fields.ts` delete line 178 (`getSshProvider: (connectionId) => this.getSshProviderFn?.(connectionId),`). In `src/main/startup/main-process-quit.ts` delete line 211 (`const skillUploadShutdown = ...`) and line 246 (`{ name: 'skill-uploads', promise: skillUploadShutdown },`). In `src/main/ipc/skill-install-management-ipc-handlers.ts` delete lines 201-204 (`if (environmentId.startsWith('ssh:')) { ... }`) — an `ssh:` id now reaches `supportsSkillRuntimeManagement`, which returns false, so the handler answers `unsupported` and never lists locally (fail closed; B5 reworks the remote-runtime remainder). In `runtime-skill-install-authority.test.ts` delete line 17 (`getSshProvider: ...`). Expected: Steps 1 and 2 tests GREEN; `pnpm tc` green.
- [ ] **Step 7: Cut the relay-side references.** `src/shared/relay-work-drain-contract.ts`: delete line 1 (`import { SKILL_SSH_RELAY_CANCEL_UPLOAD_METHOD } ...`) and line 12 (`  SKILL_SSH_RELAY_CANCEL_UPLOAD_METHOD`), and drop the trailing comma on line 11 so the set ends `'pty.cancelDelivery'\n])`. `src/relay/relay-work-admission.test.ts`: delete line 4 and line 62 (`SKILL_SSH_RELAY_CANCEL_UPLOAD_METHOD`), dropping the trailing comma on line 61 if it is now the last array element. Only while `src/relay/relay-daemon.ts` still exists (B6 deletes it): delete `relay-daemon.ts:16` (`import { SKILL_RELAY_CAPABILITIES } from './skill-install-handler'`) and `:153` (`    capabilities: SKILL_RELAY_CAPABILITIES,` — `relay.status` has no typed consumer in `src/main/ssh` or `src/shared`, verified by `rg`), and in `relay-runtime-services.ts` delete line 24 (import), line 34 (`readonly skillInstallHandler: SkillInstallHandler`), line 79 (`this.skillInstallHandler = new SkillInstallHandler(dispatcher)`), line 105 (`      this.skillInstallHandler,`) and lines 134-138 (`await this.skillInstallHandler.dispose().catch(...)` block). Expected: `pnpm tc` green (the relay tsconfig is part of `pnpm tc`); `pnpm test src/relay/relay-work-admission.test.ts` green.
- [ ] **Step 8: Trim the remaining tests and lane/CI lists.** `src/main/skills/skill-operation-observability.test.ts`: delete line 20 (`import { downloadSkillPackageGrant } from './skill-package-download'`), lines 265-283 (`const fetcher: typeof fetch = ...` through `await downloaded.cleanup()`) and line 297 (`expect(serialized).toContain('skill.download')`). `src/main/runtime/rpc/methods/skills.test.ts`: delete lines 51-58 (`function installMethod() {...}` and blank) and lines 130-251 (`describe('skills.install RPC', ...)` through its `})` and blank). `src/main/runtime/runtime-skill-install-queries.test.ts`: delete lines 3-4 (`toSshExecutionHostId`, `SkillSshRelayService` imports), lines 7-12 (`mocks` hoist and `vi.mock('../skills/skill-ssh-relay-service', ...)`), lines 17-19 (the `beforeEach` resetting that mock) and lines 21-106 (the three SSH inventory tests). `config/scripts/win32-test-lane-registration.test.mjs`: delete lines 116-117 (`// Same flag; installs into a real Windows workspace.` and `'src/main/skills/skill-windows-workspace.integration.test.ts',`). `package.json` line 35: remove the token ` src/relay/skill-install-handler.test.ts` from `test:skill-sharing:release`. `config/scripts/skill-sharing-release-workflow.test.mjs`: delete line 65 (`expect(command).toContain('src/relay/skill-install-handler.test.ts')`). Expected: `pnpm test src/main/skills/skill-operation-observability.test.ts src/main/runtime/rpc/methods/skills.test.ts src/main/runtime/runtime-skill-install-queries.test.ts config/scripts/win32-test-lane-registration.test.mjs config/scripts/skill-sharing-release-workflow.test.mjs` green.
- [ ] **Step 9: Remove the orphaned reliability gate and B0's allowlist rows.** In `config/reliability-gates.jsonc` delete the whole gate object whose `"id"` is `"skill-upload.cross-process-staging-ownership"` (lines 18029 `{` through 18166 `},` on the verified base; every one of its four `testFiles` is deleted in Step 3, and `check-reliability-gates.mjs:341` fails on a missing test file). In `config/local-only-allowlist.txt` delete the Spec B rows (and their justification comment) B0 added for `src/main/runtime/runtime-skill-install-commands.ts`, `src/main/skills/skill-ssh-package-transfer.ts` and `src/relay/skill-install-handler.ts`; run `rg -n "storage\.googleapis\.com" src --glob '!*.test.*'` — expected: nothing. Prune shard timings with the B3.1 Step 12 one-liner. Expected: `pnpm run check:reliability-gates` passes; `pnpm run check:local-only` passes with no `storage.googleapis.com` allowlist row.
- [ ] **Step 10: Verify.** `pnpm tc`; `pnpm test src/main/skills src/main/runtime/rpc/methods/skills.test.ts src/main/runtime/runtime-skill-install-queries.test.ts src/main/runtime/runtime-skill-install-authority.test.ts src/main/ipc/skill-install-management-ipc-handlers.test.ts src/relay/relay-work-admission.test.ts src/shared/skill-install-contract.test.ts src/shared/skill-bundle-install-contract.test.ts config/scripts/win32-test-lane-registration.test.mjs config/scripts/skill-sharing-release-workflow.test.mjs`; `pnpm run verify:rpc-params-catalog`; `pnpm run check:reliability-gates`; `pnpm run check:code-quality:changed`; `pnpm run check:local-only`. Expected: all green; `rg -n "skills\.(install|installBundle|cancelInstall|getInstallProgress|beginUpload|uploadChunk|commitUpload|cancelUpload)'" src --glob '!*.test.*'` prints nothing.
- [ ] **Step 11: Commit.** `git add -A && git commit -m "refactor(local-only): remove the skill-transfer RPC family and transfer rails" -m "Deletes skills.install/installBundle/cancelInstall/getInstallProgress and the staged-upload RPC methods, the download-grant fetcher, the SSH relay transfer services, the upload session service and the relay skill-install handler. Local and WSL skill preview, removal, discovery and delete are unchanged; an SSH destination now fails closed with skill-install-ssh-dispatch-required." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -m "Claude-Session: https://claude.ai/code/session_01PskLbdTqJNXxJ7KRnDoDoD"`.

### Task B3.2: Remove the orcad deploy side, the pinned-runtime download rail and the Node runtime pin (joint B3/B4.3; lands in the same commit as B6's SSH-core deletion)
**Precondition (hard):** this task cannot be a standalone typecheck-green commit on either side of B6. `src/main/ssh/orcad-*.ts` import `ssh-connection`, `ssh-connection-utils`, `ssh-relay-deploy-helpers`, `ssh-relay-install-transfers`, `ssh-relay-versioned-install`, `remote-install-model`, `ssh-remote-platform` (SSH core, deleted by B6), while B6's `ssh-relay-pinned-node*.ts`, `ssh-relay-opencode-*.ts`, `ssh-relay-host-node-addons.ts`, `ssh-relay-runtime-{ladder,resolution,step-plan,self-test}.ts`, `remote-node-runtime-store-*.ts`, `remote-install-model.ts`, `relay-version-dir-liveness.ts`, `ssh-remote-runtime-telemetry.ts`, `ssh-hostile-host-*.ts`, `ssh-windows-host-cells.ts` and `src/relay/{relay-runtime-self-test,pty-handler,node-pty-binding-survey,node-pty-unavailable-diagnosis}.ts` import these files; `node-pty-precondition.ts:28` imports B6's `build-toolchain-diagnosis`. B6's executor applies this task inside its SSH deletion commit (or as the immediately following commit if B6 is itself split into multiple non-green steps, with `pnpm tc` run at the end of both).
**Files:**
Delete: `src/main/ssh/orcad-*.ts` (all 38: `orcad-activation-gate(.test)`, `orcad-activation-record(.test)`, `orcad-activation-record-store`, `orcad-artifact-materializer(.test)`, `orcad-cache-path`, `orcad-deployment-target(.test)`, `orcad-local-build-hash`, `orcad-remote-deploy(.test)`, `orcad-remote-deploy-stop`, `orcad-remote-gc(.test)`, `orcad-remote-host-support`, `orcad-remote-install`, `orcad-remote-install-termination.test`, `orcad-remote-launch(.test)`, `orcad-remote-node-runtime(.test)`, `orcad-remote-node-runtime-promotion-lock.test`, `orcad-remote-node-runtime-report`, `orcad-remote-node-runtime-windows(.test)`, `orcad-remote-preflight`, `orcad-remote-process-control`, `orcad-remote-rollback(.test)`, `orcad-remote-runtime(.test)`, `orcad-remote-shell-commands.integration.test`, `orcad-state-snapshot(.test)`, `orcad-update-plan(.test)`); `src/main/ssh/pinned-runtime-materializer.ts`, `pinned-runtime-materializer.test.ts`, `pinned-runtime-materializer-node.test.ts`, `runtime-archive-download.ts`; `src/shared/orcad-artifacts.ts`, `orcad-artifacts.test.ts`, `orcad-profile-preflight.ts`, `orcad-profile-preflight.test.ts`, `orcad-node-runtime-identity.ts`, `node-runtime-pin.ts`, `zip-extractor-command.ts`; the orcad quartet `src/main/orcad/{native-host-abi,native-host-abi.test,node-pty-loader-diagnosis,node-pty-precondition,node-pty-precondition.test,node-pty-prebuilt-slot,node-pty-prebuilt-slot.test}.ts` (then `rmdir src/main/orcad`); `src/main/network/http-client.ts`, `src/main/host/electron-http-client.ts` (no user remains after the download rail is gone — verified: only `main-process-preflight.ts` and two tests); `config/scripts/check-node-runtime-pin.mjs`, `check-node-runtime-pin.test.mjs`, `update-node-runtime-pin.mjs`, `update-node-runtime-pin.test.mjs`, `node-dist-archive-name.mjs`, `pinned-node-downloads.mjs`, `server-build-target.mjs`.
Modify: `src/main/startup/main-process-preflight.ts:58-59,276-282`; `src/main/startup/host-port-bootstrap-wiring.test.ts:33`; `src/main/startup/browser-process-user-agent-ordering.test.ts:135-136`; `src/main/global-fetch-call-site-audit.test.ts:18-22`; `package.json:17,45`; `.github/workflows/pr.yml:248-249`; `config/scripts/check-runtime-launcher-protocol-ratchet.mjs:15-18,24-25`; `config/scripts/check-runtime-launcher-protocol-ratchet.test.mjs:18`; `config/electron-builder.config.cjs:186-188`; `config/local-only-allowlist.txt` (B0's `nodejs.org` row for `src/shared/node-runtime-pin.ts`); `config/scripts/ci-shard-timings.json` (prune).
Test: `src/main/startup/host-port-bootstrap-wiring.test.ts`, `src/main/startup/browser-process-user-agent-ordering.test.ts`, `src/main/global-fetch-call-site-audit.test.ts`, `config/scripts/check-runtime-launcher-protocol-ratchet.test.mjs`, `src/main/agent-hooks` WSL relay tests (survivor regression: `pnpm test src/main/agent-hooks/wsl-hook-relay`), `src/relay/wsl-*.test.ts`.
**Interfaces:** Consumes: B6's deletion of SSH core, `ssh-relay-*`, `remote-*`, `src/relay` SSH files and `build-toolchain-diagnosis.ts`; B4.2 (the WSL OpenCode importer is already gone); B3.1 (build scripts gone). Produces: no `nodejs.org`/`unofficial-builds.nodejs.org` string in `src/`; no generic outbound-HTTP port (`MainHttpClient`); `check:node-runtime-pin` gone from `pnpm lint`; the 8 WSL survivors in `src/main/ssh` (`relay-protocol`, `ssh-channel-multiplexer`, `ssh-multiplexer-transport-writer`, `ssh-multiplexer-writer-lane-scheduler`, `ssh-connection-generation`, `ssh-target-identity`, `ssh-target-id-migration`, `removed-ssh-target-tombstone-retention`) untouched (none imports an orcad or pinned-runtime file — verified by `rg`).
- [ ] **Step 1: Delete the files.** `git rm src/main/ssh/orcad-*.ts src/main/ssh/pinned-runtime-materializer*.ts src/main/ssh/runtime-archive-download.ts src/shared/orcad-artifacts.ts src/shared/orcad-artifacts.test.ts src/shared/orcad-profile-preflight.ts src/shared/orcad-profile-preflight.test.ts src/shared/orcad-node-runtime-identity.ts src/shared/node-runtime-pin.ts src/shared/zip-extractor-command.ts src/main/orcad/native-host-abi.ts src/main/orcad/native-host-abi.test.ts src/main/orcad/node-pty-loader-diagnosis.ts src/main/orcad/node-pty-precondition.ts src/main/orcad/node-pty-precondition.test.ts src/main/orcad/node-pty-prebuilt-slot.ts src/main/orcad/node-pty-prebuilt-slot.test.ts src/main/network/http-client.ts src/main/host/electron-http-client.ts config/scripts/check-node-runtime-pin.mjs config/scripts/check-node-runtime-pin.test.mjs config/scripts/update-node-runtime-pin.mjs config/scripts/update-node-runtime-pin.test.mjs config/scripts/node-dist-archive-name.mjs config/scripts/pinned-node-downloads.mjs config/scripts/server-build-target.mjs`. Expected: `test -d src/main/orcad && echo STILL-THERE` prints nothing (git removes the empty dir); `rg -ln "orcad-|node-runtime-pin|pinned-runtime-materializer|runtime-archive-download|zip-extractor-command|network/http-client|electron-http-client" src config tests --glob '!config/scripts/ci-shard-timings.json'` lists only the files edited in Steps 2-4.
- [ ] **Step 2: Unwire the HTTP port from preflight.** In `src/main/startup/main-process-preflight.ts` delete lines 58-59 (`import { electronHttpClient } from '../host/electron-http-client'`, `import { setMainHttpClient } from '../network/http-client'`), the three `// Why here: integrations use Chromium's network stack ...` comment lines (279-281) and line 282 (`setMainHttpClient(electronHttpClient)`). In `host-port-bootstrap-wiring.test.ts` delete line 33 (`'setMainHttpClient(electronHttpClient)',`). In `browser-process-user-agent-ordering.test.ts` delete lines 135-136 (`vi.mock('../host/electron-http-client')`, `vi.mock('../network/http-client')`). In `src/main/global-fetch-call-site-audit.test.ts` delete lines 18-22 (the four `// Main HTTP port:` comment lines and `['main/network/http-client.ts', 2],`). Expected: `pnpm test src/main/startup/host-port-bootstrap-wiring.test.ts src/main/startup/browser-process-user-agent-ordering.test.ts src/main/global-fetch-call-site-audit.test.ts` green.
- [ ] **Step 3: Drop the node-runtime-pin gate from lint and CI.** `package.json`: on line 17 remove ` && pnpm run check:node-runtime-pin` from the `lint` script and delete line 45 (`"check:node-runtime-pin": ...`). `.github/workflows/pr.yml`: delete lines 248-249 (`- name: Check Node runtime pin` / `run: pnpm run check:node-runtime-pin`). `config/scripts/check-runtime-launcher-protocol-ratchet.mjs`: delete lines 15-18 (`'src/shared/node-runtime-pin.ts'`, `'src/main/ssh/pinned-runtime-materializer.ts'`, `'src/main/ssh/runtime-archive-download.ts'`, `'src/main/ssh/orcad-remote-node-runtime.ts'`) and lines 24-25 (`// Remote slot runtime selection.`, `'src/main/ssh/orcad-remote-runtime.ts'`), leaving the five `src/main/daemon/*` paths; in its test change line 18 to `const LAUNCHER = 'src/main/daemon/daemon-launched-child.ts'`. `config/electron-builder.config.cjs`: delete lines 186-188 (`// Why: the pinned Node a local orcad build references ...`, `'!out/runtimes{,/**/*}'`, `'!out/node-runtime-cache{,/**/*}'`). Expected: `pnpm test config/scripts/check-runtime-launcher-protocol-ratchet.test.mjs config/scripts/electron-builder-config.test.mjs` green; `rg -n "node-runtime-pin" package.json .github config` prints nothing.
- [ ] **Step 4: Remove B0's `nodejs.org` allowlist row and prune timings.** In `config/local-only-allowlist.txt` delete the Spec B row (and comment) for `src/shared/node-runtime-pin.ts`; run `rg -n "nodejs\.org|googleapis\.com" src --glob '!*.test.*'` — expected: only the renderer `npx` guidance string in `src/renderer/src/components/settings/CliSkillRuntimeSetup.tsx:236` (a pasteable install hint, not a request; if B0's guard matches it, keep its existing allowlist row). Prune `config/scripts/ci-shard-timings.json` with the B3.1 Step 12 one-liner.
- [ ] **Step 5: Verify (with B6's deletions in the tree).** `pnpm tc`; `pnpm test src/main/startup/host-port-bootstrap-wiring.test.ts src/main/startup/browser-process-user-agent-ordering.test.ts src/main/global-fetch-call-site-audit.test.ts src/main/agent-hooks/wsl-hook-relay src/relay/wsl-agent-hook-relay.test.ts src/relay/wsl-browser-network-relay.test.ts config/scripts/check-runtime-launcher-protocol-ratchet.test.mjs config/scripts/electron-builder-config.test.mjs`; `pnpm run check:runtime-electron-ratchet`; `pnpm run check:reliability-gates`; `pnpm run check:code-quality:changed`; `pnpm run check:local-only`; `pnpm build:relay` (the WSL bundles must still build). Expected: all green; `ls src/main/ssh | grep -E 'orcad|pinned|runtime-archive'` prints nothing.
- [ ] **Step 6: Commit (joint with B6).** Append to B6's commit, or commit immediately after it with `git add -A && git commit -m "refactor(local-only): remove orcad deploy, pinned Node downloads and the node runtime pin" -m "Deletes the src/main/ssh orcad-* deploy side, the nodejs.org pinned-runtime materializer and archive download, src/shared/node-runtime-pin.ts, the node-pty precondition files the SSH relay used, the MainHttpClient port and the check:node-runtime-pin lint gate. Lands with the SSH-core deletion because both sides import each other." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -m "Claude-Session: https://claude.ai/code/session_01PskLbdTqJNXxJ7KRnDoDoD"`.

### B4.3 (pinned runtime downloads) — folded into Task B3.2
`runtime-archive-download.ts`, `pinned-runtime-materializer.ts`, `node-runtime-pin.ts`, `zip-extractor-command.ts`, the HTTP port pair and `check:node-runtime-pin` are deleted in Task B3.2 Steps 1-4; they cannot be deleted separately because `pinned-runtime-materializer.ts:8-9` imports `orcad-cache-path`/`orcad-artifacts` and `orcad-artifact-materializer.ts`/`orcad-remote-deploy.ts` import `pinned-runtime-materializer`.
---

## Planner group: b5

## Unit B5 — Remote runtime environments

Every line number below was read at commit `57f87b013d` (branch `local-only/spec-b`). Earlier units (B1–B4) shift later numbers inside shared files; before deleting, re-anchor on the quoted identifier with `rg -n` and delete bottom-up within a file.

The full task text (six tasks, B5.1–B5.6, with exact paths, line ranges, RED tests, code and commit messages) is written verbatim in `/private/tmp/claude-501/-Users-abhijitbansal-projects-orca-local/fda30a90-8c36-4b0a-a576-28a998d2a0b9/scratchpad/b5-tasks.md` (92 KB, md5 cbbc70481db1cf71eda763a63033eabe). The sections below are that file, reproduced.

### B5 conventions (apply to every B5 task)

- **Cut-line.** B5 removes every path that can *reach* a paired remote runtime: the CLI dial, the renderer Servers UI and server-update flow, the main-process environment IPC/transport/upload rails, the paired-runtime browser client host, the federation transport, the shared WebSocket/E2EE client stack, the pairing codec and the on-disk environment store. The long tail that merely *consumes* an environment id (renderer web-session mirror `web-runtime-*`/`web-session-*`, the remote PTY transport `remote-runtime-pty-transport*`, the client-hosted browser panes `stream-remote/`, `client-hosted-*`, and the runtime-side browser host leases/screencast `src/main/runtime/browser-host-*`, `runtime-browser-client-*`, `runtime-browser-screencast-*`) stays in place **inert**: each is keyed on a `runtime:` host id or `activeRuntimeEnvironmentId`, which after B5.5 can never be non-null (verified: `isWebRuntimeSessionActive` at `src/renderer/src/runtime/web-runtime-session-environment.ts:5-10`, the PTY transport switch at `pty-connection/pty-input-recovery.ts:158`, `useWebSessionTabsSync` at `web-session-tabs-sync/use-web-session-tabs-sync.ts:44-77`). Narrowing that tail is a documented follow-up, not B5.
- **Stub seam.** `src/preload/api/runtime-environments-bridge.ts` becomes a fail-closed stub (B5.5 step 6) so ~50 kept renderer call sites of `window.api.runtimeEnvironments.*` keep compiling: `list`/`getStatusSnapshots` resolve `[]`, `onStatusChanged` returns a no-op unsubscribe, every other method throws `unsupported_in_local_build`. Same pattern as B6's provider-getter stubs.
- **Fail-closed error.** Main-process orchestration uses the existing `OrchestrationError('server_required', …)` (`src/main/runtime/rpc/errors.ts:119` already lists the code). The CLI uses `RuntimeClientError('invalid_argument', …)`. Never fall back to local.
- **KEEP list (do not delete in B5; owned elsewhere or consumed locally):** `src/shared/browser-network-tunnel-*.ts` and `src/main/runtime/rpc/methods/browser-network-tunnel.ts` (WSL relay `src/relay/wsl-browser-network-relay.ts` imports `browser-network-tunnel-stream-framing.ts`; B6 owns the rest); `src/shared/browser-client-host-protocol.ts`, `browser-client-host-placement.ts`, `client-hosted-browser-rows.ts`, `client-hosted-browser-page-record.ts`, `client-hosted-browser-close-intent.ts` (persisted `workspace-session-schema.ts`, local browser commands, `ipc/runtime.ts`); `src/shared/remote-runtime-memory-limits.ts`, `remote-rpc-content-budget.ts`, `remote-runtime-client-error.ts`, `remote-runtime-client-error-classification.ts`, `remote-runtime-pty-id.ts`, `remote-execution-host-pty-id.ts` (local consumers: `agent-session-history-page-bounds.ts`, `git-diff-methods.ts`, `terminal-parked-watcher-registry.ts`, `terminal-execution-host.ts`); `src/shared/runtime-host-status.ts`, `runtime-environments.ts` (types + `redactRuntimeEnvironment`/`isUserManagedRuntimeEnvironment`; pairing helpers deleted in B5.6), `mobile-pairing-custom-address.ts` + `network/manual-address.ts` + `network/pairing-url.ts` + `mobile-pairing-protocol-limits.ts` (B7 hydration strip owns them); renderer `runtime-environment-revision.ts` (66 importers), `runtime-protocol-compat.ts`, `runtime-environment-ssh*.ts`, `runtime-host-connection-state.ts` (B6 SSH); `src/main/browser/browser-host-lease-reconnect-delay.ts` (imported by S6 `browser-network-route-reconnect-retry.ts`, B6); `src/main/browser/browser-client-host-id.ts`, `browser-client-page-renderer-runtime.ts`, `browser-client-page-automation-runtime.ts`, `browser-client-page-command-failure.ts`, `browser-client-download-routing.ts`, `browser-client-download-relay.ts`, `browser-client-route-cookie-import.ts`, `browser-client-network-route-registry.ts` and the `browser-client-page-*`/`browser-client-upload-*` command executors they pull in (local browser-manager plumbing, inert without a lease); `src/main/runtime/orchestration/db/federation/**`, `orchestration/federation-*.ts`, `runtime-orchestration-federation.ts`, `orchestration/environment-transport.ts` (DB hydration tolerance; mixin fails closed with `server_required`); `src/shared/cli-runtime-pairing-boundary.test.ts` + `__fixtures__/cli-runtime-pairing-allowlist.txt` (name match only: it ratchets CLI↔node *runtime* pairing, unrelated); `src/shared/native-chat-tool-pairing.ts` (unrelated name match).
- **Ordering inside B5:** B5.1 → B5.2 → B5.3 → B5.4 → B5.5 → B5.6. Consumers go before providers so every commit is `pnpm tc`-green.
- **Per task:** `pnpm tc`, the listed `pnpm test` paths, `pnpm run check:code-quality:changed`, `pnpm run check:local-only` (violation count never rises), and for renderer string removals `pnpm run verify:localization-catalogs && pnpm run verify:localization-extraction && pnpm run verify:localization-coverage`. After every delete batch run the importer sweep `rg -n "from '[^']*/(<basename-without-ext>)'" src tests config --glob '!tests/e2e/.cross-version-checkouts/**'` for each deleted basename and `rg -ln "vi\.mock\('[^']*<basename>'" src tests` to catch mock blocks; both must print nothing before `pnpm tc`.
- **Commit trailer (verbatim, both lines):**
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01PskLbdTqJNXxJ7KRnDoDoD
  ```
  Commits are authorized. Pushing is not authorized for implementer agents.

---

### Task B5.1: CLI remote dial, `orca environment`, `--environment`/`--pairing-code`, `--host runtime:`

**Files:**
- Delete: `src/cli/runtime/websocket-transport.ts`, `src/cli/runtime/websocket-transport.test.ts`, `src/cli/runtime/websocket-transport-error.test.ts`, `src/cli/runtime/runtime-remote-pairing.ts`, `src/cli/runtime/remote-runtime-compat-gate.ts`, `src/cli/runtime/environments.ts`, `src/cli/runtime/environments.test.ts`, `src/cli/index-environment-commands.test.ts`, `src/cli/remote-selection-flag-rejection.ts`, `config/scripts/cli-runtime-client-deferral-equivalence.mjs`, `config/scripts/cli-runtime-client-deferral-benchmark.mjs`.
- Modify: `src/cli/runtime/client.ts:11,23-24,29,45,50-51,54,66-67,73,76-77,80-82,139-163,207-243,261-263,275-277`; `src/cli/index.ts:13-16,30-44,47,118-181`; `src/cli/execution-host-flag.ts:8-15,18-26,38-45,48-110,123,138-147,150-207`; `src/cli/host-selector-alternatives.ts:10,12-15,48-76,78-100,160,186,193`; `src/cli/omitted-host-scope-selectors.ts:7-12,52-54,65-74,87-90`; `src/cli/handlers/environment.ts` (keep `host name` + `host list`); `src/cli/specs/environment.ts:22-23,26,28,32-60`; `src/cli/handler-group-manifest.ts:195-198`; `src/shared/cli-argument-boundary.ts:1-2`; `src/cli/root-help-text-primary.ts:33-36`; `src/cli/root-help-text-secondary.ts:48-51,107-108`; `src/cli/format.ts:79,95,129-130`; `src/cli/workspace-format.ts:1,108-130`; `src/cli/runtime/status.ts:62-64`; `src/cli/index-test-harness.ts:10-17,27,32-51,86-100`; `src/cli/handlers/{agent-hooks.ts:4,221-226, account.ts:10,283-288, profile-state.ts:3,63-68}` (and their call sites); `src/cli/handlers/{terminal.ts:151-156,159, file.ts:42-47, automations.ts:89-91, search.ts:29, repo.ts:15, emulator.ts:245, project.ts:117,141,167,191, skill-sharing.ts:12}`; `src/cli/selectors.ts:59,92-99,191-193,299-301`; `src/cli/specs/search.ts:29-30,47`; `src/cli/specs/account.ts:28`; `src/cli/runtime/orchestration-recovery-command.ts:82`; `src/main/startup/serve-mode-argv.ts:29-30`; `src/main/startup/cli-command-names.ts:24`; `src/main/runtime/claude-agent-teams-service.ts:59-61`; `src/cli/serve-electron-flag-parity.test.ts:12-13`; `skill-guides/orca-cli.md:196,206`; `docs/site/content/docs/cli/reference.mdx` (any `orca environment` / `--environment` / `--pairing-code` rows); `tests/e2e/helpers/completed-worker-retirement-fixture.ts:166-167`; `.github/workflows/computer-e2e.yml:125`; `config/scripts/ci-shard-timings.json` (keys for the deleted test files).
- Test: `src/cli/execution-host-flag.test.ts` (RED test added), `src/cli/index.test.ts`, `src/cli/index-local-command-routing-flags.test.ts`, `src/cli/runtime-client-deferral.test.ts`, `src/cli/index-serve-command.test.ts`, `src/cli/index-omitted-host-scope-selectors.test.ts`, `src/cli/host-selector-alternatives.test.ts`, `src/cli/handlers/{profile-state,search,skill-sharing,terminal,agent-hooks,emulator,account,file,file-absolute-paths,orchestration-gate-cli}.test.ts`, `src/cli/serve-electron-flag-parity.test.ts`, `config/scripts/generate-bundled-skill-guides.test.mjs`.

**Interfaces:**
- Consumes: `src/shared/execution-host.ts` `parseExecutionHostId` (unchanged; `runtime` member stays inert), `RuntimeClientError` (`src/cli/runtime/types.ts`).
- Produces: `RuntimeClient(userDataPath?, requestTimeoutMs?, cliExecutable?, originalArgs?)` — four parameters, no `isRemote` getter, local unix-socket/named-pipe only; `parseHostFlag` throws `invalid_argument` on `runtime:` ids; `CLI_GLOBAL_VALUE_FLAGS = []`; `host list` returns local + SSH rows only.

- [ ] **Step 1: RED — `--host runtime:` fails closed.** Append to `src/cli/execution-host-flag.test.ts`:
  ```ts
  describe('parseHostFlag in the local-only build', () => {
    it('rejects --host runtime:<id> with invalid_argument instead of routing to a paired server', () => {
      const flags = new Map<string, string | boolean>([['host', 'runtime:env-1']])
      expect(() => parseHostFlag(flags)).toThrowError(
        expect.objectContaining({ code: 'invalid_argument' })
      )
    })
  })
  ```
  Run `pnpm test src/cli/execution-host-flag.test.ts`. Expected: the new case FAILS (today it returns `{ kind: 'runtime', … }`).
- [ ] **Step 2: Delete the dial and environment files.**
  ```bash
  git rm -q src/cli/runtime/websocket-transport.ts src/cli/runtime/websocket-transport.test.ts \
    src/cli/runtime/websocket-transport-error.test.ts src/cli/runtime/runtime-remote-pairing.ts \
    src/cli/runtime/remote-runtime-compat-gate.ts src/cli/runtime/environments.ts src/cli/runtime/environments.test.ts \
    src/cli/index-environment-commands.test.ts src/cli/remote-selection-flag-rejection.ts \
    config/scripts/cli-runtime-client-deferral-equivalence.mjs config/scripts/cli-runtime-client-deferral-benchmark.mjs
  ```
  Expected: `rg -n "websocket-transport|runtime-remote-pairing|remote-runtime-compat-gate|runtime/environments|remote-selection-flag-rejection|cli-runtime-client-deferral" src config package.json --glob '!*.test.*'` lists only the importers edited in Steps 3–9.
- [ ] **Step 3: `src/cli/runtime/client.ts`.** Delete the imports at lines 11 (`PairingOffer`), 23 (`markEnvironmentUsed`), 24 (`resolveRemotePairing`), 29 (`RemoteRuntimeCompatGate`) and line 45 (`loadWebSocketTransport`). Delete the fields at 50-51 (`remotePairing`, `environmentSelector`) and 54 (`remoteCompat`). Change the constructor (63-78) to:
  ```ts
  constructor(
    userDataPath = getDefaultUserDataPath(),
    requestTimeoutMs = 60_000,
    cliExecutable = resolveOrchestrationCliExecutable(),
    originalArgs?: readonly string[]
  ) {
    this.userDataPath = userDataPath
    this.requestTimeoutMs = requestTimeoutMs
    this.cliExecutable = cliExecutable
    this.originalArgs = originalArgs ? [...originalArgs] : undefined
  }
  ```
  Delete the `get isRemote()` getter (80-82), the `if (this.remotePairing) { … }` block in `call` (139-163), the `if (this.remotePairing) { … }` block in `getCliStatus` (208-242) so the method body is only `return getCliStatus(this.userDataPath)`, the `if (this.remotePairing) { this.remoteCompat.noteVerifiedStatus(…) }` lines (261-263), and the `if (this.remotePairing) { return initial }` lines in `openOrca` (275-277). Also delete the now-unused `projectRemoteAppStatus` and `RuntimeStatus`/`runtimeHostConnectionState` imports at lines 2-3 and 14 if `pnpm tc` reports them unused.
- [ ] **Step 4: `src/cli/index.ts`.** Delete lines 13-16 (`assertEnvironmentSelectorResolvable`, `resolveHostFlagEnvironmentId` import), 30-44 (`shouldIgnoreRemoteSelection`), the comment lines 46-47 that mention `shared/pairing, ws + tweetnacl`, and lines 119-167 (everything from `const ignoreRemoteSelection` through `const remoteEnvironment = …`). Keep `listSshTargets` (line 17) only if still used after the edit; otherwise delete the import too. Change the client construction (173-180) to `client ??= new RuntimeClientClass(undefined, undefined, resolveOrchestrationCliExecutable(), argv)` and line 200 to `new (await loadRuntimeClientClass())()`.
- [ ] **Step 5: `src/cli/execution-host-flag.ts`.** Delete lines 8-15 (host-selector-alternatives import — re-add `import { resolveSshHostTargetId } from './host-selector-alternatives'` as the only survivor), 18-26 (`HostFlagRoutingSelection`), 48-110 (`resolveHostFlagEnvironmentId`), 150-172 (`assertEnvironmentNameUnambiguous`), 174-207 (`assertEnvironmentSelectorResolvable`). In `parseHostFlag` change line 42 to `` `Invalid --host value: ${raw}. Expected local or ssh:<target-id>.` `` and insert after line 45 (`return parsed` becomes):
  ```ts
  if (parsed.kind === 'runtime') {
    // Why fail closed: a runtime: id names a paired Orca server this build cannot dial; routing
    // it to the local runtime would answer for the wrong machine.
    throw new RuntimeClientError(
      'invalid_argument',
      `--host ${raw} names a paired Orca server; remote Orca runtimes are unsupported in this build. Use --host local or --host ssh:<target-id>.`
    )
  }
  return parsed
  ```
  In `hostFilterMatchesHostId` delete line 123 (`return filter.kind === 'runtime' && candidate === LOCAL_EXECUTION_HOST_ID`) and replace with `return false`; drop `LOCAL_EXECUTION_HOST_ID` from the import if unused. In `resolveHostFlagTarget` delete lines 138-146 (the `listEnvironments` import and `environments` array) and change line 147 to `const targetId = await resolveSshHostTargetId(client, host.targetId)`.
- [ ] **Step 6: `src/cli/host-selector-alternatives.ts` and `omitted-host-scope-selectors.ts`.** In `host-selector-alternatives.ts` delete `EnvironmentSummary` (10), `HostAlternatives` (12-15), `findEnvironmentByName` + `matchesByEnvironmentName` + `ambiguousEnvironments` (48-76), the whole of `crossKindNextSteps` (78-100 — its SSH-side hint only made sense when a paired environment matched the same name; its remaining caller would otherwise emit "X is an SSH target" on an SSH miss), the `...crossKindNextSteps(...)` spread at 186, and the `environments` parameter of `resolveSshHostTargetId` (160, 193 `knownEnvironments`). In `omitted-host-scope-selectors.ts` delete `findEnvironmentByName` from the import (8), lines 52-54 (the `environments` lookup — delete the variable and its use), `listPairedEnvironments` (65-74), the `host?.kind === 'runtime'` branch (87-90), and the `environments` argument at 61/78. A `runtime:` omitted host now resolves to `selector: null` ("not selectable from this machine"), which is the documented fail-closed answer.
- [ ] **Step 7: `handlers/environment.ts`, `specs/environment.ts`, manifest, flags, help.** In `src/cli/handlers/environment.ts` delete the imports at 3-4 (`formatEnvironment`, `formatEnvironmentList`), 13 (`rejectRemoteSelectionFlags`), 14 (`redactRuntimeEnvironment`), 16-23 (`../runtime/environments`); delete the handlers `'environment add'` (48-63), `'environment list'` (105-113), `'environment show'` (114-122), `'environment rm'` (123-132); in `'host list'` delete lines 68-72 (`rejectLocalPairingStoreRetargeting(...)`), 82-90 (the `environments` rows) and line 101 (`...environments`); delete `rejectLocalPairingStoreRetargeting` (151-166). In `src/cli/specs/environment.ts` delete the four `environment *` specs (32-60) and in the `host list` notes delete lines 22-23, 26 and 28 (replace 22 with `'Answers "what can I target and what do I pass" in one place: this machine and the SSH targets registered on it.'`). In `src/cli/handler-group-manifest.ts` delete lines 195-198. In `src/shared/cli-argument-boundary.ts` change line 1 to `export const CLI_GLOBAL_VALUE_FLAGS: readonly string[] = []`. Delete `src/cli/root-help-text-primary.ts:33-36` and `src/cli/root-help-text-secondary.ts:48-51,107-108`. In `src/cli/format.ts` delete `'environment'` from the union at 79, the `environment: 'orca server'` row at 95 and lines 129-130; in `src/cli/workspace-format.ts` delete line 1 and `formatEnvironmentList`/`formatEnvironment` (108-130). In `src/cli/runtime/status.ts` delete lines 62-64 (`remoteUpdateSupport` spread). In `src/main/startup/serve-mode-argv.ts` delete lines 29-30; in `src/main/startup/cli-command-names.ts` delete line 24 (`'environment',`). In `src/main/runtime/claude-agent-teams-service.ts` delete lines 59-61 (`ORCA_ENVIRONMENT` passthrough). In `src/cli/runtime/orchestration-recovery-command.ts:82` delete `'--pairing-code', ` from the array. In `src/cli/serve-electron-flag-parity.test.ts` change line 13 to `const UNTRANSLATED_GLOBAL_FLAGS = new Set(['help'])` and delete comment line 12.
- [ ] **Step 8: `rejectRemoteSelectionFlags` and `isRemote` consumers.** Delete the import and the wrapper function + its call sites in `handlers/agent-hooks.ts` (4, 221-226 and every `rejectRemoteHookSelection(flags)` call), `handlers/account.ts` (10, 283-288 and every `rejectAccountRemoteSelectionFlags(ctx, …)` call), `handlers/profile-state.ts` (3, 63-68 and every `rejectProfileStateRemoteSelection(flags)` call). Then: `terminal.ts` delete 151-156 and change 159 to `const useRendererBackedInteractiveTerminal = shouldUseRendererBackedInteractiveTerminal(command)`; `file.ts` delete 42-47; `automations.ts` delete 89-91; `search.ts:29` → `'runtime'`; `repo.ts:15` → `resolveRepoPathArgument(repoPath, cwd, false, 'Remote repo add')`; `emulator.ts:245` → `false,`; `project.ts:117` → `const pathIsOffClient = getSshTargetIdForExecutionHost(hostId) !== null`, `:141`, `:167`, `:191` → `false`; `skill-sharing.ts:12` → `if (!process.env.ORCA_CLI_CWD) {`; `selectors.ts` delete `client.isRemote ||` at 59, delete `assertLocalCwdWorktreeSelector` (92-99) and every call to it, delete 191-193 and 299-301. Expected after the step: `rg -n 'isRemote' src/cli --glob '!*.test.*'` prints nothing.
- [ ] **Step 9: Test harness and CLI tests.** `src/cli/index-test-harness.ts`: delete `addEnvironmentFromPairingCodeMock`/`listEnvironmentsMock` from `WorktreeAwarenessMocks` (14-15), the `isRemote` field (27), the constructor parameters and body (32-51 → `constructor() { mocks.runtimeClientConstructorMock() }`), and `pairRuntimeEnvironment` (86-100). Then fix every test the harness change breaks: `rg -n 'runtimeClientConstructorMock\)\.toHaveBeenCalledWith|pairRuntimeEnvironment|listEnvironmentsMock|addEnvironmentFromPairingCodeMock|ORCA_ENVIRONMENT|ORCA_PAIRING_CODE|pairing-code|--environment' src/cli --glob '*.test.*'` — delete each `it(...)` that exercises a pairing code, an environment selector, `--host runtime:`, or `host list` paired-server rows (`index-local-command-routing-flags.test.ts` ~20 hits, `runtime-client-deferral.test.ts` 9, `execution-host-flag.test.ts` 9 besides the new RED case, `index.test.ts` 3, `handlers/{profile-state,search,emulator,file,skill-sharing,terminal,account,agent-hooks,orchestration-gate-cli,file-absolute-paths}.test.ts`, `index-serve-command.test.ts`, `index-omitted-host-scope-selectors.test.ts` 2, `host-selector-alternatives.test.ts` 3); rewrite `toHaveBeenCalledWith(null, null)` style assertions to `toHaveBeenCalled()`. In `tests/e2e/helpers/completed-worker-retirement-fixture.ts` delete lines 166-167. In `.github/workflows/computer-e2e.yml` delete line 125 (`src/shared/remote-runtime-client.test.ts` is deleted in B5.6; removing the row now keeps the workflow valid either way).
- [ ] **Step 10: Guides, docs, shard timings.** `skill-guides/orca-cli.md:196`: change to ``` `ORCA search` runs a full-text search over the agent sessions indexed on this Orca host. ``` and delete line 206 (`ORCA search "blank restore" --environment <environmentId> --json`). `docs/site/content/docs/cli/reference.mdx`: delete any `environment add|list|show|rm` rows and `--environment`/`--pairing-code` flag rows (`rg -n 'environment|pairing' docs/site/content/docs/cli/reference.mdx` → only the `orca serve` sentence at line 76 remains). Run `pnpm run generate:bundled-skill-guides` then `pnpm run verify:bundled-skill-guides`. Prune the deleted test keys from `config/scripts/ci-shard-timings.json`: `node -e 'const fs=require("fs");const f="config/scripts/ci-shard-timings.json";const j=JSON.parse(fs.readFileSync(f,"utf8"));for(const s of Object.keys(j)){const t=j[s]?.timings??j[s];if(!t||typeof t!=="object")continue;for(const k of Object.keys(t)){if(!fs.existsSync(k))delete t[k]}}fs.writeFileSync(f,JSON.stringify(j,null,2)+"\n")'` (adapt the inner key path to the file's shape, which `sed -n 1,12p` shows; the script must only remove keys whose file no longer exists).
- [ ] **Step 11: Verify.** `pnpm test src/cli/execution-host-flag.test.ts` → the Step 1 case passes. Then `pnpm tc`; `pnpm test src/cli config/scripts/generate-bundled-skill-guides.test.mjs config/scripts/ci-shard-assignment.test.mjs`; `pnpm run check:code-quality:changed`; `pnpm run check:local-only`; `rg -n 'ORCA_PAIRING_CODE|ORCA_REMOTE_PAIRING|ORCA_ENVIRONMENT\b' src tests config skill-guides docs --glob '!tests/e2e/.cross-version-checkouts/**'` → no hits.
- [ ] **Step 12: Commit.**
  ```
  refactor(local-only): remove the CLI remote dial and orca environment commands

  Delete the WebSocket transport, pairing-code/environment selectors and
  --host runtime: routing from the orca CLI. The RuntimeClient only reaches
  the local unix socket or named pipe; a runtime: host id now fails with
  invalid_argument instead of being routed.

  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01PskLbdTqJNXxJ7KRnDoDoD
  ```

---

### Task B5.2: Renderer Servers settings pane, Add Remote Host server form, status-bar rows, server-update UI and the RPC environment branch

**Files:**
- Delete: `src/renderer/src/components/settings/{RuntimeEnvironmentsPane.tsx,RuntimeEnvironmentsPane.test.ts,RuntimeHostAccessForm.tsx,RuntimeHostAccessForm.test.tsx,runtime-environment-dialogs.tsx,runtime-environment-host-details.ts,runtime-environment-selection.ts,runtime-environments-search.ts,runtime-active-server-section.tsx,runtime-server-row.tsx,runtime-server-row-unverifiable-host.test.tsx,runtime-server-workflow-sections.tsx,runtime-servers-connect-section.tsx,use-runtime-environment-catalog.ts,use-runtime-environment-connection-actions.ts,use-runtime-environment-mutation-actions.ts,SessionHistoryServerRow.tsx,SessionHistoryComputerRow.test.tsx,machine-name-search.ts,RemoteServerUpdateStatus.tsx,RemoteServerUpdateDialog.tsx,RemoteServerUpdateDialog.test.tsx,BrowserClientHostedRemoteSetting.tsx,BrowserClientHostedRemoteSetting.test.tsx,browser-client-hosted-remote-copy.ts}`; `src/renderer/src/components/sidebar/AddRemoteHostServerFormPanel.tsx`; `src/renderer/src/components/status-bar/{RuntimeHostStatusRow.tsx,RuntimeHostStatusRow.test.tsx,remote-host-connection-status.ts,remote-host-connection-status.test.ts,runtime-environment-explicit-connect.ts}`; `src/renderer/src/lib/remote-pairing-copy.ts`; `src/renderer/src/runtime/{remote-server-install-failure-probe.ts,remote-server-install-failure-probe.test.ts,remote-server-parity.test.ts,remote-server-restart-wait.ts,remote-server-restart-wait.test.ts,remote-server-update-batch.ts,remote-server-update-coordinator.ts,remote-server-update-coordinator.test.ts,remote-server-update-errors.ts,remote-server-updater-polling.ts,runtime-rpc-environment-call.ts,runtime-status-probe-diagnostics.ts,use-remote-runtime-recovery-triggers.ts,use-remote-runtime-recovery-triggers.test.ts}`; `src/renderer/src/store/slices/{remote-server-updates.ts,remote-server-updates.integration.test.ts}`; `src/shared/host-display-resolution.ts`, `host-display-resolution.test.ts`, `host-platform-label.ts` (only consumer was `runtime-server-row.tsx`); `tests/tools/omp-remote-sidebar-rendered/` (whole directory); `tests/e2e/remote-agent-completion-authority.unit.test.ts` (imports `clearRuntimeCompatibilityCacheForTests`, which goes with the compatibility cache).
- Modify: `src/renderer/src/components/settings/settings-remote-security-section-renderers.tsx:3,9-40`; `settings-page-renderer.tsx:38,130`; `src/renderer/src/hooks/settings-navigation-remote-sections.ts:48-61` (+ the `Server` icon import and `runtimeEnvironmentsSearchEntry` parameter); `src/renderer/src/hooks/useSettingsNavigationMetadata.ts:7-10,61-63`; `src/renderer/src/lib/settings-navigation-types.ts:43` (`'servers'`); `src/renderer/src/components/settings/SessionHistorySettingsPane.tsx:20,35,53,224-…`; `src/renderer/src/components/sidebar/AddRemoteHostDialog.tsx:8,10-12,15,23,56-57,63-67,95-96,240-300,354-368` (+ the `'server'` mode); `AddRemoteHostFields.tsx:9-11,142-270` (`RemoteServerFields` and its imports); `AddRepoHostSelectorSlot.tsx:23`; `src/renderer/src/components/status-bar/SshStatusSegment.tsx:19-20,27,29-33,43-60,75,100-115,129-160,263-290,300-310`; `src/renderer/src/app-shell/AppRootSurfaces.tsx:54-56,333`; `src/renderer/src/app-shell/use-app-shell-services.ts:20,43`; `src/renderer/src/store/types.ts:41,82`; `src/renderer/src/store/index.ts:43,112`; `src/renderer/src/store/slices/store-test-helpers.ts` (remote-server-updates rows); `src/renderer/src/runtime/runtime-rpc-client.ts:5-9,23-37,60-76,83-95,98-…` (environment branch and compatibility cache); `src/renderer/src/runtime/runtime-client-target.ts:6-11,14-25`; `src/renderer/src/store/slices/runtime-status-refresh.ts` (import of `runtime-status-probe-diagnostics`); `src/renderer/src/components/settings/ProviderHostScopeControl.tsx:23`, `src/renderer/src/components/automations/automation-host-recovery.ts:24-30`, `src/renderer/src/components/sidebar/HostSectionHeaderMenu.tsx:57-63,138`, `src/renderer/src/components/sidebar/HostRemoveDialog.tsx:88-96` (callers of `pane: 'servers'` / the compatibility cache); `src/renderer/src/store/slices/settings.ts:49,159-171,240-282` (`setActiveRuntimeEnvironmentPreference` action), `src/renderer/src/components/settings/use-settings-store-model.ts:36-38,120,133,189-190`, `src/renderer/src/hooks/composer-state/{composer-store-actions.ts:93,target-store-model.ts:56,composer-target-store.ts:74,91,193}`; `src/preload/api/settings-bridge.ts:17-18`, `src/preload/api/settings-api.ts:13-15`; `src/renderer/src/i18n/locales/{en,es,fr,ja,ko,zh}.json` + `en-runtime-required.json` (pruned keys); `config/reliability-gates.jsonc` (verify with `pnpm run check:reliability-gates`); `config/scripts/ci-shard-timings.json`.
- Test: `src/renderer/src/runtime/runtime-rpc-client.test.ts` (RED test added), `src/renderer/src/runtime/runtime-client-target.test.ts` (create if absent), `src/renderer/src/components/settings/SessionHistorySettingsPane.test.tsx`, `src/renderer/src/components/sidebar/AddRemoteHostFields.test.tsx`, `src/renderer/src/components/sidebar/AddRemoteHostDialog.config-picker.test.tsx`, `src/renderer/src/components/status-bar/*.test.tsx`, `src/renderer/src/store/slices/settings.test.ts`, `src/renderer/src/store/slices/runtime-status*.test.ts`, `src/renderer/src/hooks/useSettingsNavigationMetadata*.test.ts*`, `src/renderer/src/i18n`.

**Interfaces:**
- Consumes: `window.api.runtime.call` (local path, unchanged); store fields `runtimeEnvironments: []`, `runtimeStatusByEnvironmentId` (kept, always empty); `GlobalSettings.activeRuntimeEnvironmentId` (kept, read-only, always null).
- Produces: `callRuntimeRpc(target, …)` where `target.kind === 'environment'` throws `RuntimeRpcCallError` with code `unsupported_in_local_build` before any I/O; `getActiveRuntimeTarget()` always returns `{ kind: 'local' }`; `runtimeTargetForExecutionHostId('runtime:…')` returns `null`; no `settings.setActiveRuntimeEnvironmentPreference` store action or preload method; no `'servers'` settings pane.

- [ ] **Step 1: RED — environment targets fail closed in the renderer RPC client.** Add to `src/renderer/src/runtime/runtime-rpc-client.test.ts`:
  ```ts
  it('refuses an environment target without touching the preload bridge', async () => {
    const call = vi.fn()
    vi.stubGlobal('window', { api: { runtime: { call }, runtimeEnvironments: { call: vi.fn() } } })
    await expect(
      callRuntimeRpc({ kind: 'environment', environmentId: 'env-1' }, 'status.get')
    ).rejects.toMatchObject({ code: 'unsupported_in_local_build' })
    expect(call).not.toHaveBeenCalled()
  })
  it('getActiveRuntimeTarget ignores a persisted activeRuntimeEnvironmentId', () => {
    expect(getActiveRuntimeTarget({ activeRuntimeEnvironmentId: 'env-1' })).toEqual({ kind: 'local' })
  })
  ```
  Run `pnpm test src/renderer/src/runtime/runtime-rpc-client.test.ts`. Expected: both FAIL.
- [ ] **Step 2: Delete the leaf files** listed under Delete with `git rm -q` (use the explicit paths; for `tests/tools/omp-remote-sidebar-rendered` use `git rm -r -q`). Expected: `rg -ln 'omp-remote-sidebar-rendered' package.json config tests` → none.
- [ ] **Step 3: RPC client and target.** `runtime-rpc-client.ts`: delete the imports at 5-9 (`assertRuntimeStatusCompatible`, `createRuntimeRpcAbortError`, `callRuntimeEnvironmentWithRevision`, `captureRuntimeEnvironmentRequestRevision`; keep `RuntimeRpcCallError`/`unwrapRuntimeRpcResult`), the cache constants and type at 23-37, lines 60-76 (revision capture + compatibility check), and everything from `export async function ensureRuntimeEnvironmentCompatible` (98) to the end of the compatibility-cache helpers (`clearRuntimeCompatibilityCache`, `clearRuntimeCompatibilityCacheForTests`, `markRuntimeEnvironmentCompatible`, `getCachedRuntimeCompatibilityCheck` and the block at 252 that calls `window.api.runtimeEnvironments.call`). Replace lines 83-95 with:
  ```ts
  if (target.kind !== 'local') {
    // Why fail closed: a runtime: id names a paired Orca server this build cannot dial.
    throw new RuntimeRpcCallError({
      id: 'local-only',
      ok: false,
      error: {
        code: 'unsupported_in_local_build',
        message: 'Remote Orca runtimes are unsupported in this build.'
      }
    })
  }
  const response = await window.api.runtime.call({ method, params: nextParams })
  return unwrapRuntimeRpcResult<TResult>(response as RuntimeRpcResponse<TResult>)
  ```
  (`RuntimeRpcCallError` takes a `RuntimeRpcFailure` envelope — `src/renderer/src/runtime/runtime-rpc-result.ts:10`, shape at `src/shared/runtime-rpc-envelope.ts:63-71`.) Every importer of the deleted helpers (`rg -n 'clearRuntimeCompatibilityCache|markRuntimeEnvironmentCompatible|ensureRuntimeEnvironmentCompatible' src/renderer --glob '!*.test.*'` → `settings.ts`, `HostSectionHeaderMenu.tsx:138`, `NewWorkspaceComposerCard.tsx`, others) loses that call line. `runtime-client-target.ts`: change lines 6-11 to
  ```ts
  export function getActiveRuntimeTarget(
    _settings: Pick<GlobalSettings, 'activeRuntimeEnvironmentId'> | null | undefined
  ): RuntimeClientTarget {
    // Why: the persisted preference is inert in the local-only build; nothing can mint a value.
    return { kind: 'local' }
  }
  ```
  and in `runtimeTargetForExecutionHostId` delete lines 21-23 (the `runtime` branch) so a `runtime:` id returns `null`. Keep the `RuntimeClientTarget` union and `settingsForRuntimeOwner` unchanged.
- [ ] **Step 4: Settings pane, navigation and dialogs.** `settings-remote-security-section-renderers.tsx`: delete line 3 and the whole `renderServersSettingsSection` (9-40). `settings-page-renderer.tsx`: delete line 38 and line 130. `settings-navigation-remote-sections.ts`: delete the `'servers'` section object (48-61), the `Server` lucide import, and the `runtimeEnvironmentsSearchEntry` parameter it consumed; `useSettingsNavigationMetadata.ts`: delete lines 7-10 and 61-63 and the argument that passed `runtimeEnvironmentsSearchEntry`. `settings-navigation-types.ts:43`: delete `'servers',`; then fix each `pane: 'servers'` caller: `ProviderHostScopeControl.tsx:23` → delete the `openHostsSettings` function and its button; `automation-host-recovery.ts:24-30` → delete the `runtime` branch so `versionSettingsTarget` returns the SSH/automations target only; `HostSectionHeaderMenu.tsx:57-63` → delete the `row.kind === 'runtime'` branch; `HostRemoveDialog.tsx:88-96` → delete `handleRemoveRuntime` and its call. `SessionHistorySettingsPane.tsx`: delete lines 20, 35, 53 and the `<SessionHistoryServerRow … />` block starting at 224 (through its closing tag) plus the `.map` over `environments` that wraps it. `AddRemoteHostDialog.tsx`: delete lines 8, 10-12, 15; change line 23 to `export type AddRemoteHostMode = 'ssh'`; delete 56-57, 63-67, 95-96, `saveRemoteServer` (240-~300) and the `<AddRemoteHostServerFormPanel …/>` branch (354-368) together with the mode switch that selected it. `AddRemoteHostFields.tsx`: delete lines 9-11 and `RemoteServerFields` (142-~270). `AddRepoHostSelectorSlot.tsx:23`: delete the `onAddRemoteServer` prop line and its consumer in the slot component. `AppRootSurfaces.tsx`: delete 54-56 and 333. `use-app-shell-services.ts`: delete lines 20 and 43.
- [ ] **Step 5: Status bar.** `SshStatusSegment.tsx`: delete the imports at 19-20, 27, 29-33; the `connectRuntimeEnvironment…` helper (43-60); the `runtimeEnvironments`/`runtimeHosts` derivation (75, 100-115); the connect/disconnect callbacks (129-160); both `<RuntimeHostStatusRow …/>` renders (263-290); and the `openSettingsTarget({ pane: 'servers', … })` menu item (300-310). Keep every SSH row and SSH menu item untouched (B6 edits them later).
- [ ] **Step 6: Store slices and the active-server setter.** `store/types.ts`: delete 41 and 82; `store/index.ts`: delete 43 and 112; `store-test-helpers.ts`: delete the `remote-server-updates` rows (`rg -n 'RemoteServerUpdates|remote-server-updates' src/renderer/src/store/slices/store-test-helpers.ts`). `runtime-status-refresh.ts`: delete the `runtime-status-probe-diagnostics` import and the lines that call it (`rg -n 'probeDiagnostics|runtime-status-probe-diagnostics' src/renderer/src/store/slices/runtime-status-refresh.ts`). `store/slices/settings.ts`: delete line 49 and the `setActiveRuntimeEnvironmentPreference` action (240-282), plus the now-unused `verifyRuntimeEnvironmentReachable` (159-171) and `normalizeRuntimeEnvironmentId` if only it used them. `use-settings-store-model.ts`: delete 36-38, 120, 133, 189-190. `composer-store-actions.ts:93`, `target-store-model.ts:56`, `composer-target-store.ts:74,91,193`: delete each line. `src/preload/api/settings-bridge.ts:17-18` and `settings-api.ts:13-15`: delete.
- [ ] **Step 7: Localization.** Run `pnpm run verify:localization-catalogs`, `pnpm run verify:localization-extraction`, `pnpm run verify:localization-coverage`. Each orphaned key they name (expected families: `auto.components.settings.Settings.bd0181eeca|7686cb5c36|b5ee17826b`, `auto.hooks.useSettingsNavigationMetadata.de0c2907a1|40d80bad8a`, `auto.components.settings.RuntimeEnvironmentsPane.*`, `auto.components.settings.RuntimeHostAccessForm.*`, `auto.components.settings.RemoteServerUpdate*.*`, `auto.components.settings.SessionHistoryServerRow.*`, `auto.components.sidebar.AddRemoteHostDialog.server*|pairing*`, `auto.components.status-bar.RuntimeHostStatusRow.*`, `auto.lib.remotePairingCopy.*`) is pruned with the Spec A snippet:
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
  then `pnpm run sync:localization-runtime-catalog`, and re-run the three verifiers until they exit 0.
- [ ] **Step 8: Verify.** `pnpm test src/renderer/src/runtime/runtime-rpc-client.test.ts` → the Step 1 cases pass. `pnpm tc`; `pnpm test src/renderer/src/runtime src/renderer/src/store/slices/settings.test.ts src/renderer/src/store/slices/runtime-status.test.ts src/renderer/src/components/settings src/renderer/src/components/sidebar src/renderer/src/components/status-bar src/renderer/src/hooks src/renderer/src/i18n`; `pnpm run check:code-quality:changed`; `pnpm run check:local-only`; `pnpm run check:reliability-gates`; prune `ci-shard-timings.json` keys for deleted tests (same snippet as B5.1 step 10); `rg -n "pane: 'servers'|RemoteServerUpdate|runtime-rpc-environment-call|setActiveRuntimeEnvironmentPreference" src --glob '!*.test.*'` → no hits.
- [ ] **Step 9: Commit.**
  ```
  refactor(local-only): remove the Remote Orca Servers UI and the renderer environment RPC path

  Delete the Servers settings pane, the Add Remote Host server form, the
  paired-server status-bar rows and the remote server-update flow. The
  renderer RPC client only targets the local runtime; an environment
  target fails with unsupported_in_local_build and the persisted
  activeRuntimeEnvironmentId is ignored.

  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01PskLbdTqJNXxJ7KRnDoDoD
  ```

---

### Task B5.3: Paired-runtime browser client host (main) and the Local Network connection probe

**Files:**
- Delete: `src/main/browser/paired-runtime-browser-*.ts` (11 source files + their `*.test.ts`), `src/main/browser/{browser-host-admission-recovery,browser-host-client-identity,browser-host-command-result-settler,browser-host-command-result-submission,browser-host-lease-inventory-refresh,browser-host-lease-reconnect-attempts,browser-host-lease-request-sender}.ts` (+ tests), `src/main/browser/{browser-client-file-channel-transport,browser-client-host-placement-preparation,browser-client-page-metadata-transport,browser-client-host-environment-routes,browser-client-host-command-dispatcher,browser-client-host-command-join,browser-client-host-command-page,browser-client-host-command-result-cache,browser-client-host-command-state,browser-client-host-attach-request,browser-client-host-authority-replacement,browser-client-host-authority-replacement-wait,browser-client-host-command-authority}.ts` (+ tests), `src/main/ipc/runtime-environment-browser-client-host-handler.ts` (+ test), `src/main/browser/browser-manager-client-hosted-downloads.test.ts`, `src/main/ipc/browser-client-page-metadata-ipc.test.ts`, `src/main/ipc/local-network-connection-test.ts`, `src/main/ipc/local-network-connection-test.test.ts`, `src/renderer/src/components/settings/{LocalNetworkConnectionTest.tsx,LocalNetworkConnectionTest.test.tsx,local-network-connection-history.ts}`.
- KEEP (inert, see conventions): `browser-host-lease-reconnect-delay.ts`, `browser-client-host-id.ts`, `browser-client-page-renderer-runtime.ts`, `browser-client-page-automation-runtime.ts`, `browser-client-page-command-failure.ts`, `browser-client-download-routing.ts`, `browser-client-download-relay.ts`, `browser-client-route-cookie-import.ts`, `browser-client-network-route-*.ts`, every `browser-client-page-*`/`browser-client-upload-*` file not listed above, and everything under `src/main/runtime/browser-host-*`, `runtime-browser-client-*`, `runtime-browser-screencast-*`, `rpc/methods/browser-client-host.ts`, `rpc/methods/browser-client-file-channel.ts`, `rpc/methods/browser-screencast.ts`.
- Modify: `src/main/startup/main-process-quit.ts:15,210,242`; `src/main/browser/browser-session-startup.ts:5,24-26`; `src/main/ipc/browser-session-profile-ipc.ts:5,133,135,137-157,184-195`; `src/main/ipc/browser-guest-view-ipc.ts:3-8,142-168,183-188`; `src/main/ipc/runtime-environments.ts:25-26,70-…,95-…` (the `retirePairedRuntimeBrowserClientHostEnvironment` call and `registerRuntimeEnvironmentBrowserClientHostHandler({...})` block); `src/main/ipc/developer-permissions.ts:5,247-251`; `src/preload/api/developer-permissions-bridge.ts:9-10`; `src/preload/api/os-permission-api.ts:11,46-49`; `src/renderer/src/components/settings/DeveloperPermissionsPane.tsx:23,379`; `src/shared/developer-permissions-types.ts:35-50` (`LocalNetworkConnectionTest*` types); `src/main/startup/main-process-ready-identity-write.test.ts`, `src/main/ipc/browser-session-profile-ipc.test.ts`, `src/main/browser/browser-session-startup.test.ts`, `src/main/browser/browser-route-partition-storage-retirement.test.ts`, `src/main/browser/browser-route-partition-stability.test.ts` (delete the cases/mocks that reference deleted modules); `config/reliability-gates.jsonc` (gates `browser-session.remote-terminal-link-ownership` at ~4002 and `browser-session.remote-html-preview-ownership` at ~4102 keep only test files that still exist); `config/scripts/ci-shard-timings.json`.
- Test: `src/main/ipc/browser-guest-view-ipc.test.ts` (new RED test), `src/main/ipc/browser-session-profile-ipc.test.ts`, `src/main/browser/browser-session-startup.test.ts`, `src/main/startup/main-process-quit*.test.ts`, `src/main/startup/main-process-ready-identity-write.test.ts`, `src/main/ipc/developer-permissions.test.ts`, `src/renderer/src/components/settings/DeveloperPermissionsPane*.test.tsx`.

**Interfaces:**
- Consumes: `src/main/ipc/runtime-environments.ts` (still present until B5.5; only its two browser-client-host lines change here).
- Produces: no `browser:publishClientPageMetadata`, `browser:session:importFromBrowserForClientHost`, `browser:session:detectBrowsersForClientHost`, `browser:session:clientRouteImportSources` or `developerPermissions:testLocalNetworkConnection` IPC handlers; `shutdownPairedRuntimeBrowserClientHosts` and `configurePairedRuntimeBrowserClientHostsForOrcaProfile` no longer exist; main never opens a browser-host lease.

- [ ] **Step 1: RED — the client-page metadata IPC is gone.** There is no test for this module yet; create `src/main/ipc/browser-guest-view-ipc.test.ts` by copying the `vi.hoisted` + `vi.mock('electron', …)` scaffold from `src/main/ipc/browser-session-profile-ipc.test.ts:1-30`, and mock every non-`electron` import that `sed -n 1,30p src/main/ipc/browser-guest-view-ipc.ts` lists (`../browser/browser-manager` → `{ browserManager: {} }`, `./browser-renderer-trust` → `{ isTrustedBrowserRenderer: () => true }`, the metadata transport/protocol modules → `vi.fn()` stubs until Step 3 deletes their imports) with:
  ```ts
  import { registerBrowserGuestViewHandlers } from './browser-guest-view-ipc'

  describe('browser guest view IPC in the local-only build', () => {
    it('does not register the paired-runtime client page metadata channel', () => {
      registerBrowserGuestViewHandlers()
      const channels = handleMock.mock.calls.map(([channel]) => channel)
      expect(channels).not.toContain('browser:publishClientPageMetadata')
      expect(channels).toContain('browser:cancelDownload')
    })
  })
  ```
  Run `pnpm test src/main/ipc/browser-guest-view-ipc.test.ts`. Expected: FAILS on the `not.toContain` line.
- [ ] **Step 2: Delete** every path under Delete (`git rm -q` each; use `git rm -q src/main/browser/paired-runtime-browser-*` for the glob). Expected: `ls src/main/browser | rg '^paired-runtime'` → empty.
- [ ] **Step 3: Startup and window seams.** `main-process-quit.ts`: delete line 15, line 210 and line 242. `browser-session-startup.ts`: delete line 5 and lines 24-26. `browser-session-profile-ipc.ts`: delete line 5, the `removeHandler` lines 133 and 135, the `importFromBrowserForClientHost` handler (137-157), the `clientRouteImportSources` handler (159-172 — delete only if `clientRouteCookieImportSources` has no other caller; `rg -n clientRouteCookieImportSources src/main --glob '!*.test.*'`), and the `detectBrowsersForClientHost` handler (182-195); delete the renderer/preload callers of those three channels (`rg -n "importFromBrowserForClientHost|detectBrowsersForClientHost|clientRouteImportSources" src/preload src/renderer --glob '!*.test.*'` → delete each line/branch, which live only in the inert client-hosted settings path). `browser-guest-view-ipc.ts`: delete lines 3-8 and the `browser:publishClientPageMetadata` handler (142-168) and `browserClientPageMetadataErrorCode` (183-188); delete the preload/renderer caller (`rg -n 'publishClientPageMetadata' src/preload src/renderer --glob '!*.test.*'` → `browser-client-page-metadata-publisher.ts` becomes a no-op: delete the IPC call line; the publisher only runs for client-hosted pages).
- [ ] **Step 4: `runtime-environments.ts` seam.** Delete lines 25-26, the `return retirePairedRuntimeBrowserClientHostEnvironment(` call block starting at line 70 (so the enclosing function returns its remaining teardown promise or `Promise.resolve()`), and the `registerRuntimeEnvironmentBrowserClientHostHandler({ … })` call block starting at line 95. Leave `runtime-environment-handler-channels.ts` alone (B5.5 deletes the file; the `removeHandler` sweep at `runtime-environments.ts:81-88` tolerates a channel with no handler). The preload `prepareBrowserClientHostPlacement` keeps invoking the channel until B5.5 replaces the bridge; nothing registers it, so the invoke rejects (fail closed).
- [ ] **Step 5: Local Network probe.** `developer-permissions.ts`: delete line 5 and lines 247-251. `developer-permissions-bridge.ts`: delete 9-10; `os-permission-api.ts`: delete 11 and 46-49. `DeveloperPermissionsPane.tsx`: delete line 23 and line 379. `developer-permissions-types.ts`: delete the `LocalNetworkConnectionTestFailure` and `LocalNetworkConnectionTestResult` types (35-50). Why in B5: the probe dials a user-typed non-loopback host (`src/main/ipc/local-network-connection-test.ts:13-15`) and is the last importer of `classifyRemotePairingHostname` from `remote-pairing-address.ts`; I1′ has no exception for it.
- [ ] **Step 6: Tests and gates.** Delete the test cases/mocks that reference deleted modules in the Modify test list (`rg -ln "paired-runtime-browser|browser-host-lease-request-sender|browser-client-page-metadata-transport|browser-client-host-placement-preparation|local-network-connection-test|LocalNetworkConnectionTest" src --glob '*.test.*'`). Run `pnpm run check:reliability-gates`; for each failing gate remove the deleted `testFiles` entries and the `commands` entry that ran them (keep the gate; it still lists surviving files). Prune `ci-shard-timings.json` keys for deleted tests. Run the localization verifiers (the `LocalNetworkConnectionTest` strings become orphans) and prune with the B5.2 step 7 snippet.
- [ ] **Step 7: Verify.** `pnpm test src/main/ipc/browser-guest-view-ipc.test.ts` → Step 1 passes. `pnpm tc`; `pnpm test src/main/browser src/main/ipc/browser-session-profile-ipc.test.ts src/main/ipc/browser-guest-view-ipc.test.ts src/main/startup src/main/ipc/developer-permissions.test.ts src/renderer/src/components/settings/DeveloperPermissionsPane.test.tsx`; `pnpm run check:code-quality:changed`; `pnpm run check:local-only`; `rg -n 'paired-runtime-browser|shutdownPairedRuntimeBrowserClientHosts|testLocalNetworkConnection' src --glob '!*.test.*'` → no hits.
- [ ] **Step 8: Commit.**
  ```
  refactor(local-only): remove the paired-runtime browser client host and the LAN probe

  Delete the browser-host lease, command dispatch and page-metadata
  transports that let this desktop host browser pages for a paired Orca
  server, their startup/quit/IPC seams, and the Developer Permissions
  local-network connection test that dialed a user-typed host.

  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01PskLbdTqJNXxJ7KRnDoDoD
  ```

---

### Task B5.4: Orchestration federation — transport cut and the coordinator RPC family

**Files:**
- Delete: `src/main/runtime/rpc/methods/orchestration/federation/` (whole directory, 42 files incl. tests and `*.test-support.ts`), `src/main/runtime/rpc/methods/orchestration/messaging/{ask-remote,send-remote,send-control-mail}.ts`, `src/main/runtime/rpc/methods/orchestration/worker/worker-legacy-federated-read.ts`, `src/shared/rpc-contract/orchestration-federation-{control,relay,start}-params.ts`, `src/main/runtime/orchestration/orchestration-peer-capability-cache.ts` + `.test.ts`, `src/cli/handlers/orchestration-federated-legacy-settlement.test.ts`, `src/main/runtime/rpc/methods/orchestration/messaging/check-worker-federated-attachment.test.ts`.
- KEEP (inert): `src/main/runtime/runtime-orchestration-federation.ts`, `src/main/runtime/orchestration/environment-transport.ts`, `src/main/runtime/orchestration/federation-*.ts`, `src/main/runtime/orchestration/db/federation/**`, the orchestration DB schema/migrations, `db/orchestration-db-methods.ts` federated rows.
- Modify: `src/main/startup/main-process-runtime-service.ts:20-24,48-69,142`; `src/main/runtime/rpc/methods/orchestration.ts:3,16`; `src/main/runtime/rpc/methods/orchestration/worker/workers.ts:3,57-68`; `worker/worker-control.ts:10,18-19,39-47,84-96`; `worker/worker-release.ts:3,5,20-34`; `worker/worker-stop.ts:7,22-80`; `worker/worker-list-method.ts:8-11,208-217,305`; `worker/worker-start-validation.ts:5,89-134`; `worker/worker-observation.ts:296-356` (`exposeFederatedWorkerObservation`, `resolvePinnedFederatedServer`, `callFederatedWorkerShow` once no survivor imports them); `messaging/ask-methods.ts:6-7,50-61`; `messaging/send-methods.ts:24,28,177-183,197-210`; `messaging/routing.ts:126-131` (`rejectFederatedExplicitTarget`, delete when unused); `src/main/runtime/orchestration/worker-terminal-release-reconciliation.ts:2-3` and its remote-attachment branch; `src/shared/protocol-version.ts:46-62,356-358,361-363`; `src/shared/rpc-contract/rpc-params-catalog.generated.ts` (regenerated); tests `worker/workers-recovery.test.ts`, `worker/worker-list-pagination.test.ts`, `worker/worker-stop-capability.test.ts`, `messaging/recipient-routing.test.ts`, `messaging/send-group.test.ts`, `messaging/worker-report-authority.test.ts`, `messaging/send-dispatch-authority.test.ts`, `runs/migration-behavior.test.ts`, `src/main/runtime/rpc/methods/orchestration-worker-start-mode-selection.test.ts`, `src/main/runtime/orchestration/db/schema/federated-home-run-migration.test.ts`, `src/main/ipc/register-core-handlers/register-core-handlers.test.ts:6,65,130-136,364,462,558-584`; `config/reliability-gates.jsonc`; `config/scripts/ci-shard-timings.json`.
- Test: `src/main/startup/main-process-runtime-service-transport.test.ts` (new RED), `src/main/runtime/rpc/methods/orchestration-worker-start-mode-selection.test.ts` (contract pin), `src/main/runtime/rpc/methods/orchestration/**`, `src/main/runtime/orchestration/**`, `src/cli/handlers/orchestration*.test.ts`.

**Interfaces:**
- Consumes: `OrchestrationError` (`src/main/runtime/orchestration/orchestration-error.ts`), `RuntimeOrchestrationFederation` constructed with `transport === null` (already throws `server_required`).
- Produces: `OrcaRuntimeService` options no longer receive `orchestrationEnvironmentTransport` from startup (the field stays optional in `orca-runtime-state-fields.ts`; nothing passes it); `orchestration.workerStart` with `on`, and every `orchestration.worker*`/`send`/`ask` call that resolves a persisted federated dispatch row, throws `OrchestrationError('server_required', 'Connected-server orchestration is unavailable in this build.')`; no `orchestration.federation*` RPC methods.

- [ ] **Step 1: RED — startup no longer composes an environment transport, and a remote worker start fails closed.** (a) Create `src/main/startup/main-process-runtime-service-transport.test.ts` (same source-ratchet style as `src/shared/child-process/child-process-import-boundary.test.ts`):
  ```ts
  import { readFileSync } from 'node:fs'
  import { join } from 'node:path'
  import { describe, expect, it } from 'vitest'

  describe('main-process runtime composition in the local-only build', () => {
    it('never wires an orchestration environment transport', () => {
      const source = readFileSync(join(__dirname, 'main-process-runtime-service.ts'), 'utf8')
      expect(source).not.toMatch(/runtime-environment-transport-routing|runtime-environment-store|orchestrationEnvironmentTransport/)
    })
  })
  ```
  Run it: FAILS (the file imports both and passes the transport at line 142). (b) In `src/main/runtime/rpc/methods/orchestration-worker-start-mode-selection.test.ts` delete the `vi.mock('./orchestration/federation/federated-worker-start', …)` block (lines ~27-29) and add, using the file's existing helper that finds `orchestration.workerStart` in `ORCHESTRATION_METHODS` (lines 112-122):
  ```ts
  it('rejects --on with server_required in the local-only build', async () => {
    await expect(
      startWorker({ run: runId, on: 'build-server', agent: 'claude', spec: 'remote task' })
    ).rejects.toMatchObject({ code: 'server_required' })
  })
  ```
  This case passes immediately (the fixture runtime has no transport, so the mixin throws `server_required` at `runtime-orchestration-federation.ts:56-64`); it is kept as the contract pin that Step 4's guard must preserve once the real `startFederatedWorker` is gone.
- [ ] **Step 2: Transport cut.** `main-process-runtime-service.ts`: delete lines 20-24 (the four federation/environment imports), 48-69 (`orchestrationEnvironmentTransport` object) and 142 (`orchestrationEnvironmentTransport,`). Run the Step 1(a) test again: PASS.
- [ ] **Step 3: Delete the coordinator RPC family.**
  ```bash
  git rm -r -q src/main/runtime/rpc/methods/orchestration/federation
  git rm -q src/main/runtime/rpc/methods/orchestration/messaging/ask-remote.ts \
    src/main/runtime/rpc/methods/orchestration/messaging/send-remote.ts \
    src/main/runtime/rpc/methods/orchestration/messaging/send-control-mail.ts \
    src/main/runtime/rpc/methods/orchestration/messaging/check-worker-federated-attachment.test.ts \
    src/main/runtime/rpc/methods/orchestration/worker/worker-legacy-federated-read.ts \
    src/shared/rpc-contract/orchestration-federation-control-params.ts \
    src/shared/rpc-contract/orchestration-federation-relay-params.ts \
    src/shared/rpc-contract/orchestration-federation-start-params.ts \
    src/main/runtime/orchestration/orchestration-peer-capability-cache.ts \
    src/main/runtime/orchestration/orchestration-peer-capability-cache.test.ts \
    src/cli/handlers/orchestration-federated-legacy-settlement.test.ts
  ```
  `orchestration.ts`: delete lines 3 and 16.
- [ ] **Step 4: Fail-closed caller edits (exact).** `workers.ts`: delete line 3; replace lines 57-68 (`if (params.on) { … }`) with
  ```ts
  if (params.on) {
    throw new OrchestrationError(
      'server_required',
      'Connected-server orchestration is unavailable in this build.'
    )
  }
  ```
  `worker-control.ts`: delete lines 10, 18-19; replace 39-47 and 84-96 (each `if (federated) { … }`) with
  ```ts
  if (db.getFederatedDispatch(params.dispatch)) {
    throw new OrchestrationError(
      'server_required',
      'Connected-server orchestration is unavailable in this build.'
    )
  }
  ```
  (drop the `const federated =` line in each). `worker-release.ts`: delete lines 3 and 5; replace 20-34 with the same guard. `worker-stop.ts` (lines 22-80 reference `getFederatedDispatch`/`resolvePinnedFederatedServer`/`orchestration.federationStop`): replace the `if (federated) { … }` block with the same guard and delete the `resolvePinnedFederatedServer` import at line 7 if unused. `worker-list-method.ts`: delete 8-11, 208-217 and the `partialHostErrors` spread at 305; `includeRemote` now lists local rows only. `worker-start-validation.ts`: delete line 5 and `prepareFederationAttachmentWorkerStart` (89-134); keep `validateFederatedWorkerStartPlacement` only if a survivor imports it (`rg -n validateFederatedWorkerStartPlacement src/main --glob '!*.test.*'`), else delete it too. `ask-methods.ts`: delete lines 6-7; replace 50-61 (`if (remoteAttachment && paneKey) { … }`) with the same guard keyed on `remoteAttachment`. `send-methods.ts`: delete 24 and 28; delete the `federatedTarget` computation (177-183, keep `assertDispatchMailboxDeliverable` unconditional for an addressed dispatch) and replace 197-210 with
  ```ts
  if (addressedDispatchId && db.getFederatedDispatch(addressedDispatchId)) {
    throw new OrchestrationError(
      'server_required',
      'Connected-server orchestration is unavailable in this build.'
    )
  }
  ```
  `worker-observation.ts`: delete `exposeFederatedWorkerObservation`, `resolvePinnedFederatedServer` and `callFederatedWorkerShow` (296-356) once `rg -n 'resolvePinnedFederatedServer|exposeFederatedWorkerObservation|callFederatedWorkerShow' src/main --glob '!*.test.*'` shows no survivor. `routing.ts:126-131`: delete `rejectFederatedExplicitTarget` when unused. `worker-terminal-release-reconciliation.ts`: delete lines 2-3 and the branch that calls `inspectRemoteAttachment`/`releaseRemoteAttachment` (remote attachments are counted as `unknown` and left untouched — never released or settled locally).
- [ ] **Step 5: Capabilities and catalog.** `protocol-version.ts`: delete the constants at 46-50 and 55-62 (`ORCHESTRATION_FEDERATION_*` and the two `*_PROTOCOL_VERSION`) and their rows in `RUNTIME_CAPABILITIES` (356-358, 361-363); fix the remaining importers (`rg -n 'ORCHESTRATION_FEDERATION_' src --glob '!*.test.*'` → each line is deleted; `send-control-mail.ts` is already gone). Run `pnpm run generate:rpc-params-catalog` then `pnpm run verify:rpc-params-catalog`. Expected: the generated catalog loses the `orchestration.federation*` rows and the three deleted param imports.
- [ ] **Step 6: Tests.** `register-core-handlers.test.ts`: delete the `callRuntimeEnvironmentMock` plumbing and the two cases that assert on it (6, 65, 130-136, 364, 462, 558-584) — the `vi.mock('../runtime-environment-transport-routing')` block goes now so B5.5's deletion is mock-free. In the other listed tests delete every `it` that starts a federated dispatch, imports a `federation/*` module, or asserts a `partialHostErrors`/`federationFleetSnapshot` shape (`rg -n "federation|Federated|federated" <file>`); keep DB-level cases that only read `getFederatedDispatch` rows from a seeded database (hydration tolerance). `pnpm run check:reliability-gates` and fix gates that listed deleted federation tests (U6.1 treatment). Prune `ci-shard-timings.json`.
- [ ] **Step 7: Verify.** `pnpm tc`; `pnpm test src/main/runtime/rpc/methods/orchestration src/main/runtime/orchestration src/main/runtime/rpc/methods/orchestration-worker-start-mode-selection.test.ts src/main/startup src/cli/handlers`; `pnpm run check:code-quality:changed`; `pnpm run check:local-only`; `rg -n "orchestration\.federation|federation-methods|ask-remote|send-remote|send-control-mail" src --glob '!*.test.*'` → no hits. Smoke: with the app built (`ORCA_BACKGROUND_LAUNCH=1`), `orca orchestration workerStart --on x …` reports `server_required`.
- [ ] **Step 8: Commit.**
  ```
  refactor(local-only): remove orchestration federation to paired servers

  Stop building the environment transport at startup and delete the
  coordinator-side federation RPC family. Every path that would dispatch,
  relay or read a worker on a paired Orca server now fails with
  server_required; persisted federated dispatch rows stay readable.

  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01PskLbdTqJNXxJ7KRnDoDoD
  ```

---

### Task B5.5: Main-process environment IPC, transport routing, upload rails, preload bridge stub, active-server setter, capability scaffolding

**Files:**
- Delete: `src/main/ipc/runtime-environment-*.ts` and `src/main/ipc/runtime-environments*.ts` (every file listed by `ls src/main/ipc | rg '^runtime-environment'`, 49 files incl. tests and `runtime-environments-ipc-test-harness.ts`), `src/main/ipc/runtime-upload-file-stream.ts` + `.test.ts`, `src/main/ipc/runtime-upload-temp-sweep.ts` + `.test.ts`, `src/main/ipc/runtime-upload-slice-boundaries.test.ts`, `src/main/ipc/filesystem-mutations-runtime-upload.test.ts`, `src/main/ipc/filesystem-runtime-upload-staging.ts` (only if `rg -n filesystem-runtime-upload-staging src/main --glob '!*.test.*'` lists only `filesystem-mutations.ts`), `src/main/window/clipboard-runtime-image-upload.ts` (+ test), `src/main/window/clipboard-runtime-owned-ssh-paste.test.ts`, `src/main/skills/skill-runtime-capability.ts` (+ test), `src/main/ai-vault/runtime-session-scanner.ts` (+ test), `src/main/ai-vault/runtime-session-search-call.ts` (+ test), `src/main/runtime/remote-runtime-terminal-create-idempotency.ts`, `remote-runtime-terminal-create-identity.ts`, `orca-runtime-terminal-create-idempotency.test.ts`, `src/preload/runtime-environment-subscriptions.ts` + `.test.ts`, `src/main/runtime/rpc/runtime-client-capabilities.ts` + `.test.ts`, `src/main/runtime/rpc/methods/runtime-client-capabilities.ts` + `.test.ts`, `src/shared/rpc-contract/runtime-client-capabilities-params.ts`, `src/shared/pairing-local-ui-fields.ts` + `.test.ts`, `src/main/runtime/rpc/methods/client-ui-pairing-local-fields.test.ts`, `src/shared/runtime-environment-diagnostics.ts`, `src/shared/runtime-host-status-owner.ts` + `.test.ts`, `src/shared/runtime-rpc-call-queue.ts` + its three `.test.ts`, `src/shared/remote-runtime-tailscale-hint.ts` + `.test.ts`, `src/shared/remote-server-update.ts`, `src/shared/remote-runtime-shared-control-types.ts`.
- Modify: `src/main/ipc/register-core-handlers/register-core-handlers.ts:18,85-86,201` (+ the ai-vault scanner/search-call wiring lines that use the two imports); `src/preload/api/runtime-environments-bridge.ts` (replaced by the stub); `src/preload/api/runtime-api.ts:11-17,19-34,80-130`; `src/preload/api/runtime-bridge.ts:11`; `src/preload/api-types.ts:124` (unchanged type reference, verify); `src/main/ipc/settings.ts:30,303-319`; `src/main/ipc/filesystem-mutations.ts:24-29,221-245` (the `fs:uploadExternalFileToRuntime` and staging handlers), `src/preload/api/{filesystem-api.ts,fs-bridge.ts}` (their `uploadExternalFileToRuntime`/`stageExternalFilesForRuntimeUpload` lines), `src/renderer/src/runtime/runtime-file-upload-client.ts` (the branch that calls them; it runs only for environment targets — delete the call lines and let the function throw `unsupported_in_local_build` for a non-local target), `src/shared/runtime-upload-staging-contract.ts` and `filesystem-import-result-types.ts` (types that reference it); `src/main/window/clipboard-ipc-handlers.ts:40,64-…` (the remote image upload branch); `src/main/ipc/skill-install-management-ipc-handlers.ts:16-22,64-90,105-140,178-215` (every `callRuntimeEnvironment` branch — the handler keeps its local path and throws `new Error('skill-install-remote-unsupported')` when `environmentId` is set); `src/main/browser/doc-preview-file-reader.ts:4,111-125,216` (the runtime-owner branch returns a failure outcome using the file's existing `DocPreviewFileFailureReason` vocabulary — read the union first and pick the closest existing member, never add one); `src/main/browser/browser-route-partition-storage-runtime.ts:2,40-41` (the `listEnvironments(...)` scope rows); `src/main/runtime/orca-runtime-runtime-id.ts:29,175` and `src/main/runtime/orca-runtime-terminal-create-deduplication.ts:5,33` (`deriveRemoteRuntimeTerminalCreateHandle` is only reached when a remote client pre-allocates a handle; delete the branch); `src/main/runtime/rpc/methods/index.ts:35,82`; `src/main/runtime/rpc/methods/client-ui.ts:1,62,70-71,79`; `src/main/runtime/runtime-rpc.ts:5-8`; `src/main/runtime/runtime-rpc/runtime-rpc-pairing-types.ts:18-30`; `src/main/runtime/orca-runtime-get-status.ts:14,19,84-87` (keep `MIN_COMPATIBLE_RUNTIME_CLIENT_VERSION` and the `minCompatible*` fields at 136/148 — inert integers read by local tests); `src/shared/protocol-version.ts:45,84-91,104,148,316-341,353-355,367-370,387`; `src/shared/runtime-session-contracts.ts:2-3,89-90,123`; `src/shared/runtime-host-status.ts:1,16`; `src/shared/execution-host-registry.ts` (only if it imports a deleted symbol); `src/main/persistence/applying-settings/terminal-settings-migrations.ts:56-78`; `src/main/ipc/settings.test.ts`, `src/main/ipc/skill-install-management-ipc-handlers.test.ts`, `src/main/window/clipboard-ipc-handlers.test.ts`, `src/main/browser/doc-preview-file-reader.test.ts`, `src/main/browser/browser-route-partition-storage-runtime.test.ts`, `src/main/runtime/rpc/methods/client-ui.test.ts:3,401,441,513-573,670,732,790`, `src/main/runtime/rpc/methods/structured-agent-session-background-task-capability.test.ts`, `src/main/runtime/rpc/worktree-removal-marker-projection.test.ts`, `src/shared/worktree/github-pr-suppression.test.ts`, `src/renderer/src/hooks/ipc-events/runtime-client-ipc-bridge-ownership.test.ts`, `src/renderer/src/app-shell/workspace-view-cross-client-sync.test.tsx` (mocks/imports of deleted modules); `config/reliability-gates.jsonc` (gate `runtime.streaming-subscription-close-delivery` at ~3925 lists only `src/main/ipc/runtime-environments-subscription-teardown.test.ts` → delete the whole gate); `config/scripts/ci-shard-timings.json`.
- Test: `src/main/persistence/loading-store/normalize-loaded-global-settings.test.ts` (RED), `src/main/runtime/rpc/methods/client-ui.test.ts` (RED), `src/preload/api/runtime-environments-bridge.test.ts` (new, RED), `src/main/ipc/settings.test.ts`, `src/main/ipc/register-core-handlers/register-core-handlers.test.ts`, `src/main/ipc/skill-install-management-ipc-handlers.test.ts`, `src/main/window/clipboard-ipc-handlers.test.ts`, `src/main/browser/doc-preview-file-reader.test.ts`, `src/main/runtime/orca-runtime-get-status*.test.ts`, `src/main/runtime/rpc/methods/index*.test.ts`.

**Interfaces:**
- Consumes: `PreloadApi['runtimeEnvironments']` type (shrunk), `GlobalSettings.activeRuntimeEnvironmentId` (kept in `global-settings-types.ts:503` and `default-global-settings.ts:256`).
- Produces: preload `window.api.runtimeEnvironments` stub `{ getStatusSnapshots, onStatusChanged, list, connect, disconnect, getStatus, prepareBrowserClientHostPlacement, retryConnectionsNow, call, subscribe }`; no `runtimeEnvironments:*` IPC channels; no `settings:set-active-runtime-environment-preference`; `stripRetiredGlobalSettings` drops `activeRuntimeEnvironmentId` so load and update always resolve it to the default `null`; `ui.get`/`ui.set` return the full `PersistedUIState` (no pairing-local field stripping); no `runtime.clientCapabilities.update`; `RUNTIME_CAPABILITIES` no longer advertises `remote-runtime.shared-control.v1`, `runtime.environments.v1`, `browser.clientHost*.v1`, `terminal.paired-parking.v1`, `updater.remote-control.v1`.

- [ ] **Step 1: RED — persisted `activeRuntimeEnvironmentId` hydrates to null.** Add to `src/main/persistence/loading-store/normalize-loaded-global-settings.test.ts` (it already has `normalizeLegacyProfile(overrides)` at line 11):
  ```ts
  it('drops a persisted activeRuntimeEnvironmentId so the local-only build never targets a paired server', () => {
    const settings = normalizeLegacyProfile({ activeRuntimeEnvironmentId: 'env-from-upstream-build' })
    expect(settings.activeRuntimeEnvironmentId).toBeNull()
  })
  ```
  And in `src/main/runtime/rpc/methods/client-ui.test.ts`, replace the assertion at line 401 with:
  ```ts
  expect(response).toMatchObject({ ok: true, result: { ui } })
  ```
  (and likewise at 441, 573, 670, 732, 790: the expected `ui` is the full state, not `omitPairingLocalUiFields(...)`; delete the import at line 3 and the `manualRepoOrder`-stripping case at 513-573 whose premise is a paired client). Run both files. Expected: the hydration case FAILS (value passes through today); the client-ui cases FAIL (fields are stripped today).
- [ ] **Step 2: Hydration strip.** `terminal-settings-migrations.ts`: add `activeRuntimeEnvironmentId?: unknown` to `RetiredGlobalSettings` (line ~62) and in `stripRetiredGlobalSettings` add `activeRuntimeEnvironmentId: _legacyActiveRuntimeEnvironmentId,` to the destructuring plus `void _legacyActiveRuntimeEnvironmentId`. Because `normalize-loaded-global-settings.ts:63` spreads `...defaults.settings` first and `settings-update.ts:59` strips updates through the same helper, the value is always the default `null`. Run the Step 1 hydration test → PASS. (B7's explicit strip covers repos/worktrees/terminals; this one line is the settings half and is reported to B7 in orderingDependencies.)
- [ ] **Step 3: Delete the IPC, upload and capability files.**
  ```bash
  git rm -q $(ls src/main/ipc/runtime-environment*.ts src/main/ipc/runtime-environments*.ts) \
    src/main/ipc/runtime-upload-file-stream.ts src/main/ipc/runtime-upload-file-stream.test.ts \
    src/main/ipc/runtime-upload-temp-sweep.ts src/main/ipc/runtime-upload-temp-sweep.test.ts \
    src/main/ipc/runtime-upload-slice-boundaries.test.ts src/main/ipc/filesystem-mutations-runtime-upload.test.ts \
    src/main/window/clipboard-runtime-image-upload.ts src/main/window/clipboard-runtime-owned-ssh-paste.test.ts \
    src/main/skills/skill-runtime-capability.ts src/main/skills/skill-runtime-capability.test.ts \
    src/main/ai-vault/runtime-session-scanner.ts src/main/ai-vault/runtime-session-scanner.test.ts \
    src/main/ai-vault/runtime-session-search-call.ts src/main/ai-vault/runtime-session-search-call.test.ts \
    src/main/runtime/remote-runtime-terminal-create-idempotency.ts src/main/runtime/remote-runtime-terminal-create-identity.ts \
    src/main/runtime/orca-runtime-terminal-create-idempotency.test.ts \
    src/preload/runtime-environment-subscriptions.ts src/preload/runtime-environment-subscriptions.test.ts \
    src/main/runtime/rpc/runtime-client-capabilities.ts src/main/runtime/rpc/runtime-client-capabilities.test.ts \
    src/main/runtime/rpc/methods/runtime-client-capabilities.ts src/main/runtime/rpc/methods/runtime-client-capabilities.test.ts \
    src/shared/rpc-contract/runtime-client-capabilities-params.ts \
    src/shared/pairing-local-ui-fields.ts src/shared/pairing-local-ui-fields.test.ts \
    src/main/runtime/rpc/methods/client-ui-pairing-local-fields.test.ts \
    src/shared/runtime-environment-diagnostics.ts src/shared/runtime-host-status-owner.ts src/shared/runtime-host-status-owner.test.ts \
    src/shared/runtime-rpc-call-queue.ts src/shared/runtime-rpc-call-queue.test.ts \
    src/shared/runtime-rpc-call-queue-retention.test.ts src/shared/runtime-rpc-call-queue-retirement.test.ts \
    src/shared/remote-runtime-tailscale-hint.ts src/shared/remote-runtime-tailscale-hint.test.ts \
    src/shared/remote-server-update.ts src/shared/remote-runtime-shared-control-types.ts
  ```
  (`clipboard-runtime-image-upload.test.ts` and `filesystem-runtime-upload-staging.ts` go with them when present.)
- [ ] **Step 4: Registration and settings seams.** `register-core-handlers.ts`: delete line 18, lines 85-86 and line 201, plus the lines that pass `installRuntimeSessionScanner`/`callRuntimeSessionSearch` into the ai-vault wiring (`rg -n 'runtime-session-scanner|callRuntimeSessionSearch|RuntimeSessionScanner' src/main/ipc/register-core-handlers/register-core-handlers.ts` → delete each). `settings.ts`: delete line 30 and the handler at 303-319 (the `settings:set` strip at line 130 stays, now redundant but harmless). `methods/index.ts`: delete 35 and 82. `client-ui.ts`: delete line 1; line 62 → `handler: (_params, { runtime }) => ({ ui: runtime.getUIState() })`; lines 70-71 → `ui: runtime.updateUIState(params as Partial<PersistedUIState>)`; line 79 → `ui: runtime.recordFeatureInteraction(params)`. Run the Step 1 client-ui cases → PASS. `runtime-rpc.ts`: delete lines 5-8; `runtime-rpc-pairing-types.ts`: delete 18-30 (keep `OrcaRuntimeRpcServerOptions`). `orca-runtime-runtime-id.ts`: delete 29 and 175; `orca-runtime-terminal-create-deduplication.ts`: delete line 5 and the `preAllocatedHandle` branch at 33 (`rg -n 'preAllocatedHandle|terminalCreateIdempotency' src/main/runtime --glob '!*.test.*'` → every hit is deleted).
- [ ] **Step 5: Consumers that keep their local path.** `filesystem-mutations.ts`: delete the imports at 24-29 and the `fs:uploadExternalFileToRuntime` handler (221-~250) and the `fs:stageExternalFilesForRuntimeUpload` handler above it (the one that calls `stageOneSourceForRuntimeUpload`); delete the matching preload lines in `filesystem-api.ts`/`fs-bridge.ts` and the renderer call lines in `runtime-file-upload-client.ts`; delete `src/shared/runtime-upload-staging-contract.ts` and its type references if nothing else imports it. `clipboard-ipc-handlers.ts`: delete line 40 and the branch at 64 that calls `saveClipboardImageBufferInRuntime` (the local clipboard image save stays). `skill-install-management-ipc-handlers.ts`: delete the imports at 16-22 and each `callRuntimeEnvironment(...)` branch (64-90, 105-140, 178-215): where the handler receives `environmentId`, replace the branch with `if (environmentId) { throw new Error('skill-install-remote-unsupported') }` immediately before the local path. `doc-preview-file-reader.ts`: delete line 4 and the function at 111-125; at line 216 replace the runtime-owner call with a failure outcome using an existing `DocPreviewFileFailureReason` member. `browser-route-partition-storage-runtime.ts`: delete line 2 and the `listEnvironments(...).map(...)` scope rows (40-41) so only SSH-target scopes keep partition storage alive (orphaned paired-runtime partitions are collected on next startup, which is the intended outcome).
- [ ] **Step 6: Preload stub (RED first).** Add `src/preload/api/runtime-environments-bridge.test.ts`:
  ```ts
  import { describe, expect, it } from 'vitest'
  import { runtimeEnvironmentsApi } from './runtime-environments-bridge'

  describe('runtimeEnvironments preload stub', () => {
    it('lists no paired servers and reports no status', async () => {
      await expect(runtimeEnvironmentsApi.list()).resolves.toEqual([])
      await expect(runtimeEnvironmentsApi.getStatusSnapshots()).resolves.toEqual([])
    })
    it('fails closed for every call that would dial a paired server', async () => {
      await expect(
        runtimeEnvironmentsApi.call({ selector: 'env-1', method: 'status.get' })
      ).rejects.toThrow(/unsupported_in_local_build/)
      await expect(
        runtimeEnvironmentsApi.subscribe({ selector: 'env-1', method: 'files.watch' }, { onResponse: () => {} })
      ).rejects.toThrow(/unsupported_in_local_build/)
    })
  })
  ```
  Run it against the old bridge: FAILS (it calls `ipcRenderer.invoke`). Then replace the body of `src/preload/api/runtime-environments-bridge.ts` with:
  ```ts
  import type { PreloadApi } from '../api-types'

  // Why a stub and not a deletion: ~50 renderer call sites gate on a paired environment id that
  // this build can never mint; keeping the shape lets them compile while every call fails closed.
  function unsupported(): never {
    throw new Error('unsupported_in_local_build: remote Orca runtimes were removed from this build')
  }

  export const runtimeEnvironmentsApi = {
    getStatusSnapshots: async () => [],
    onStatusChanged: () => () => {},
    list: async () => [],
    disconnect: async () => unsupported(),
    connect: async () => unsupported(),
    getStatus: async () => unsupported(),
    prepareBrowserClientHostPlacement: async () => unsupported(),
    retryConnectionsNow: async () => {},
    call: async () => unsupported(),
    subscribe: async () => unsupported()
  } satisfies PreloadApi['runtimeEnvironments']
  ```
  In `runtime-api.ts` delete the imports at 11-12 and 17 (keep `browser-client-host-placement` at 13-16 and the `RuntimeHostStatusSnapshot` import), keep the `RuntimeEnvironmentSubscriptionHandle` type at 19-22, and inside the `runtimeEnvironments:` block delete `addFromPairingCode`, `verifyAndAddFromPairingCode`, `resolve`, `remove`, `retryControlConnection`, `onSharedControlDiagnostics`. `runtime-bridge.ts:11` → `import type { RuntimeEnvironmentSubscriptionHandle } from './runtime-api'`. Run the new test → PASS.
- [ ] **Step 7: Capabilities and shared types.** `protocol-version.ts`: delete `REMOTE_RUNTIME_SHARED_CONTROL_CAPABILITY` (45), `BROWSER_CLIENT_HOST_RUNTIME_CAPABILITY`/`BROWSER_CLIENT_PAGE_METADATA_RUNTIME_CAPABILITY`/`BROWSER_CLIENT_AUTOMATION_RUNTIME_CAPABILITY`/`BROWSER_CLIENT_FILE_CHANNEL_RUNTIME_CAPABILITY` (84-91), `TERMINAL_PAIRED_PARKING_RUNTIME_CAPABILITY` (104), the re-export at 148, `NATIVE_REMOTE_RUNTIME_CLIENT_CAPABILITIES` and `ELECTRON_REMOTE_RUNTIME_CLIENT_CAPABILITIES` (316-341), the rows `'runtime.environments.v1'`, `REMOTE_RUNTIME_SHARED_CONTROL_CAPABILITY` (354-355), the four `BROWSER_CLIENT_*` rows (367-370) and `TERMINAL_PAIRED_PARKING_RUNTIME_CAPABILITY` (387). Keep `MIN_COMPATIBLE_*` (consumed by `execution-host-registry.ts`, `orca-runtime-get-status.ts`, `runtime-protocol-compat.ts`). Fix importers: `orca-runtime-get-status.ts` delete 14, 19, 84-87; in the kept-inert renderer files `paired-runtime-parking-capabilities.ts` and `pty-connection/paired-parked-terminal-restore.ts` delete the `TERMINAL_PAIRED_PARKING_RUNTIME_CAPABILITY` import and the `capabilities?.includes(...)` check line so the predicate returns `false` (the paired-parking restore path is never reached without an environment); the renderer `local-runtime-capabilities.ts` and any `ELECTRON_REMOTE_RUNTIME_CLIENT_CAPABILITIES` consumer (`rg -n 'REMOTE_RUNTIME_CLIENT_CAPABILITIES|BROWSER_CLIENT_(HOST|PAGE_METADATA|AUTOMATION|FILE_CHANNEL)_RUNTIME_CAPABILITY' src --glob '!*.test.*'`) loses the line. `runtime-session-contracts.ts`: delete lines 2-3, 89-90 and 123. `runtime-host-status.ts`: delete lines 1 and 16. `execution-host-registry.ts`: delete only a now-missing import, if any.
- [ ] **Step 8: Tests, gates, catalog.** Delete the `it`s and `vi.mock` blocks that reference deleted modules in the Modify test list (`rg -ln "runtime-environment|runtime-upload|skill-runtime-capability|runtime-session-scanner|pairing-local-ui-fields|remote-runtime-client-capabilities|runtime-client-capabilities|remote-server-update|remote-runtime-shared-control-types" src --glob '*.test.*'`). `config/reliability-gates.jsonc`: delete the gate `runtime.streaming-subscription-close-delivery` (its only test file is deleted) and run `pnpm run check:reliability-gates` for anything else. `pnpm run generate:rpc-params-catalog && pnpm run verify:rpc-params-catalog`. Prune `ci-shard-timings.json`.
- [ ] **Step 9: Verify.** `pnpm tc`; `pnpm test src/preload src/main/ipc src/main/persistence src/main/runtime/rpc src/main/window src/main/browser/doc-preview-file-reader.test.ts src/main/browser/browser-route-partition-storage-runtime.test.ts src/main/runtime/orca-runtime-get-status.test.ts src/renderer/src/hooks/ipc-events`; `pnpm run check:code-quality:changed`; `pnpm run check:local-only`; `rg -n "runtimeEnvironments:|callRuntimeEnvironment|set-active-runtime-environment-preference|omitPairingLocalUiFields" src --glob '!*.test.*'` → no hits. Smoke (`ORCA_BACKGROUND_LAUNCH=1`): the app boots, `orca status` works, `orca ui get --json` includes `manualRepoOrder`.
- [ ] **Step 10: Commit.**
  ```
  refactor(local-only): remove the runtime-environment IPC rails and stub the preload bridge

  Delete the main-process environment handlers, transport routing, upload
  and skill-install rails, the client-capability negotiation and the
  active-server preference setter. The preload runtimeEnvironments bridge
  is a fail-closed stub, a persisted activeRuntimeEnvironmentId hydrates
  to null, and ui.get/ui.set no longer strip pairing-local fields.

  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01PskLbdTqJNXxJ7KRnDoDoD
  ```

---

### Task B5.6: Shared remote-runtime client stack, pairing codec, environment store, E2EE, `tweetnacl`, probes, e2e and ratchets

**Files:**
- Delete: `src/shared/remote-runtime-*.ts` **except** the KEEP list (`remote-runtime-memory-limits.ts`, `remote-runtime-client-error.ts`, `remote-runtime-client-error-classification.ts`, `remote-runtime-pty-id.ts` and their tests) — i.e. every `remote-runtime-{abort-orphaned-socket,client,client-capabilities,client-handshake,connect-bound,outbound-admission,prepared-request-admission,request-*,shared-control-*,socket-liveness,subscription-*,transport-error-agreement}*.ts`; `src/shared/remote-pairing-address.ts`, `remote-pairing-address.test.ts`, `remote-pairing-verification.ts`, `remote-pairing-verification.test.ts`, `pairing.ts`, `pairing.test.ts`, `mobile-relay-pairing-offer.ts`, `mobile-relay-pairing-offer.test.ts`, `mobile-relay-pairing-fixtures.ts`, `runtime-environment-store.ts`, `runtime-environment-store.test.ts`, `e2ee-crypto.ts`, `tailnet-address.ts`, `tailnet-address.test.ts`, `reconnect-jitter.ts`, `reconnect-jitter.test.ts`; `config/scripts/{remote-shared-control-retirement-probe.ts,live-remote-freeze-rpc.mjs,live-remote-freeze-rpc.test.mjs,live-remote-bulk-open-freeze-metrics.mjs,live-remote-bulk-open-freeze-metrics.test.mjs,live-remote-bulk-open-freeze-repro.mjs,live-remote-realistic-freeze-repro.mjs,live-remote-status-watchdog.mjs,live-remote-status-watchdog.test.mjs,remote-agent-session-authority-repro.mjs,remote-agent-session-process-cleanup.mjs,remote-agent-session-repro-client.mjs,remote-agent-session-repro-fixture.mjs,remote-agent-session-repro-writable-shell.mjs}`; `src/renderer/src/components/terminal-pane/remote-runtime-outage-toast-flood-and-stuck-reconnect.test.ts` (imports the deleted `remote-runtime-tailscale-hint` and `runtime-rpc-call-queue`); `docs/reference/remote-wire-compatibility.md` (B8 removes the AGENTS.md section; the doc goes here because `pairing.ts` is its subject). **Not deleted:** the `tests/e2e/*remote*.unit.test.ts` oracles (`host-cold-park-remote-subscriber`, `host-guest-paint-retention-remote-viewer`, `remote-terminal-tab-retirement`, `omp-risk-remote-review`, `session-tabs-*`, `structured-session-reopened-tab-close`, `completed-worker-retirement-resume`) and `tests/e2e/helpers/*remote*` — their imports (`web-session-tabs-sync`, `browser-screencast-subscriber-test-harness`, `terminal-hidden-view-parking`, `src/cli/runtime/client` as a type) are kept-inert modules, so they still compile and pass; they are listed in the risks as follow-up cleanup.
- Modify: `package.json:189` (`"tweetnacl": "^1.0.3",`) and `:36,166-167` (`test:repro:remote-agent-session`, `repro:live-remote-bulk-open-freeze`, `repro:live-remote-realistic-freeze`); `config/packaged-runtime-node-modules.cjs:28` (`'tweetnacl',`); `src/shared/runtime-environments.ts:2,62-108,109-…` (`createEnvironmentFromPairingOffer`, `getPreferredPairingOffer`; the `pairingRevision` zod field stays); `src/shared/execution-host-registry.ts` (only if it imports a deleted helper); `tests/e2e/onboarding.spec.ts:16,419-510` (the pairing-offer block, the `runtimeEnvironments.addFromPairingCode` call and the `state.runtimeEnvironments.find` assertions); `config/local-only-allowlist.txt:23-24`; `config/scripts/websocket-server-loopback-bind.test.ts:41` (`RECOGNIZED_CONSTRUCTION_FLOOR = 14` → the recognized count the test prints, expected `13`, after `remote-runtime-shared-control-test-server.ts` is gone); `config/max-lines-baseline.txt` (no change; `remote-runtime-pty-transport.ts` stays inert — leave its row); `config/scripts/ci-shard-timings.json`; `config/reliability-gates.jsonc` (gates listing `src/shared/remote-runtime-*.test.ts`); `docs/reference/local-only-architecture.md:114-115,131` (B8 rewrites the doc; here only delete the `remote-runtime-shared-control-test-server.ts:65` clause in the test-only listeners paragraph and the "Remote-runtime pairing fixtures" allowlist bullet so the prose stays truthful).
- Test: `src/shared` (whole dir), `config/scripts/websocket-server-loopback-bind.test.ts`, `config/scripts/check-local-only.test.mjs`, `src/main/proxy-guarded-fetch-call-site-audit.test.ts`, `src/shared/child-process/child-process-import-boundary.test.ts`, `config/scripts/electron-builder-config.test.mjs`, `config/scripts/packaged-runtime-node-modules*.test.*`, `tests/e2e/onboarding.spec.ts` (typecheck via `pnpm tc:e2e` if present, else `npx tsc -p tests/tsconfig.json --noEmit`).

**Interfaces:**
- Consumes: nothing new.
- Produces: no `ws`-based outbound client in `src/shared` (the `ws` dependency stays for the CDP proxy and emulator); `tweetnacl` gone from `dependencies` and the packaged-runtime list; `src/shared/runtime-environments.ts` exports only the zod schemas, `PublicKnownRuntimeEnvironment`, `redactRuntimeEnvironment`, `isUserManagedRuntimeEnvironment` and its other pure helpers; `config/local-only-allowlist.txt` has no Spec B rows for pairing fixtures.

- [ ] **Step 1: Guard first.** Run `pnpm run check:local-only` and record the count. After this task the `src/shared/mobile-relay-pairing-fixtures.ts:forbidden-host` allowlist row is deleted and the file is gone; the count must not rise.
- [ ] **Step 2: Delete.**
  ```bash
  # `ls` only lists survivors, so the files B5.5 already removed (tailscale-hint, shared-control-types) never reach git rm.
  git rm -q $(ls src/shared/remote-runtime-*.ts | rg -v 'remote-runtime-(memory-limits|client-error|client-error-classification|pty-id)(\.test)?\.ts$')
  git rm -q src/shared/remote-pairing-address.ts src/shared/remote-pairing-address.test.ts \
    src/shared/remote-pairing-verification.ts src/shared/remote-pairing-verification.test.ts \
    src/shared/pairing.ts src/shared/pairing.test.ts src/shared/mobile-relay-pairing-offer.ts \
    src/shared/mobile-relay-pairing-offer.test.ts src/shared/mobile-relay-pairing-fixtures.ts \
    src/shared/runtime-environment-store.ts src/shared/runtime-environment-store.test.ts \
    src/shared/e2ee-crypto.ts src/shared/tailnet-address.ts src/shared/tailnet-address.test.ts \
    src/shared/reconnect-jitter.ts src/shared/reconnect-jitter.test.ts \
    docs/reference/remote-wire-compatibility.md
  git rm -q config/scripts/remote-shared-control-retirement-probe.ts config/scripts/live-remote-*.mjs \
    config/scripts/remote-agent-session-*.mjs \
    src/renderer/src/components/terminal-pane/remote-runtime-outage-toast-flood-and-stuck-reconnect.test.ts
  ```
  Expected after the step: `ls src/shared | rg '^remote-runtime'` lists exactly `remote-runtime-client-error.ts`, `remote-runtime-client-error-classification.ts`, `remote-runtime-client-error-classification.test.ts`, `remote-runtime-memory-limits.ts`, `remote-runtime-memory-limits.test.ts`, `remote-runtime-pty-id.ts`.
- [ ] **Step 3: `runtime-environments.ts` and the fixtures' importers.** Delete line 2, `createEnvironmentFromPairingOffer` (62-108) and `getPreferredPairingOffer` (109 to its closing brace); if `PAIRING_OFFER_VERSION` is used elsewhere in the file, replace that one use with the literal the deleted constant held (read it with `git show HEAD:src/shared/pairing.ts` before deleting). Any survivor that still imports a deleted module (`rg -n "shared/(pairing|remote-pairing-address|remote-pairing-verification|runtime-environment-store|e2ee-crypto|tailnet-address|reconnect-jitter|remote-runtime-(client|request|shared-control|subscription|socket-liveness|connect-bound|outbound-admission|prepared-request-admission|client-capabilities|client-handshake|abort-orphaned-socket|transport-error-agreement))" src tests config --glob '!tests/e2e/.cross-version-checkouts/**'`) is a B5.1–B5.5 miss: delete that importer's dead branch now and note it in the commit body. Expected: the command prints nothing.
- [ ] **Step 4: Dependencies and packaging.** `package.json`: delete line 189 (`"tweetnacl"`) and the three repro scripts (36, 166-167). `config/packaged-runtime-node-modules.cjs`: delete line 28 (`'tweetnacl',`). Run `pnpm install --lockfile-only` (or `npx -y pnpm@12.0.0 install --lockfile-only`) so `pnpm-lock.yaml` drops `tweetnacl`; `rg -n tweetnacl package.json pnpm-lock.yaml config src` → no hits. B0 owns the guard rule for `tweetnacl`; B5.6 only confirms `pnpm run check:local-only` stays clean.
- [ ] **Step 5: e2e and ratchets.** `tests/e2e/onboarding.spec.ts`: delete line 16 and the block from `const pairingCode = encodePairingOffer({` (421) through the end of the `page.evaluate(..., pairingCode)` call (482) and the `state.runtimeEnvironments.find` assertions (~501-510); keep the rest of the onboarding flow. `config/local-only-allowlist.txt`: delete lines 23-24. `config/scripts/websocket-server-loopback-bind.test.ts`: run `pnpm test config/scripts/websocket-server-loopback-bind.test.ts`; if it fails only on the floor, set `RECOGNIZED_CONSTRUCTION_FLOOR` to the recognized count it prints (expected 13) — never touch `WILDCARD_BIND_PIN`. Run `pnpm test src/main/proxy-guarded-fetch-call-site-audit.test.ts src/shared/child-process/child-process-import-boundary.test.ts` (expected: pass unchanged — no deleted file was a `.fetch(` receiver or a direct `child_process` importer). `pnpm run check:reliability-gates` → remove deleted `src/shared/remote-runtime-*.test.ts` rows from any gate's `testFiles`/`commands` (U6.1 treatment, keep the gate). Prune `ci-shard-timings.json`. `docs/reference/local-only-architecture.md`: delete the `remote-runtime-shared-control-test-server.ts:65` clause (~114-115) and the "Remote-runtime pairing fixtures" bullet (~131); B8 does the rest.
- [ ] **Step 6: Verify.** `pnpm tc`; `pnpm test src/shared config/scripts/websocket-server-loopback-bind.test.ts config/scripts/check-local-only.test.mjs config/scripts/electron-builder-config.test.mjs src/main/proxy-guarded-fetch-call-site-audit.test.ts src/shared/child-process/child-process-import-boundary.test.ts`; `pnpm run check:code-quality:changed`; `pnpm run check:local-only` (count ≤ Step 1 count, and no `mobile-relay-pairing-fixtures` row); `pnpm run check:max-lines-ratchet`; `rg -n "orca://pair|encodePairingOffer|PairingOffer\b" src tests config docs --glob '!tests/e2e/.cross-version-checkouts/**' --glob '!docs/local-only/**'` → no hits; `rg -n "new WebSocket\(|from 'ws'" src --glob '!*.test.*'` → only `src/main/browser/cdp-*`, the emulator and any fixture paths the architecture doc already lists.
- [ ] **Step 7: Commit.**
  ```
  refactor(local-only): remove the shared remote-runtime client stack, pairing codec and E2EE

  Delete the outbound WebSocket client, shared-control and subscription
  transports, the orca://pair codec and fixtures, the on-disk environment
  store, E2EE and the tweetnacl dependency, plus the remote probes and the
  remote-wire compatibility doc that only described them.

  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01PskLbdTqJNXxJ7KRnDoDoD
  ```
---

## Planner group: b7-b8

## Unit B7 — Hydration: explicit strip of ssh/runtime state at profile load

Planner notes (verified against code on `local-only/spec-b` at 57f87b013d; inventory line numbers were stale in places and are corrected below):

- The load pipeline is `src/main/persistence/loading-store/loaded-state-parsing.ts` `loadInternal()` (JSON string via `loadSerialized`/`loadFromAuthority`, or a pre-parsed SQLite snapshot via `loadParsedFromAuthority`) → `normalizeLoadedProfileState` (`...defaults, ...parsed` spread) → `mergeProjectHostSetupCompatibilityState` → `migrateAutomationOwners` → `backfillFolderScopeConnectionIds` → `normalizeWorktreeLinkedItemMetadata` → `gcStaleWorktreeMeta` → `Store` constructor runs `sweepDeregisteredRepoResidue()` (`store.ts:118`), which **retains** `runtime:` owners instead of sweeping them (`deregistered-repo-residue.ts:13-58`). The strip therefore has to run before all of those, i.e. where the recoveries-decrypt block sits today (`loaded-state-parsing.ts:155-179`).
- Unknown top-level keys round-trip on purpose (`profile-state-cutover-fixture.test.ts` asserts `futureTopLevelExtension` survives), so the six SSH keys must be `delete`d from the parsed object, not merely overwritten; otherwise legacy rows persist forever as "future keys".
- `scheduleSave()` with no domains (what `loadNeedsSave` triggers at `store.ts:143-150`) sets `dirtyProfileStateDomains = null`, i.e. a complete write, and `buildCompleteDocumentReplacements` (`profile-state-complete-replacements.ts`) emits `payload: null` for every SQLite domain row absent from the new document. That is how legacy `sshTargets`/`removedSshTargetTombstones` rows leave the database.
- Seam decision: the six keys stay in `PersistedState` and in `getDefaultPersistedState` as inert `[]`/`0` (Spec A "dead keys stay" convention). Removing them from the type would force rewrites in ~15 shared non-SSH files (`automation-owner-migration.ts`, `automation-owner-projection.ts`, `workspace-pane-normalization.ts`, `workspace-session-snapshot-publication.ts`, `missing-local-worktree-metadata-pruning.ts`, `terminal-binding-recovery.ts`, three `orca-profiles/*` files, three `cli/*` files, `host-context-labels.ts`). The strip zeroes them; defaults re-supply the empty values on the spread.
- `ExecutionHostKind`/`ExecutionHostId` are not narrowed. The strip tests the raw prefix `/^(?:ssh|runtime):/` in addition to `getRepoExecutionHostId`, so a malformed `executionHostId: 'ssh:'` (which `parseExecutionHostId` rejects → falls back to local today) strips instead of becoming local (invariant I4).
- `leasing-ssh-ptys/secret-validation.ts` holds two OpenCode validators that `loaded-state-parsing.ts:109-121` still needs. B7 keeps importing them from there and only drops `isLegacySshPtyOwnerLease`; B6 must keep that file (or delete only its SSH function).

### Task B7.1: Strip module for remote-host state, TDD

**Files:**
- Create `src/main/persistence/loading-store/remote-execution-host-strip.ts`
- Create `src/main/persistence/loading-store/remote-execution-host-strip.test.ts`
- Test: the new test file only

**Interfaces:**
- Consumes: `getRepoExecutionHostId`, `LOCAL_EXECUTION_HOST_ID` (`src/shared/execution-host.ts`); `getRepoIdFromWorktreeId` (`src/shared/worktree/id.ts:25`); `getWorktreeIdFromHostIdentity` (`src/shared/worktree/host-qualified-identity.ts:66`); `worktreeWorkspaceKey` (`src/shared/workspace-scope.ts:7`); `PersistedState`. Imports nothing from `src/main/ssh/**` or `src/main/persistence/leasing-ssh-ptys/**`, so it is order-independent of B6.
- Produces: `stripRemoteExecutionHostState(parsed): RemoteExecutionHostStripResult`, `isRemoteExecutionHostRow(row)`, `isRemoteHostId(value)`, `STRIPPED_REMOTE_STATE_KEYS`.

- [ ] **Step 1: Write the failing unit test** at `src/main/persistence/loading-store/remote-execution-host-strip.test.ts`:
  ```ts
  import { describe, expect, it } from 'vitest'
  import { getDefaultPersistedState } from '../../../shared/constants'
  import type { PersistedState } from '../../../shared/persisted-state-types'
  import type { Repo } from '../../../shared/repo-types'
  import {
    isRemoteExecutionHostRow,
    STRIPPED_REMOTE_STATE_KEYS,
    stripRemoteExecutionHostState
  } from './remote-execution-host-strip'

  const LOCAL_WT = 'repo-local::/w/local'
  const SSH_WT = 'repo-ssh::/w/ssh'
  const RUNTIME_WT = 'repo-runtime::/w/runtime'

  function repo(overrides: Partial<Repo>): Repo {
    return { id: 'repo-local', path: '/w/local', displayName: 'r', badgeColor: '#737373', addedAt: 1, ...overrides }
  }

  function legacyProfile(): PersistedState {
    const state = getDefaultPersistedState('/home/test')
    state.repos = [
      repo({}),
      repo({ id: 'repo-ssh', path: '/w/ssh', connectionId: 'build-host' }),
      repo({ id: 'repo-ssh-host-only', path: '/w/ssh2', executionHostId: 'ssh:build-host' }),
      repo({ id: 'repo-runtime', path: '/w/runtime', executionHostId: 'runtime:env-1' }),
      repo({ id: 'repo-malformed', path: '/w/bad', executionHostId: 'ssh:' as never })
    ]
    state.projectHostSetups = [
      { id: 'repo-local', projectId: 'p', hostId: 'local', repoId: 'repo-local', path: '/w/local', displayName: 'l', setupState: 'ready', setupMethod: 'imported-existing-folder', createdAt: 1, updatedAt: 1 },
      { id: 'setup-ssh', projectId: 'p', hostId: 'ssh:build-host', repoId: 'repo-ssh', path: '/w/ssh', displayName: 's', setupState: 'ready', setupMethod: 'imported-existing-folder', createdAt: 1, updatedAt: 1 }
    ]
    state.projectGroups = [
      { id: 'group-local', name: 'g', createdFrom: 'manual', parentPath: '/f/local', createdAt: 1 } as never,
      { id: 'group-ssh', name: 'g', createdFrom: 'manual', parentPath: '/f/ssh', connectionId: 'build-host', createdAt: 1 } as never
    ]
    state.folderWorkspaces = [
      { id: 'fw-local', projectGroupId: 'group-local', name: 'a', folderPath: '/f/local', createdAt: 1 } as never,
      { id: 'fw-runtime', projectGroupId: 'group-local', name: 'b', folderPath: '/f/b', executionHostId: 'runtime:env-1', createdAt: 1 } as never
    ]
    state.worktreeMeta = {
      [LOCAL_WT]: { hostId: 'local', lastActivityAt: 1, createdAt: 1 } as never,
      [SSH_WT]: { lastActivityAt: 1, createdAt: 1 } as never, // legacy row: no hostId, owned by a stripped repo
      [RUNTIME_WT]: { hostId: 'runtime:env-1', lastActivityAt: 1, createdAt: 1 } as never,
      'global-floating-terminal': { lastActivityAt: 1, createdAt: 1 } as never
    }
    state.worktreeLineageById = { [SSH_WT]: { parentWorktreeId: LOCAL_WT } as never }
    state.workspaceLineageByChildKey = { [`worktree:${SSH_WT}`]: { parentWorkspaceKey: `worktree:${LOCAL_WT}` } as never }
    state.worktreeMetaByIdentity = {
      'wt2:local:instance-local': { hostId: 'local' } as never,
      'wt2:ssh%3Abuild-host:instance-ssh': { hostId: 'ssh:build-host' } as never,
      'wt2:runtime%3Aenv-1:instance-rt': { hostId: 'runtime:env-1' } as never
    }
    state.worktreeIdentityAliases = {
      [`local|${LOCAL_WT}`]: ['wt2:local:instance-local', 'wt2:ssh%3Abuild-host:instance-ssh'],
      [`ssh:build-host|${SSH_WT}`]: ['wt2:ssh%3Abuild-host:instance-ssh'],
      [`|${SSH_WT}`]: ['wt2:local:instance-local']
    }
    state.workspaceSessionsByHostId = { 'ssh:build-host': state.workspaceSession, 'runtime:env-1': state.workspaceSession }
    state.retiredWorktreeNamesByNamespace = { 'local:/w': {} as never, 'ssh:user@host:22:/w': {} as never, 'ssh:?:/w': {} as never, 'runtime:env-1:/w': {} as never }
    state.retiredWorktreeNamesByRepo = { 'repo-local': {} as never, 'repo-ssh': {} as never }
    state.sparsePresetsByRepo = { 'repo-local': [], 'repo-ssh': [] }
    state.sshTargets = [{ id: 'build-host', label: 'b', host: 'b.test', port: 22, username: 'u', source: 'manual', generation: 3 }]
    state.sshTargetGenerationCounter = 3
    state.deletedSshConfigAliases = ['old']
    state.removedSshTargetTombstones = [{ id: 'gone' } as never]
    state.sshRemotePtyLeases = [{ id: 'lease-1', targetId: 'build-host', worktreeId: SSH_WT, state: 'attached' } as never]
    state.sshPtyConsumerRecoveries = [{ targetId: 'build-host', ownerLease: 'sealed', clientInstanceId: 'c' } as never]
    return state
  }

  describe('stripRemoteExecutionHostState', () => {
    it('is a no-op on a default profile', () => {
      const state = getDefaultPersistedState('/home/test')
      expect(stripRemoteExecutionHostState(state)).toEqual({ changed: false, strippedRepoIds: [], legacyRecoveryTargetIds: [] })
      expect(state.sshTargets).toEqual([])
    })

    it('drops every repo that names an ssh/runtime host, including a malformed id, and keeps local rows', () => {
      const state = legacyProfile()
      const result = stripRemoteExecutionHostState(state)
      expect(result.changed).toBe(true)
      expect(state.repos.map((r) => r.id)).toEqual(['repo-local'])
      expect(result.strippedRepoIds.sort()).toEqual(['repo-malformed', 'repo-runtime', 'repo-ssh', 'repo-ssh-host-only'])
      expect(state.projectHostSetups.map((s) => s.id)).toEqual(['repo-local'])
      expect(state.projectGroups.map((g) => g.id)).toEqual(['group-local'])
      expect(state.folderWorkspaces.map((f) => f.id)).toEqual(['fw-local'])
    })

    it('deletes the six SSH keys so the defaults spread re-supplies empty values', () => {
      const state = legacyProfile()
      stripRemoteExecutionHostState(state)
      for (const key of STRIPPED_REMOTE_STATE_KEYS) {
        expect(Object.hasOwn(state, key)).toBe(false)
      }
    })

    it('returns legacy recovery target ids for keychain cleanup', () => {
      expect(stripRemoteExecutionHostState(legacyProfile()).legacyRecoveryTargetIds).toEqual(['build-host'])
    })

    it('removes worktree metadata owned by stripped repos or remote hosts, with lineage companions and identity rows', () => {
      const state = legacyProfile()
      stripRemoteExecutionHostState(state)
      expect(Object.keys(state.worktreeMeta).sort()).toEqual(['global-floating-terminal', LOCAL_WT].sort())
      expect(state.worktreeLineageById).toEqual({})
      expect(state.workspaceLineageByChildKey).toEqual({})
      expect(Object.keys(state.worktreeMetaByIdentity ?? {})).toEqual(['wt2:local:instance-local'])
      expect(state.worktreeIdentityAliases).toEqual({ [`local|${LOCAL_WT}`]: ['wt2:local:instance-local'] })
    })

    it('empties every non-local session partition and remote retirement namespaces', () => {
      const state = legacyProfile()
      stripRemoteExecutionHostState(state)
      expect(state.workspaceSessionsByHostId).toEqual({})
      expect(Object.keys(state.retiredWorktreeNamesByNamespace ?? {})).toEqual(['local:/w'])
      expect(Object.keys(state.retiredWorktreeNamesByRepo ?? {})).toEqual(['repo-local'])
      expect(Object.keys(state.sparsePresetsByRepo)).toEqual(['repo-local'])
    })

    it('is idempotent', () => {
      const state = legacyProfile()
      stripRemoteExecutionHostState(state)
      expect(stripRemoteExecutionHostState(state).changed).toBe(false)
    })

    it('does not report a change for a profile that only carries the empty inert keys', () => {
      const state = getDefaultPersistedState('/home/test')
      state.removedSshTargetTombstones = undefined
      expect(stripRemoteExecutionHostState(state).changed).toBe(false)
    })
  })

  describe('isRemoteExecutionHostRow', () => {
    it('never reads a remote spelling as local', () => {
      expect(isRemoteExecutionHostRow({ connectionId: 'x' })).toBe(true)
      expect(isRemoteExecutionHostRow({ executionHostId: 'ssh:x' })).toBe(true)
      expect(isRemoteExecutionHostRow({ executionHostId: 'runtime:x' })).toBe(true)
      expect(isRemoteExecutionHostRow({ executionHostId: ' ssh: ' })).toBe(true)
      expect(isRemoteExecutionHostRow({ connectionId: null, executionHostId: 'local' })).toBe(false)
      expect(isRemoteExecutionHostRow({})).toBe(false)
    })
  })
  ```
  Run: `pnpm test src/main/persistence/loading-store/remote-execution-host-strip.test.ts` — expected: fails with "Cannot find module './remote-execution-host-strip'".
- [ ] **Step 2: Write the module** `src/main/persistence/loading-store/remote-execution-host-strip.ts`:
  ```ts
  import { getRepoExecutionHostId, LOCAL_EXECUTION_HOST_ID } from '../../../shared/execution-host'
  import type { PersistedState } from '../../../shared/persisted-state-types'
  import { getWorktreeIdFromHostIdentity } from '../../../shared/worktree/host-qualified-identity'
  import { getRepoIdFromWorktreeId } from '../../../shared/worktree/id'
  import { worktreeWorkspaceKey } from '../../../shared/workspace-scope'

  // A prefix test, not a parse: an id the parser rejects must strip, never fall back to local (I4).
  const REMOTE_HOST_ID_PREFIX = /^(?:ssh|runtime):/

  export const STRIPPED_REMOTE_STATE_KEYS = [
    'sshTargets',
    'sshTargetGenerationCounter',
    'deletedSshConfigAliases',
    'removedSshTargetTombstones',
    'sshRemotePtyLeases',
    'sshPtyConsumerRecoveries'
  ] as const

  type StrippedRemoteStateKey = (typeof STRIPPED_REMOTE_STATE_KEYS)[number]

  // What the defaults spread puts back; a legacy value equal to it is not a change worth a rewrite.
  const STRIPPED_KEY_DEFAULTS: Record<StrippedRemoteStateKey, unknown> = {
    sshTargets: [],
    sshTargetGenerationCounter: 0,
    deletedSshConfigAliases: [],
    removedSshTargetTombstones: undefined,
    sshRemotePtyLeases: [],
    sshPtyConsumerRecoveries: []
  }

  export type RemoteExecutionHostStripResult = {
    changed: boolean
    strippedRepoIds: string[]
    /** targetIds of legacy consumer-recovery records; the caller drops their keychain blobs. */
    legacyRecoveryTargetIds: string[]
  }

  export function isRemoteHostId(value: unknown): boolean {
    return typeof value === 'string' && REMOTE_HOST_ID_PREFIX.test(value.trim())
  }

  export function isRemoteExecutionHostRow(row: {
    connectionId?: string | null
    executionHostId?: string | null
  }): boolean {
    if (typeof row.connectionId === 'string' && row.connectionId.trim().length > 0) {
      return true
    }
    if (isRemoteHostId(row.executionHostId)) {
      return true
    }
    return getRepoExecutionHostId(row) !== LOCAL_EXECUTION_HOST_ID
  }

  function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
  }

  function differsFromDefault(key: StrippedRemoteStateKey, value: unknown): boolean {
    const fallback = STRIPPED_KEY_DEFAULTS[key]
    if (fallback === undefined) {
      return value !== undefined
    }
    if (Array.isArray(fallback)) {
      return !Array.isArray(value) || value.length > 0
    }
    return value !== fallback
  }

  // canonicalWorktreeIdentity: `wt2:${encodeURIComponent(hostId)}:${encodeURIComponent(instanceId)}`
  function identityKeyHostIsRemote(identityKey: string): boolean {
    if (!identityKey.startsWith('wt2:')) {
      return false
    }
    const end = identityKey.indexOf(':', 4)
    const encodedHost = identityKey.slice(4, end === -1 ? undefined : end)
    try {
      return isRemoteHostId(decodeURIComponent(encodedHost))
    } catch {
      return false
    }
  }

  // composeWorktreeHostIdentity: `${hostId ?? ''}|${worktreeId}`
  function aliasHostIsRemote(alias: string): boolean {
    const separator = alias.indexOf('|')
    return separator > 0 && isRemoteHostId(alias.slice(0, separator))
  }

  function filterRemoteRows<T extends { connectionId?: string | null; executionHostId?: string | null }>(
    rows: readonly T[] | undefined,
    onStripped?: (row: T) => void
  ): { rows: T[]; changed: boolean } {
    if (!Array.isArray(rows)) {
      return { rows: [], changed: false }
    }
    const kept = rows.filter((row) => {
      if (!row || typeof row !== 'object' || !isRemoteExecutionHostRow(row)) {
        return true
      }
      onStripped?.(row)
      return false
    })
    return { rows: kept, changed: kept.length !== rows.length }
  }

  /**
   * Drops every persisted row that names an `ssh:`/`runtime:` execution host, before any
   * normalizer, migration or GC can read it. Nothing is migrated to local: a remote checkout path
   * probed on this machine is a different (or missing) directory, and a remote PTY lease cannot be
   * reattached here. Legacy profiles from an upstream build hydrate to a local-only state in one
   * load; `changed` asks for a save so the rows also leave the SQLite document set.
   */
  export function stripRemoteExecutionHostState(parsed: PersistedState): RemoteExecutionHostStripResult {
    let changed = false
    const legacyRecoveryTargetIds: string[] = []

    for (const key of STRIPPED_REMOTE_STATE_KEYS) {
      if (!Object.hasOwn(parsed, key)) {
        continue
      }
      const value: unknown = Reflect.get(parsed, key)
      if (key === 'sshPtyConsumerRecoveries' && Array.isArray(value)) {
        for (const record of value) {
          if (isRecord(record) && typeof record.targetId === 'string' && record.targetId.length > 0) {
            legacyRecoveryTargetIds.push(record.targetId)
          }
        }
      }
      if (differsFromDefault(key, value)) {
        changed = true
      }
      Reflect.deleteProperty(parsed, key)
    }

    const strippedRepoIds = new Set<string>()
    const repos = filterRemoteRows(parsed.repos, (repo) => {
      if (typeof repo.id === 'string') {
        strippedRepoIds.add(repo.id)
      }
    })
    if (repos.changed) {
      parsed.repos = repos.rows
      changed = true
    }
    const projectGroups = filterRemoteRows(parsed.projectGroups)
    if (projectGroups.changed) {
      parsed.projectGroups = projectGroups.rows
      changed = true
    }
    const folderWorkspaces = filterRemoteRows(parsed.folderWorkspaces)
    if (folderWorkspaces.changed) {
      parsed.folderWorkspaces = folderWorkspaces.rows
      changed = true
    }
    if (Array.isArray(parsed.projectHostSetups)) {
      const setups = parsed.projectHostSetups.filter(
        (setup) => !setup || typeof setup !== 'object' || (!isRemoteHostId(setup.hostId) && !isRemoteExecutionHostRow(setup))
      )
      if (setups.length !== parsed.projectHostSetups.length) {
        parsed.projectHostSetups = setups
        changed = true
      }
    }

    if (isRecord(parsed.worktreeMeta)) {
      for (const [key, meta] of Object.entries(parsed.worktreeMeta)) {
        const ownedByStrippedRepo = strippedRepoIds.has(getRepoIdFromWorktreeId(key))
        const onRemoteHost = isRecord(meta) && isRemoteHostId(meta.hostId)
        if (!ownedByStrippedRepo && !onRemoteHost) {
          continue
        }
        delete parsed.worktreeMeta[key]
        if (isRecord(parsed.worktreeLineageById)) {
          delete parsed.worktreeLineageById[key]
        }
        if (isRecord(parsed.workspaceLineageByChildKey)) {
          delete parsed.workspaceLineageByChildKey[worktreeWorkspaceKey(key)]
        }
        changed = true
      }
    }
    if (isRecord(parsed.worktreeMetaByIdentity)) {
      for (const identityKey of Object.keys(parsed.worktreeMetaByIdentity)) {
        if (identityKeyHostIsRemote(identityKey)) {
          delete parsed.worktreeMetaByIdentity[identityKey]
          changed = true
        }
      }
    }
    if (isRecord(parsed.worktreeIdentityAliases)) {
      for (const [alias, identityKeys] of Object.entries(parsed.worktreeIdentityAliases)) {
        const ownerRepoId = getRepoIdFromWorktreeId(getWorktreeIdFromHostIdentity(alias))
        if (aliasHostIsRemote(alias) || strippedRepoIds.has(ownerRepoId)) {
          delete parsed.worktreeIdentityAliases[alias]
          changed = true
          continue
        }
        if (!Array.isArray(identityKeys)) {
          continue
        }
        const kept = identityKeys.filter((key) => typeof key !== 'string' || !identityKeyHostIsRemote(key))
        if (kept.length !== identityKeys.length) {
          parsed.worktreeIdentityAliases[alias] = kept
          changed = true
        }
      }
    }

    // Every non-local partition is a remote host by definition; 'local' lives in workspaceSession.
    if (isRecord(parsed.workspaceSessionsByHostId) && Object.keys(parsed.workspaceSessionsByHostId).length > 0) {
      parsed.workspaceSessionsByHostId = {}
      changed = true
    }

    if (isRecord(parsed.retiredWorktreeNamesByNamespace)) {
      for (const namespaceKey of Object.keys(parsed.retiredWorktreeNamesByNamespace)) {
        if (isRemoteHostId(namespaceKey)) {
          delete parsed.retiredWorktreeNamesByNamespace[namespaceKey]
          changed = true
        }
      }
    }
    for (const repoId of strippedRepoIds) {
      if (isRecord(parsed.retiredWorktreeNamesByRepo) && Object.hasOwn(parsed.retiredWorktreeNamesByRepo, repoId)) {
        delete parsed.retiredWorktreeNamesByRepo[repoId]
        changed = true
      }
      if (isRecord(parsed.sparsePresetsByRepo) && Object.hasOwn(parsed.sparsePresetsByRepo, repoId)) {
        delete parsed.sparsePresetsByRepo[repoId]
        changed = true
      }
    }

    return { changed, strippedRepoIds: [...strippedRepoIds], legacyRecoveryTargetIds }
  }
  ```
  If `pnpm tc` rejects `delete parsed.worktreeMeta[key]` because the narrowed type is an intersection, replace that line with `Reflect.deleteProperty(parsed.worktreeMeta, key)` (same for the other map deletes); no casts.
- [ ] **Step 3: Run the test green.** `pnpm test src/main/persistence/loading-store/remote-execution-host-strip.test.ts` — expected: 9 passing. Then `pnpm tc` (expected: clean) and `pnpm run check:code-quality:changed` (expected: clean; the file is under 400 lines and uses no casts).
- [ ] **Step 4: Commit.**
  ```
  git add src/main/persistence/loading-store/remote-execution-host-strip.ts src/main/persistence/loading-store/remote-execution-host-strip.test.ts
  git commit -m "feat(local-only): add explicit strip of ssh/runtime persisted state

  Rows that name an ssh:/runtime: execution host, or a connectionId, are dropped
  before any normalizer, migration or GC reads them. Nothing migrates to local.

  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01PskLbdTqJNXxJ7KRnDoDoD"
  ```

### Task B7.2: Wire the strip into profile load, delete the ssh normalizer and serializer lines, prove a clean local-only load of legacy JSON and SQLite profiles

**Files:**
- Modify `src/main/persistence/loading-store/loaded-state-parsing.ts:5, 16-20, 28-31, 155-179` (delete lines; one 7-line insertion at 155)
- Modify `src/main/persistence/loading-store/normalize-loaded-profile-state.ts:2, 7-10, 90-93, 98-101` (delete lines)
- Modify `src/main/persistence/loading-store/state-serialization-secret-handling.ts:11, 109-111, 206-213` (delete lines)
- Modify tests: `src/main/persistence/profile-state-cutover-fixture.test.ts:78-85, 93, 115, 147`; `src/main/persistence/profile-state-cutover-soak.test.ts:132-159, 198-203, 213-218, 239-243, 248-253, 348`; `src/main/persistence/loading-store/profile-state-sqlite-authority.test.ts:438-475`; `src/main/persistence/loading-store/state-write-round-trip.test.ts:80, 118-122`; `src/main/persistence/loading-store/profile-state-checkpoints.test.ts:66, 72`; `src/main/persistence/loading-store/worktree-meta-alias-projection.test.ts:110-116, 167, 171, 254, 301, 357-359`
- Create `src/main/persistence/loading-store/legacy-remote-profile-load.test.ts`
- Test: the files above plus `src/main/persistence/loading-store/remote-execution-host-strip.test.ts`

**Interfaces:**
- Consumes: `stripRemoteExecutionHostState` (B7.1); `sshPtyOwnerLeaseSecretSlot` and `ProtectedSecretPersistence.removeRetainedBlob` (`src/main/protected-secret-persistence.ts:10,45` — B6 must keep both); `isLegacyOpenCodeGoApiKey`/`isLegacyOpenCodeSessionCookie` (`leasing-ssh-ptys/secret-validation.ts:1-14` — B6 must keep the file or move those two functions); test harness `createSqliteTestStore`, `readPersistedStateJson` (`src/main/persistence-test-harness.ts`), `buildProfileStateCutoverFixture`, `openProfileStateDatabase`/`profileStateDatabaseFile` (`src/main/persistence/profile-state/profile-state-database.ts`).
- Produces: `loadInternal()` strips before `prepareLoadedTerminalSettings`; `loadNeedsSave` set when anything was stripped; no selective `sshRemotePtyLeases` domain, no recovery-lease sealing in `buildStateToSave`.

- [ ] **Step 1: Write the failing end-to-end test** `src/main/persistence/loading-store/legacy-remote-profile-load.test.ts` (same harness shape as `state-write-round-trip.test.ts:1-50`; if `src/main/ssh/ssh-config-parser.ts` still exists when this runs, add the same `vi.mock('../../ssh/ssh-config-parser', …)` block the sibling tests carry — B6 deletes it together with theirs):
  ```ts
  import { existsSync, mkdtempSync, realpathSync, writeFileSync } from 'node:fs'
  import { tmpdir } from 'node:os'
  import { dirname, join } from 'node:path'
  import { afterEach, describe, expect, it, vi } from 'vitest'
  import { buildProfileStateCutoverFixture } from '../profile-state-cutover-fixture'
  import { openProfileStateDatabase, profileStateDatabaseFile } from '../profile-state/profile-state-database'
  import { sshPtyOwnerLeaseSecretSlot, ProtectedSecretPersistence } from '../../protected-secret-persistence'
  import { closeTestStores, createSqliteTestStore, readPersistedStateJson } from '../../persistence-test-harness'

  vi.mock('node:fs', async (importOriginal) => {
    const actual = await importOriginal<typeof import('node:fs')>()
    return { ...actual, existsSync: vi.fn(actual.existsSync) }
  })
  vi.mock('electron', () => ({
    app: { getPath: () => tmpdir(), getName: () => 'orca-test', getVersion: () => '0.0.0-test', isPackaged: false, on: () => {}, whenReady: () => Promise.resolve() },
    safeStorage: { isEncryptionAvailable: () => true, encryptString: (value: string) => Buffer.from(`enc:${value}`), decryptString: (value: Buffer) => value.toString().slice(4) },
    ipcMain: { on: () => {}, handle: () => {} },
    BrowserWindow: { getAllWindows: () => [] }
  }))

  const { Store } = await import('./store')
  const stores: InstanceType<typeof Store>[] = []
  afterEach(async () => {
    for (const store of stores.splice(0)) store.freezeWrites()
    await closeTestStores()
    vi.restoreAllMocks()
  })

  function legacyProfileJson(directory: string): string {
    const fixture = buildProfileStateCutoverFixture(directory)
    return JSON.stringify({
      ...fixture,
      sshTargetGenerationCounter: 7,
      deletedSshConfigAliases: ['old-alias'],
      removedSshTargetTombstones: [{ id: 'gone-host' }],
      sshRemotePtyLeases: [{ id: 'lease-1', targetId: 'build-host', worktreeId: 'repo-remote::/fixture/remote', state: 'attached' }],
      sshPtyConsumerRecoveries: [{ targetId: 'build-host', ownerLease: 'sealed-lease', clientInstanceId: 'client-1' }]
    })
  }

  function openStore(dataFile: string): InstanceType<typeof Store> {
    const store = createSqliteTestStore(Store, { dataFile })
    stores.push(store)
    return store
  }

  describe('legacy profile with ssh/runtime rows', () => {
    it('hydrates to a local-only state in one load, probes no remote path, and persists the strip', () => {
      const dataFile = join(realpathSync(mkdtempSync(join(tmpdir(), 'orca-legacy-remote-'))), 'orca-data.json')
      writeFileSync(dataFile, legacyProfileJson(dirname(dataFile)), 'utf-8')
      const purge = vi.spyOn(ProtectedSecretPersistence.prototype, 'removeRetainedBlob')

      const store = openStore(dataFile)
      expect(store.getRepos().map((repo) => repo.id)).toEqual(['repo-local'])
      expect(store.getProjects().map((project) => project.id)).toEqual(['repo:repo-local'])
      expect(store.getProjectHostSetups().map((setup) => setup.id)).toEqual(['repo-local'])
      expect(store.getWorktreeMeta('repo-local::/fixture/local')).toMatchObject({ comment: 'Preserve this comment' })
      expect(store.getWorktreeMeta('repo-remote::/fixture/remote')).toBeUndefined()
      expect(store.getWorkspaceSession().activeTabId).toBe('tab-local')
      expect(store.getWorkspaceSession('ssh:build-host').activeTabId).toBeNull()
      expect(store.getWorkspaceSessionHostIds()).toEqual(['local'])
      expect(purge).toHaveBeenCalledWith(sshPtyOwnerLeaseSecretSlot('build-host'))
      expect(vi.mocked(existsSync).mock.calls.map(([path]) => String(path))).not.toContain('/fixture/remote')

      store.flush()
      const onDisk = JSON.parse(readPersistedStateJson(dataFile))
      expect(onDisk.repos.map((repo: { id: string }) => repo.id)).toEqual(['repo-local'])
      expect(onDisk.sshTargets).toEqual([])
      expect(onDisk.sshRemotePtyLeases).toEqual([])
      expect(onDisk.sshPtyConsumerRecoveries).toEqual([])
      expect(onDisk.deletedSshConfigAliases).toEqual([])
      expect(onDisk.sshTargetGenerationCounter).toBe(0)
      expect(onDisk).not.toHaveProperty('removedSshTargetTombstones')
      expect(onDisk.workspaceSessionsByHostId).toEqual({})
      expect(onDisk).not.toHaveProperty(['worktreeMeta', 'repo-remote::/fixture/remote'])
      expect(onDisk).toHaveProperty('futureTopLevelExtension')

      const opened = openProfileStateDatabase(profileStateDatabaseFile(dirname(dataFile)), 'persistence-test')
      try {
        const domains = opened.db.prepare('SELECT domain, payload FROM profile_state_documents').all() as { domain: string; payload: string }[]
        const byDomain = new Map(domains.map((row) => [row.domain, row.payload]))
        expect(byDomain.has('removedSshTargetTombstones')).toBe(false)
        expect(byDomain.get('sshTargets')).toBe('[]')
        expect(byDomain.get('sshRemotePtyLeases')).toBe('[]')
      } finally {
        opened.db.close()
      }

      const reloaded = openStore(dataFile)
      expect(reloaded.getRepos().map((repo) => repo.id)).toEqual(['repo-local'])
      reloaded.flush()
      const bytes = readPersistedStateJson(dataFile)
      const again = openStore(dataFile)
      again.flush()
      expect(readPersistedStateJson(dataFile)).toBe(bytes)
    })
  })
  ```
  Verify before running: `rg -n "readSerializedState|writeSerializedState" src/main/persistence-test-harness.ts:30-52` shows the harness seeds the SQLite authority from the JSON file when no database exists, so the first `openStore` is a SQLite load of legacy domain rows (`loadParsedFromAuthority` path). If `profile_state_documents` stores the payload column under a different name, adjust the `SELECT` after reading `src/main/persistence/profile-state/profile-state-database-schema.ts`. Run `pnpm test src/main/persistence/loading-store/legacy-remote-profile-load.test.ts` — expected: fails (`repo-remote` still present, `ssh:build-host` session still `tab-remote`).
- [ ] **Step 2: Wire the strip in `loaded-state-parsing.ts`.** Delete lines 155-179 (the `parsed.sshPtyConsumerRecoveries = …` block) and insert at that position:
  ```ts
        const strip = stripRemoteExecutionHostState(parsed)
        for (const targetId of strip.legacyRecoveryTargetIds) {
          this.runtime.protectedSecrets.removeRetainedBlob(sshPtyOwnerLeaseSecretSlot(targetId))
        }
        if (strip.changed) {
          this.runtime.loadNeedsSave = true
        }
  ```
  Import edits in the same file: delete line 5 (`import type { SshPtyConsumerRecovery } …`); in lines 16-20 delete only the `isLegacySshPtyOwnerLease` member (keep `isLegacyOpenCodeGoApiKey`, `isLegacyOpenCodeSessionCookie` from `../leasing-ssh-ptys/secret-validation`); delete lines 28-31 (`ENCRYPTED_SSH_PTY_OWNER_LEASE_MAX_LENGTH, normalizeSshPtyConsumerRecovery` import); add `import { stripRemoteExecutionHostState } from './remote-execution-host-strip'` next to the `./normalize-loaded-profile-state` import. Keep lines 12-15 (`PROTECTED_SECRET_SLOT`, `sshPtyOwnerLeaseSecretSlot`). Leave lines 234-251 (`migrateAutomationOwners`) untouched: after the strip `result.sshTargets` is `[]` and `sshTargetGenerationCounter` is `0`, so the call is inert.
- [ ] **Step 3: Delete the ssh normalizer lines in `normalize-loaded-profile-state.ts`.** Delete line 2 (`SshRemotePtyLease` type import), lines 7-10 (`normalizeSshRemotePtyLease, normalizeSshTarget` import), lines 90-93 (`sshTargets:` and `deletedSshConfigAliases:` entries) and lines 98-101 (`sshRemotePtyLeases:` and `sshPtyConsumerRecoveries:` entries). The `...defaults` spread at line 43 supplies `[]`/`[]`/`[]`/`[]` because B7.2 Step 2 removed the keys from `parsed`.
- [ ] **Step 4: Delete the ssh serializer lines in `state-serialization-secret-handling.ts`.** Delete line 11 (`sshPtyOwnerLeaseSecretSlot,`), lines 109-111 (`case 'sshRemotePtyLeases': … break`), and lines 206-213 (the `sshPtyConsumerRecoveries: (…).map(…)` property). `buildStateToSave` keeps writing `sshPtyConsumerRecoveries: []` through `...this.getDurableState()`. A stray selective `scheduleSave(…, ['sshRemotePtyLeases'])` would now hit `default: return undefined`, which falls back to the complete write (read `state-serialization-secret-handling.ts:56-60` and the caller in `profile-state-selective-write.ts` to confirm; no edit needed).
- [ ] **Step 5: Update the existing tests to the strip semantics (fixture rows stay as legacy input).**
  - `profile-state-cutover-fixture.test.ts`: line 78 → `toEqual(['repo-local'])`; lines 79-82 → `toEqual(['repo:repo-local'])`; lines 83-86 → `toEqual(['repo-local'])`; lines 93, 115, 147 → `expect(<store>.getWorkspaceSession('ssh:build-host').activeTabId).toBeNull()`.
  - `profile-state-cutover-soak.test.ts`: delete `connectionId: 'build-host'` at lines 136 and 142; lines 149-150 → `projectId: 'repo-local'` and `workspaceId: 'repo-local::/fixture/local'`; line 198 and 239 and 348 → `.toBeNull()`; delete the `connectionId: 'build-host'` lines inside the two `toMatchObject` blocks at 199-203 and 240-243; lines 213-218 → `{ executionTargetType: 'local', executionTargetId: 'local', schedulerOwner: 'local_host_service', workspaceId: 'repo-local::/fixture/local' }`; lines 248-253 → `{ executionTargetType: 'local', executionTargetId: 'local', schedulerOwner: 'local_host_service' }`. Rename the automation at line 146 to `'Local fixture automation'`.
  - `profile-state-sqlite-authority.test.ts`: delete lines 438-475 (the `ssh:build-host` rebind block); the preceding `toHaveBeenCalledTimes(1)` and the `reloaded` assertions stay.
  - `state-write-round-trip.test.ts`: line 80 title → `'reloads settings, secrets and the local session; a remote partition is dropped at load'`; replace lines 118-122 with:
    ```ts
        // Remote partitions are stripped at load (local-only fork); the slot reads back as the default.
        expect(reloaded.getWorkspaceSession(HOST_ID).activeTabId).toBeNull()
        expect(reloaded.getWorkspaceSessionHostIds()).toEqual(['local'])
    ```
  - `profile-state-checkpoints.test.ts`: delete line 66 (`store.getWorkspaceSession('ssh:build-host').activeTabId = …`) and line 72 (the `workspaceSessionsByHostId:` entry of `EXPECTED_CHECKPOINT`).
  - `worktree-meta-alias-projection.test.ts`: in the `Fixture` type (lines 110-116) add `/** Identity keys on an ssh host: stripped at load, never written back. */ strippedAtLoad: string[]`; in `buildFixture` declare `const strippedAtLoad: string[] = []` and change line 167 to `strippedAtLoad.push(link(contested, REMOTE, remoteClaim))` and line 171 to `strippedAtLoad.push(link(voided, REMOTE, meta(TWIN_ROWS + 2, random, { hostId: REMOTE as never })))`; return `strippedAtLoad` alongside `omittable`/`irreducible`. After the `onDisk.worktreeMetaByIdentity` assertion (line ~245) add `expect(Object.keys(onDisk.worktreeMetaByIdentity ?? {})).not.toEqual(expect.arrayContaining(fixture.strippedAtLoad))` and `expect(before.remote).toEqual({})`. Lines 254, 301 and 357-359 keep comparing `{}` to `{}`; leave them.
- [ ] **Step 6: Run the touched tests and gates.**
  `pnpm test src/main/persistence/loading-store/legacy-remote-profile-load.test.ts src/main/persistence/loading-store/remote-execution-host-strip.test.ts src/main/persistence/profile-state-cutover-fixture.test.ts src/main/persistence/profile-state-cutover-soak.test.ts src/main/persistence/loading-store/profile-state-sqlite-authority.test.ts src/main/persistence/loading-store/state-write-round-trip.test.ts src/main/persistence/loading-store/profile-state-checkpoints.test.ts src/main/persistence/loading-store/worktree-meta-alias-projection.test.ts src/main/persistence/tracking-repos/worktree-metadata-normalization.test.ts src/main/persistence/loading-store/persisted-state-redundancy.test.ts` — expected: all green. If the `node:fs` partial mock destabilizes the harness, drop the `existsSync` assertion and keep the rest; the unit test in B7.1 already proves the hostless legacy meta of a stripped repo is gone before `gcStaleWorktreeMeta` can probe it.
  Then `pnpm tc` (clean), `pnpm run check:code-quality:changed` (clean), `pnpm run check:local-only` (clean), and `pnpm test src/main/persistence` compared against `notes/local-only/after/failing-files.txt` — expected: no new failing file beyond the files B6 owns (`ssh-lease-async-durability`, `profile-state-direct-flush` SSH `it`s, `profile-state-maintenance-final-failure:45`, `profile-state-startup-secrets:171`, `src/main/persistence-ssh-remote-pty-leases.test.ts`).
- [ ] **Step 7: Commit.**
  ```
  git add src/main/persistence
  git commit -m "feat(local-only): strip ssh/runtime rows at profile load instead of normalizing them

  Legacy profiles drop remote repos, folder scopes, host setups, worktree metas,
  session partitions, PTY leases, consumer recoveries and SSH targets in one load,
  mark the profile dirty so the SQLite domain rows follow, and never fall back to
  local. Remote lease keychain blobs are released.

  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01PskLbdTqJNXxJ7KRnDoDoD"
  ```

## Unit B8 — Docs and architecture

### Task B8.1: AGENTS.md, README and the six translations

**Files:**
- Modify `AGENTS.md:3, 83, 95-97, 111-113, 117, 123`
- Modify `README.md:66-79, 205`
- Modify `docs/readme/README.es.md:66-79, 200`, `docs/readme/README.fr.md:66-79, 202`, `docs/readme/README.ja.md:66-79, 200`, `docs/readme/README.ko.md:66-79, 202`, `docs/readme/README.pt.md:66-79, 202`, `docs/readme/README.zh-CN.md:66-79, 200`
- Test: `config/scripts/check-readme-local-links.test.mjs` (existing), `pnpm run check:readme-local-links`

**Interfaces:**
- Consumes: nothing. Produces: AGENTS.md without the SSH Use Case and Remote Wire Compatibility sections; READMEs without the SSH feature tile or the SSH privacy exception. `resources/onboarding/feature-wall/tile-06.*` is NOT deleted (`src/shared/feature-wall-tiles.ts:104-110` still references it; that is the renderer unit's call).

- [ ] **Step 1: AGENTS.md line 3** — delete the final sentence `SSH remotes and remote runtimes stay until Spec B.` and append in its place: `SSH remotes, remote runtimes, orcad and ephemeral VMs are removed; WSL stays. A legacy \`ssh:\`/\`runtime:\` host id reaching a seam fails closed with a typed "unsupported in this build" error and never falls back to local.`
- [ ] **Step 2: AGENTS.md line 83 (Ripgrep bullet)** — replace `for every platform, WSL, and SSH remotes` with `for every platform and WSL`; replace `the relay's chain exists only for hosts an upload never reached` with `the WSL relay's chain exists only for distros an upload never reached`.
- [ ] **Step 3: AGENTS.md lines 95-97** — delete the `## SSH Use Case` heading, its paragraph and the blank line after it.
- [ ] **Step 4: AGENTS.md lines 111-113** — delete the `## Remote Wire Compatibility` heading, its paragraph and the blank line after it.
- [ ] **Step 5: AGENTS.md line 117** — replace `on native, WSL, and SSH hosts, which may all have different versions` with `on native and WSL hosts, which may have different versions`. **Line 123** — replace `native, WSL distro, SSH provider, or relay connection` with `native or WSL distro`.
- [ ] **Step 6: README.md** — delete lines 66-79 (the whole `<tr>…</tr>` holding `### SSH Worktrees`; verify with `sed -n 66,79p README.md` that line 66 is `<tr>` and line 79 is `</tr>` before deleting). Line 205: replace `, speech-model and scrcpy downloads you start yourself, and SSH.` with `, and speech-model and scrcpy downloads you start yourself.`
- [ ] **Step 7: Translations** — in each of the six files delete lines 66-79 (same `<tr>`…`</tr>` block; verify with `sed -n 66,79p`), then edit the privacy sentence:
  - `README.es.md:200`: `las descargas de modelos de voz y de scrcpy que inicias tú y SSH.` → `y las descargas de modelos de voz y de scrcpy que inicias tú.`
  - `README.fr.md:202`: `, les téléchargements de modèles vocaux et de scrcpy que vous lancez vous-même, et SSH.` → `, et les téléchargements de modèles vocaux et de scrcpy que vous lancez vous-même.`
  - `README.ja.md:200`: `あなたが開始する音声モデルと scrcpy のダウンロード、そして SSH です。` → `そしてあなたが開始する音声モデルと scrcpy のダウンロードです。`
  - `README.ko.md:202`: `직접 시작하는 음성 모델과 scrcpy 다운로드, 그리고 SSH입니다.` → `그리고 직접 시작하는 음성 모델과 scrcpy 다운로드입니다.`
  - `README.pt.md:202`: `, downloads de modelos de voz e de scrcpy que você inicia e SSH.` → ` e downloads de modelos de voz e de scrcpy que você inicia.`
  - `README.zh-CN.md:200`: `由你主动发起的语音模型和 scrcpy 下载，以及 SSH。` → `以及由你主动发起的语音模型和 scrcpy 下载。`
- [ ] **Step 8: Verify.** `rg -n "ssh\.mdx|SSH" README.md docs/readme AGENTS.md` — expected: no `ssh.mdx` links; the only remaining `SSH` mentions are none in README/translations and none in AGENTS.md (the `GIT_SSH_COMMAND` git handling is not documented there). `pnpm run check:readme-local-links` — expected: clean. `pnpm test config/scripts/check-readme-local-links.test.mjs` — expected: green. `pnpm run check:local-only` — clean.
- [ ] **Step 9: Commit.**
  ```
  git add AGENTS.md README.md docs/readme
  git commit -m "docs(local-only): drop the SSH rules, wire-compat section and SSH feature tile

  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01PskLbdTqJNXxJ7KRnDoDoD"
  ```

### Task B8.2: Remove the SSH, orcad and remote-wire reference docs and the docs-site SSH/remote/VM pages

**Files:**
- Delete `docs/reference/ssh-execution-boundary.md`, `docs/reference/ssh-host-key-verification.md`, `docs/reference/ssh-reconnect-source-recovery.md`, `docs/reference/orcad-operations.md`, `docs/reference/remote-wire-compatibility.md`
- Delete `docs/site/content/docs/ssh.mdx`, `docs/site/content/docs/ways-to-run.mdx`, `docs/site/content/docs/recipes/remote-worktrees.mdx`, `docs/site/public/docs/ways-to-run-local-sidebar.png`, `docs/site/public/docs/ways-to-run-per-workspace-env.png`
- Delete `config/scripts/orcad-operations-restart-safety.test.mjs` only if B3 left it (it reads `docs/reference/orcad-operations.md` by path at line 5)
- Modify `.gitignore:132, 138, 140, 147, 149-151`
- Modify `docs/site/content/docs/meta.json` (remove `"---SSH---"`, `"ways-to-run"`, `"ssh"`), `docs/site/content/docs/recipes/meta.json` (remove `"remote-worktrees"`), `docs/site/src/components/docs/SearchDialog.tsx:97-104`, `docs/site/tests/docs-package.test.mjs:70-72, 80`
- Modify docs-site cross-references: `docs/site/content/docs/index.mdx:15, 26, 31`; `troubleshooting.mdx:25-45`; `settings.mdx:10, 39, 63, 88-93, 122-123, 133`; `telemetry.mdx:30`; `cli/reference.mdx:66`; `model/agents-sessions.mdx:36-37`; `model/worktrees.mdx:71, 74, 109, 113`; `editing/file-explorer.mdx:12, 18, 20-23`; `editing/viewers.mdx:11`; `terminal.mdx:15, 25, 27`; `browser/overview.mdx:27-32`; `agents/native-chat.mdx:30`; `cli/automations.mdx:115`
- Test: `docs/site/tests/docs-package.test.mjs`

**Interfaces:**
- Consumes: nothing. Produces: a docs tree with 47 `.mdx` pages, no `/docs/ssh`, `/docs/ways-to-run` or `/docs/recipes/remote-worktrees` routes, and a `.gitignore` allowlist that names only files that exist. Code comments in surviving shared files that cite `docs/reference/ssh-execution-boundary.md` or `remote-wire-compatibility.md` (~35 sites, e.g. `src/shared/terminal-unavailable-cause.ts:10,18`, `src/main/worktree-removal-safety.ts:147`, `src/shared/runtime-host-contact.ts:12`) are left as they are: shared files get line deletions only, and the architecture doc (B8.3) records that the cited pages are gone.

- [ ] **Step 1: Guard the orcad test.** `test ! -e config/scripts/orcad-operations-restart-safety.test.mjs || git rm config/scripts/orcad-operations-restart-safety.test.mjs` (B3 should already have removed it; this is the only reader of the doc by path string: `rg -n "orcad-operations.md" src config .github skills skill-guides docs/site` must return nothing after this step).
- [ ] **Step 2: Delete the reference docs.** `git rm docs/reference/ssh-execution-boundary.md docs/reference/ssh-host-key-verification.md docs/reference/ssh-reconnect-source-recovery.md docs/reference/orcad-operations.md docs/reference/remote-wire-compatibility.md`. Keep every `docs/reference/wsl-*.md`, `omp-runtime-session-provenance.md` and `runtime-file-base64-padding.md` (verified local topics).
- [ ] **Step 3: `.gitignore` allowlist rows.** Delete these exact lines: `!docs/reference/headless-linux-server.md` (132, file no longer exists), `!docs/reference/orcad-operations.md` (138), `!docs/reference/relay-grace-time-reconfiguration.md` (140, file no longer exists), `!docs/reference/remote-wire-compatibility.md` (147), `!docs/reference/ssh-execution-boundary.md` (149), `!docs/reference/ssh-host-key-verification.md` (150), `!docs/reference/ssh-reconnect-source-recovery.md` (151). Verify with `for f in $(rg -o '^!docs/reference/.*' .gitignore | sed 's/^!//'); do test -e "$f" || echo "MISSING $f"; done` — expected: no output.
- [ ] **Step 4: Delete the docs-site pages and their media.** `git rm docs/site/content/docs/ssh.mdx docs/site/content/docs/ways-to-run.mdx docs/site/content/docs/recipes/remote-worktrees.mdx docs/site/public/docs/ways-to-run-local-sidebar.png docs/site/public/docs/ways-to-run-per-workspace-env.png` (the two PNGs are referenced only from `ways-to-run.mdx`, verified).
- [ ] **Step 5: Navigation and search.** `docs/site/content/docs/meta.json`: delete the three lines `"---SSH---",`, `"ways-to-run",`, `"ssh",`. `docs/site/content/docs/recipes/meta.json`: delete `"remote-worktrees"` and the trailing comma on the `"design-mode-fix"` line. `docs/site/src/components/docs/SearchDialog.tsx`: delete the object at lines 98-104 (`breadcrumb: ['Recipes', 'Work on a remote machine over SSH'] …`) and the comma after the preceding `}` at line 97.
- [ ] **Step 6: Ratchet the docs package test (update, never delete).** `docs/site/tests/docs-package.test.mjs:71` → `pages.length >= 47,`; line 72 → `` `expected at least the current 47 docs pages, found ${pages.length}` ``; delete line 80 (`'ssh.mdx',`).
- [ ] **Step 7: Cross-reference edits (exact text).**
  - `index.mdx:15` delete the bullet `- You want agents to run remotely — over SSH or in an on-demand VM — without giving up your IDE.`; line 26 delete the whole `- **Not a hosted VPS product.** …` bullet; line 31 delete the sentence `When you're ready to move agents off the laptop, start with [Ways to run Orca](/docs/ways-to-run).`
  - `troubleshooting.mdx` delete lines 25-45 (the four sections `## SSH connects but remote terminals fail`, `## SSH works for files but not "Download Folder"`, `## "Open in VS Code" is disabled or Local only`, `## Kerberos login fails`, through the blank line before `## Browser says`).
  - `settings.mdx:10` → `- **Open in menu** — choose apps on the worktree **Open in** menu.`; line 39 delete `, including over SSH`; line 63 delete the `**Browse through SSH workspace hosts**` bullet; lines 88-93 delete the `## SSH` section (heading, three bullets, blank line); line 122 replace `(panels, commands, language packs, VM recipes)` with `(panels, commands, language packs)`; line 123 delete the `Plugin workers always run on this computer; SSH workspace actions…` bullet; line 133 delete the `**Cloud VM**` bullet.
  - `telemetry.mdx:30` delete the `**SSH remote runtime**` bullet.
  - `cli/reference.mdx:66` → `The result includes this machine. Use \`--host local\` for this machine; it is the only host this build can target.`
  - `model/agents-sessions.mdx:36-37` delete the `Dashboard cards show a host badge for SSH workspaces…` paragraph and its trailing blank line.
  - `model/worktrees.mdx:71` delete the two sentences `Disconnected SSH / remote hosts can offer **Connect** without selecting them as the run target. **Add host** stays pinned for SSH targets.`; line 74 delete `See [Ways to run Orca](/docs/ways-to-run).` and its blank line; line 109 delete the sentence `For SSH workspaces whose host is disconnected, the card title row can show an inline reconnect control (see [SSH worktrees](/docs/ssh)).`; line 113 replace `local worktrees, main worktrees, folder workspaces, and workspaces on disconnected SSH hosts` with `local worktrees, main worktrees, and folder workspaces`.
  - `editing/file-explorer.mdx:12` delete the `For [SSH worktrees](/docs/ssh), drag-drop also works…` bullet; line 18 delete the sentence `For SSH worktrees, Orca first stages the remote file locally, then writes that staged file reference to the clipboard; remote folders are excluded.`; lines 20-23 delete the `## Download (SSH / remote)` section.
  - `editing/viewers.mdx:11` → `Open a local \`.html\` file with **Open in Orca Browser** or **Open Preview to the Side**. Orca renders the document in a sandboxed browser tab and reads the file and its relative assets through the workspace's file connection.`
  - `terminal.mdx:15` replace `so copy-from-remote/TUI works over SSH the same way as locally` with `so copying from a TUI works`; line 25 delete `SSH-owned links stay system-only.`; line 27 replace `from local and SSH workspaces; remote file rows also offer **Download & open with default app**` with `from local workspaces`.
  - `browser/overview.mdx:27-32` delete the `## Remote workspaces` section (heading, two paragraphs, blank line).
  - `agents/native-chat.mdx:30` → `Chat UI ships on desktop for supported local agent sessions.`
  - `cli/automations.mdx:115` delete the sentence starting `External automations that live on an SSH host…`.
- [ ] **Step 8: Verify.** `rg -n -i "ssh|/docs/ways-to-run|remote-worktrees|orcad|cloud vm" docs/site/content docs/site/src` — expected: only `GSSAPI`-free, SSH-free output (zero matches except any `ssh` inside unrelated words; inspect). `rg -n "docs/reference/(ssh|orcad|remote-wire|headless-linux|relay-grace)" .gitignore config .github skills skill-guides docs/site package.json` — expected: nothing. `cd docs/site && (test -d node_modules || pnpm install --frozen-lockfile) && pnpm test` — expected: `docs-package.test.mjs` green with 47 pages, media and route checks clean. `pnpm run check:local-only` — clean. `pnpm run check:code-quality:changed` — clean (TSX edit only in `SearchDialog.tsx`).
- [ ] **Step 9: Commit.**
  ```
  git add -A .gitignore docs/reference docs/site config/scripts
  git commit -m "docs(local-only): remove the SSH, orcad and remote-wire references and docs-site pages

  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01PskLbdTqJNXxJ7KRnDoDoD"
  ```

### Task B8.3: Architecture and upstream-sync docs, allowlist Spec B rows

**Files:**
- Modify `docs/reference/local-only-architecture.md` (sections: header lines 10-11, Invariants 15-21, Remaining listeners 41-85, Remaining egress exceptions 87-104, Allowlist entries 121, Guard rules 131-140, Removed subsystems 150-164, Known residuals 166-177)
- Modify `docs/reference/local-only-upstream-sync.md` (table lines 55, 67, add rows after 82; Classifying step 5 at line 99)
- Modify `config/local-only-allowlist.txt:20-24`
- Test: `pnpm run check:local-only`

**Interfaces:**
- Consumes: the final tree after B0-B7 (re-derive listener sites with the documented `rg`). Produces: the contract the Z unit verifies against.

- [ ] **Step 1: Re-derive the listener inventory.** Run `rg -n "\.listen\(|createServer\(|new WebSocketServer\(" src -g '!*.test.*'` and `rg -n "\.listen\(" src/relay -g '!*.test.*'`. Expected production sites: `src/main/runtime/rpc/unix-socket-transport.ts`, `src/main/daemon/daemon-server-lifecycle.ts`, `src/main/agent-hooks/server/server-lifecycle.ts`, `src/main/browser/cdp-ws-proxy.ts`, `src/main/localhost-worktree-label-proxy.ts`, and inside the WSL distro `src/relay/agent-hook-server.ts` (in the WSL keep set). `src/main/browser/remote-browser-socks-server.ts`, `src/main/ssh/ssh2-port-forward-provider.ts`, `src/main/ssh/system-ssh-*forward-process.ts` and `src/relay/relay-socket-ownership.ts` must be gone; if any remains, stop and report to the orchestrator (it is a B6 gap), do not document it as kept.
- [ ] **Step 2: `local-only-architecture.md` edits.**
  - Lines 10-11: append `, \`docs/local-only/2026-10-02-local-only-spec-b-design.md\` and its plan.`
  - Lines 15-21 replace with:
    ```
    - **I1, egress.** No Orca code opens a connection to a non-loopback host, with four exceptions:
      - the user's git CLI against their own remotes (including its own `GIT_SSH_COMMAND` handling, which is git's SSH, not Orca's)
      - the embedded browser pane
      - `shell.openExternal`, which hands off to the OS browser
      - user-initiated speech-model and scrcpy downloads

      Agent CLIs that Orca spawns (claude, codex, ...) talk to their vendors themselves. That traffic is out of scope.
    ```
    After the I3 bullet (line 31) add:
    ```
    - **I4, no remote execution.** No code path can create an `ssh:` or `runtime:` execution host, open an SSH connection, deploy a relay or orcad to another machine, or dial a remote Orca runtime. `ExecutionHostKind`/`ExecutionHostId` keep their `ssh` and `runtime` members as inert values nothing can construct. A legacy value reaching a seam fails closed with a typed "unsupported in this build" error; it never falls back to local. Persisted rows that name such a host are dropped at profile load (`src/main/persistence/loading-store/remote-execution-host-strip.ts`).
    ```
  - Lines 41-60: rewrite the production table to the five local rows plus one row `Agent-hook HTTP server inside a WSL distro | src/relay/agent-hook-server.ts:<line> | 127.0.0.1 of the distro, reached over the WSL hook relay (same machine)`, using the line numbers from Step 1; delete the "Listeners that run on the remote host of an SSH target" paragraph and table (lines 54-60). Lines 62-71: delete `src/main/ssh/ssh-hostile-host-local-sshd.ts`, `src/main/orcad/__fixtures__/fake-orcad-electron-sidecar.cjs` and `src/shared/remote-runtime-shared-control-test-server.ts:65 …` from the test-only list and re-count the `new WebSocketServer(` sites from Step 1. Line 74: replace `so \`orca serve\` and \`orcad\` accept` with `so \`orca serve\` accepts`.
  - Line 89: `Outside I1's five exceptions` → `Outside I1's four exceptions`. Delete line 104 (`- **SSH (Spec B).** …`).
  - Line 121: delete `- **Remote-runtime pairing fixtures**, removed with remote runtimes in Spec B.`
  - Lines 136-137 (guard rules): append `nodejs.org/dist`, `storage.googleapis.com` to the `forbidden-host` list and `ssh2`, `ssh2-*` (runtime imports; `import type` from `ssh2` stays for the hook installers' `SFTPWrapper` abstraction), `tweetnacl` to `forbidden-import` and `forbidden-dependency`, matching what B0 implemented (read `config/scripts/check-local-only.mjs` `FORBIDDEN_HOSTS`/`FORBIDDEN_MODULES` and copy the exact names).
  - After line 164 add:
    ```
    - **U13, ephemeral VMs and VM recipes (B1):** the `orca vm` CLI, `EphemeralVmsPane`, `skill-guides/orca-per-workspace-env*`, `--recipe-json`/`--serve-recipe-json`/`--serve-project-root` on `orca serve`. `experimentalEphemeralVms` and the per-worktree checkout mode stay as inert persisted values.
    - **U14, serve-update handoff (B2):** the supervisor handoff in `src/cli/runtime/launch.ts` and `notifyServeSupervisorReady`. `orca serve` remains a local headless runtime driven by the local CLI over the unix socket or named pipe.
    - **U15, orcad (B3):** `src/main/orcad/**`, `src/main/ssh/orcad-*`, `src/shared/orcad-*`, the build-orcad scripts, the electron-builder orcad template, its CI and `docs/reference/orcad-operations.md`.
    - **U16, transfer rails and pinned downloads (B4):** the `skills.install*` RPC family and upload methods, `skill-package-download.ts`, `skill-install-request-service.ts`, `runtime-archive-download.ts`, `pinned-runtime-materializer.ts`, `node-runtime-pin` and `check:node-runtime-pin`, and the WSL OpenCode vault reader (`opencode-wsl-runtime-preparation.ts`), so AI Vault on Windows no longer lists OpenCode sessions stored inside WSL. `scrcpy-server-download.ts` and the speech-model download stay.
    - **U17, remote runtime environments (B5):** the pairing client, `src/shared/pairing.ts` and fixtures, `src/shared/remote-runtime-*`, `ipc/runtime-environment*`, the runtime-environments pane, store and client, the remote-server-update client, the CLI remote dial (`websocket-transport.ts`, `ORCA_PAIRING_CODE`, `ORCA_ENVIRONMENT`, `orca environment`, `--host runtime:`), e2ee and `tweetnacl`, the orchestration federation files. `activeRuntimeEnvironmentId` stays an inert, always-null field.
    - **U18, SSH (B6):** connection management, the SSH git/filesystem/PTY providers, relay deploy, the SSH UI, IPC, preload and CLI, port forwarding, SOCKS and browser tunnels, SSH e2e and CI, the `docs/reference/ssh-*` docs, the `ssh2` runtime dependency and its packaged-runtime entry. The provider registries (`getSshGitProvider`, `getSshFilesystemProvider`, `getSshProvider`, PTY `sshProviders`) remain as stubs that always return `undefined`, so ~80 `if (connectionId)` callers stay byte-identical to upstream.
    - **Hydration (B7):** `sshTargets`, `sshTargetGenerationCounter`, `deletedSshConfigAliases`, `removedSshTargetTombstones`, `sshRemotePtyLeases` and `sshPtyConsumerRecoveries` are deleted from a loaded profile; repos, project groups, folder workspaces, project host setups, worktree metadata, identity rows, session partitions and retirement namespaces that name an `ssh:`/`runtime:` host or a `connectionId` are dropped; the profile is marked dirty so the SQLite domain rows follow on the next complete write. The six keys stay in `PersistedState` as inert empty defaults.
    ```
  - Replace lines 166-177 (`## Known residuals and Spec B scope` …) with:
    ```
    ## What remains, and why

    The reachable network surface is now exactly I1's four exceptions. These are the deliberate remnants:

    - **WSL relay survivors.** WSL is on-machine execution, so its two bundles stay: `src/relay/wsl-agent-hook-relay.ts` and `src/relay/wsl-browser-network-relay.ts`, built by `config/scripts/build-relay.mjs` into `out/relay/` and shipped as `resources/relay`. Their import closure (about 40 `src/relay` files: `dispatcher*`, `agent-hook-*`, `plugin-overlay*`, `protocol.ts`, `preflight-handler.ts`, `wsl-hook-fs-bridge.ts`, `wsl-install-plugins-handler.ts`, `relay-frame-decoder.ts`, …) and the eight `src/main/ssh` transport files the Windows-side WSL hook relay manager imports (`relay-protocol`, `ssh-channel-multiplexer`, `ssh-multiplexer-transport-writer`, `ssh-multiplexer-writer-lane-scheduler`, `ssh-connection-generation`, `ssh-target-identity`, `ssh-target-id-migration`, `removed-ssh-target-tombstone-retention`) are kept **in place**, not relocated, so upstream merges stay small. Re-derive the closure with `pnpm tc` after touching either entry. Nothing in it opens a socket to another machine.
    - **Inert types and keys.** `ExecutionHostKind`/`ExecutionHostId` keep `ssh`/`runtime`; `Repo.connectionId`/`executionHostId` and the folder-workspace and project-host-setup equivalents stay typed; the six SSH persisted keys and `activeRuntimeEnvironmentId` stay as empty/null defaults; `experimentalEphemeralVms` and the per-worktree checkout mode stay as dead settings. None can be set from any UI, IPC, RPC or CLI path.
    - **Hook installers' `SFTPWrapper`.** ~37 managed agent-hook installers use `import type { SFTPWrapper } from 'ssh2'` as their filesystem abstraction (the WSL hook bridge fakes it). `@types/ssh2` therefore stays a devDependency; the runtime `ssh2` package is gone and the guard forbids non-type imports.
    - **Dead persisted settings keys** from Spec A (`starNag*`, update UI fields, cloud-linked profile fields, mobile pairing settings, `groupBy: 'pr'`, `activeView` of `'artifacts'`/`'tasks'`) still hydrate to defaults.
    - **Stale doc citations in code comments.** Shared files that cite `docs/reference/ssh-execution-boundary.md` or `remote-wire-compatibility.md` keep the comment text; those pages are removed and the citations are historical.
    - **Browser pane is unrestricted by design.** Anything the user loads in it is outside the invariants.
    - **Agent CLIs** that Orca spawns reach their vendors on their own.
    ```
- [ ] **Step 3: `local-only-upstream-sync.md` edits.**
  - Line 55 (`package.json` row, "What we removed"): append `; Spec B: dependencies \`ssh2\`, \`tweetnacl\`, scripts \`check:node-runtime-pin\`, \`build:orcad*\`, the \`ssh\`/\`vm\`/\`environment\` e2e scripts; \`@types/ssh2\` stays`.
  - Line 67 (`src/main/persistence.ts, src/main/persistence/**` row, "What we removed"): append `; Spec B: the ssh normalizer lines in \`loading-store/loaded-state-parsing.ts\`, \`normalize-loaded-profile-state.ts\` and \`state-serialization-secret-handling.ts\`, replaced by \`remote-execution-host-strip.ts\`; \`leasing-ssh-ptys/*\` except \`secret-validation.ts\`; \`loading-store/ssh-*\`` and in "On conflict": append ` Keep the strip call; drop any new ssh normalizer or lease operation upstream adds.`
  - After line 82 add rows:
    ```
    | `src/main/ssh/**`, `src/relay/**` | Spec B: everything except the WSL relay closure (see architecture doc "WSL relay survivors"). | `git rm` upstream's new SSH files. For a new file in a kept directory, ask whether the WSL bundles import it (`pnpm tc` and `config/scripts/build-relay.mjs`); keep only if they do. |
    | `src/main/providers/*` (git, filesystem, PTY provider registries) | Spec B: the SSH provider implementations; `getSshGitProvider`, `getSshFilesystemProvider`, `getSshProvider` and PTY `sshProviders` are stubs returning `undefined`. | Keep the stubs. Take upstream's changes to callers unchanged; delete any new caller that would treat `undefined` as local. |
    | `src/main/orcad/**`, `src/shared/orcad-*`, `config/scripts/build-orcad*`, `config/electron-builder-orcad*` | Spec B: orcad. | `git rm`. |
    | `src/main/ephemeral-vm-*`, `src/cli/handlers/vm.ts`, `src/cli/specs/vm.ts`, `skill-guides/orca-per-workspace-env*` | Spec B: ephemeral VMs and recipes. | `git rm`; drop new `vm` group entries in `src/cli/handler-group-manifest.ts` and the serve `--recipe-json` options. |
    | `src/shared/remote-runtime-*`, `src/shared/pairing.ts`, `src/main/ipc/runtime-environment*`, `src/cli/runtime/websocket-transport.ts` | Spec B: remote runtimes, pairing and the CLI dial. | `git rm`; drop new `--host runtime:` and `ORCA_ENVIRONMENT` handling. |
    | `src/shared/execution-host.ts`, `src/shared/repo-types.ts`, `src/shared/persisted-state-types.ts`, `src/shared/constants.ts` | Nothing: the `ssh`/`runtime` union members and the six SSH persisted keys are kept inert. | Take upstream. If upstream adds a new persisted key for a removed feature, add it to `STRIPPED_REMOTE_STATE_KEYS` in `remote-execution-host-strip.ts` with a test. |
    | `config/local-only-allowlist.txt`, `config/scripts/check-local-only.mjs` | Spec B added the `ssh2`/`tweetnacl` import rules and the `nodejs.org/dist`, `storage.googleapis.com` hosts. | Keep ours; a new upstream SSH or runtime download is cloud: remove it, do not allowlist. |
    ```
  - Line 99: replace `5. **SSH and remote-runtime code** stays untouched until Spec B.` with `5. **Does it create or talk to an \`ssh:\`/\`runtime:\` execution host, deploy a relay or orcad, or boot a VM?** It is **remote execution**: remove it (I4). WSL (`wslDistro`, `{ kind: 'wsl' }`) is local and stays.`
- [ ] **Step 4: `config/local-only-allowlist.txt`.** Delete lines 23-24 (`# Remote-runtime pairing fixtures; …` and `src/shared/mobile-relay-pairing-fixtures.ts:forbidden-host`; B5 deleted the file). Delete line 22 (`src/relay/port-scan-handler.ts:wildcard-bind`) only if `test ! -e src/relay/port-scan-handler.ts` (it is outside the WSL keep set and B6 deletes it); keep line 21. If B0 already removed these rows, skip. Verify every remaining `path:rule` names an existing file: `for p in $(rg -v '^#' config/local-only-allowlist.txt | cut -d: -f1); do test -e "$p" || echo "MISSING $p"; done` — expected: no output.
- [ ] **Step 5: Verify.** `pnpm run check:local-only` — clean. `rg -n "Spec B|until Spec B" docs/reference/local-only-architecture.md docs/reference/local-only-upstream-sync.md AGENTS.md config/local-only-allowlist.txt` — expected: only the design-doc link line and the "Spec B:" annotations in the playbook table; no "until Spec B". `pnpm run check:code-quality:changed` — clean (docs only).
- [ ] **Step 6: Commit.**
  ```
  git add docs/reference/local-only-architecture.md docs/reference/local-only-upstream-sync.md config/local-only-allowlist.txt
  git commit -m "docs(local-only): record the Spec B invariants, WSL relay survivors and merge playbook rows

  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01PskLbdTqJNXxJ7KRnDoDoD"
  ```

---

## Planner group: b6-main

## B6 part 1 — SSH in main/shared/relay

### KEEP sets (computed 2026-10-02 by static import walk; re-derive before each task with the commands in B6.1 step 1 and B6.2 step 1)

**src/relay — WSL closure, 75 files; every other file under `src/relay/` is deleted.** Seeds: `src/relay/wsl-agent-hook-relay.ts`, `src/relay/wsl-browser-network-relay.ts`.

40 non-test: `agent-hook-cached-pane-status.ts agent-hook-endpoint-coordinates.ts agent-hook-envelope-build.ts agent-hook-envelope-publication.ts agent-hook-request.ts agent-hook-result-retry-scheduler.ts agent-hook-server.ts client-request-aborts.ts dispatcher-capacity-signals.ts dispatcher-client-lifecycle.ts dispatcher-client-state.ts dispatcher-client-writer.ts dispatcher-contract.ts dispatcher-frame-codec.ts dispatcher-notification-publication.ts dispatcher-producer-capacity.ts dispatcher-producer-transport.ts dispatcher-pty-publication.ts dispatcher-rpc-routing.ts dispatcher-writer-admission.ts dispatcher-writer-drain-arm.ts dispatcher-writer-lane-scheduler.ts dispatcher-writer-sink.ts dispatcher.ts legacy-relay-publication-ledger.ts omp-status-extension.ts opencode-canonical-config.ts plugin-overlay-env.ts plugin-overlay.ts plugin-source-limit.ts preflight-handler.ts protocol.ts relay-agent-presence.ts relay-command-env.ts relay-frame-decoder.ts relay-work-admission.ts wsl-agent-hook-relay.ts wsl-browser-network-relay.ts wsl-hook-fs-bridge.ts wsl-install-plugins-handler.ts`

35 tests whose import closure stays inside that set: `agent-hook-envelope-publication.test.ts agent-hook-server-codex-subagent-transcript.test.ts agent-hook-server.test.ts agent-status-store-relay-context.test.ts dispatcher-capacity-degradation.test.ts dispatcher-client-close-cause.test.ts dispatcher-client-writer.test.ts dispatcher-frame-guard-regressions.test.ts dispatcher-json-payload.test.ts dispatcher-notification-ownership.test.ts dispatcher-per-connection-state-baseline.test.ts dispatcher-producer-settlement.test.ts dispatcher-rpc-cancel-id-coercion.test.ts dispatcher-silent-client-reaper.test.ts dispatcher-structured-error.test.ts dispatcher-timeout.test.ts dispatcher-work-drain.test.ts dispatcher-writer-admission.test.ts dispatcher.test.ts legacy-relay-publication-ledger.test.ts omp-config-root.test.ts plugin-overlay-env.test.ts plugin-overlay.test.ts plugin-source-limit.test.ts preflight-handler.test.ts protocol-backpressure.test.ts protocol-handshake.test.ts protocol-json-payload.test.ts relay-agent-presence.test.ts relay-command-env.test.ts relay-hot-path-operation-counts.test.ts relay-work-admission.test.ts wsl-agent-hook-relay.test.ts wsl-hook-fs-bridge.test.ts wsl-install-plugins-handler.test.ts`

Outside `src/relay` the closure reaches `src/main/browser/browser-network-tunnel-*.ts` (8), `src/main/pty/{overlay-mirror,shell-startup-env}.ts`, `src/main/{wsl,wsl-*,pwsh,git-bash}.ts`, `src/main/startup/{hydrate-shell-path,login-shell-environment,windows-shell-path-ownership}.ts` and 357 `src/shared` files, among them `relay-frame-buffer.ts`, `relay-frame-decoder.ts`, `relay-frame-decoder-contract.ts`, `relay-work-drain-contract.ts` (all kept), `skill-ssh-relay-contract.ts` (reached through `relay-work-drain-contract.ts:1`; B4 owns it — see ordering) and `telemetry-ssh-runtime-event-schemas.ts` (reached through `telemetry-event-registry.ts:99`; cut in B6.2). The only `src/main` non-test importers of `src/relay` are the four `import type { PluginSources } from '../../relay/plugin-overlay'` sites in `src/main/agent-hooks/{opencode-plugin-settings,wsl-hook-relay-deps,wsl-guest-plugin-install,wsl-hook-relay-guest-install}.ts`; `plugin-overlay.ts` is kept, so they are untouched.

**src/main/ssh — 15 non-test files stay; the other 197 non-test files, and every test not listed, are deleted.**
- WSL import closure (what `src/main/agent-hooks/wsl-hook-relay-{launch,link,manager,sentinel,state,guest-install}.ts`, `wsl-hook-fs-adapter.ts` and `wsl-guest-plugin-install.ts` reach; 4 files): `relay-protocol.ts`, `ssh-channel-multiplexer.ts`, `ssh-multiplexer-transport-writer.ts`, `ssh-multiplexer-writer-lane-scheduler.ts`.
- B7 seams named by the design (4 files, not in the WSL closure): `ssh-connection-generation.ts` (callers `ipc/filesystem-mutations.ts:11`, `ipc/filesystem/filesystem-write-handlers.ts:4`, `runtime/runtime-file-commands-mobile-file-list-limit.ts:11`, `runtime/orca-runtime-files-test-harness.ts:3`, `persistence/loading-store/ssh-profile-operations.ts:33`), `ssh-target-identity.ts` (`worktree-retirement-namespace.ts:8`), `ssh-target-id-migration.ts` (`persistence/leasing-ssh-ptys/ssh-target-reassignment.ts:8`), `removed-ssh-target-tombstone-retention.ts` (`persistence/leasing-ssh-ptys/ssh-target-state.ts:10`).
- Inert pure modules kept so their callers stay untouched (6): `ssh-provider-authority.ts` (imports only `ssh-connection-generation` and `shared/ssh-types`; 6 callers), `ssh-remote-platform.ts` (imports only `relay-protocol`; AI-vault scanner ×9 and the kept git chain), `ssh-git-response-stream-reader.ts` (kept git chain), `ssh-file-stream-read-cap.ts` (`runtime/orchestration/worker-transcript-remote-read.ts:9`), `ssh-file-stream-inactivity-deadline.ts` (imports `../system-power-lifecycle`), `ssh-filesystem-stream-reader.ts` (`FileReadCapExceededError` used by `browser/doc-preview-file-reader.ts:5` and `runtime/runtime-file-commands-mobile-file-list-limit.ts:4`).
- Stub rewritten in B6.2: `ssh-target-registry.ts`.
- Tests kept (16): `relay-protocol.test.ts ssh-channel-multiplexer-backpressure.test.ts ssh-channel-multiplexer-saturation-wedge.test.ts ssh-channel-multiplexer-settlement.test.ts ssh-channel-multiplexer.test.ts ssh-multiplexer-transport-writer.test.ts ssh-multiplexer-writer-retention.test.ts ssh-connection-generation.test.ts ssh-target-id-migration.test.ts removed-ssh-target-tombstone-retention.test.ts ssh-provider-authority.test.ts ssh-remote-platform.test.ts ssh-git-response-stream-reader.test.ts ssh-git-stream-idle-timer.test.ts ssh-request-outcome-verdict.test.ts ssh-file-stream-inactivity-deadline.test.ts`.

**src/main/providers/ssh-* — 13 of 46 non-test files stay.** Stubs rewritten in B6.2: `ssh-git-dispatch.ts`, `ssh-filesystem-dispatch.ts`. Inert git-provider class chain kept because 14 survivors import the `SshGitProvider` type and its public surface (~60 members beyond `IGitProvider`: `exec`, `execNonInteractive`, `clone`, `isGitRepoAsync`, `getConnectionId`, `getHostPlatform`, `markRemoteOrcaCreated`, …) cannot be re-declared as a type stub: `ssh-git-provider.ts ssh-git-worktree-provider.ts ssh-git-review-head-provider.ts ssh-git-remote-sync-provider.ts ssh-git-working-tree-provider.ts ssh-git-noninteractive-provider.ts ssh-git-read-provider.ts ssh-git-relay-errors.ts` plus `ssh-git-provider-test-harness.ts` and their tests (`ssh-git-provider-*.test.ts`, `ssh-git-worktree-list-dedupe.test.ts`, `ssh-worktree-catalog-authority.test.ts`; none imports a deleted module). Pure helpers kept: `ssh-pty-errors.ts` (callers `ipc/pty/ipc/spawn-execute.ts`, `ipc/pty/runtime/spawn-execute.ts`, `ipc/pty/provider/liveness.ts`), `ssh-pty-id.ts` (re-export of `shared/ssh-pty-id`; 8 callers including `ipc/pty/provider/registry.ts`).

**Seam principle for every other file:** delete the connection, transport, deploy and handler layer; keep four stub registries; leave every `if (connectionId)` caller untouched. A surviving file is edited only when its import target is deleted, and then only by deleting import lines and whole SSH arms (two arms are replaced by a fail-closed throw, listed explicitly in B6.2). Files that import only stubs or kept modules stay byte-identical: `ipc/worktree-remote.ts`, `ipc/repos/remote-{home-path,repo-clone,repo-creation,repo-registration}.ts`, `ipc/filesystem-watcher-remote-*.ts` (8), the 30 `ipc/ssh-pty-*.ts` output-model files, `ipc/pty/delivery/ssh-intake.ts`, `ipc/ssh-pty-output-intake-registry.ts`, `ipc/pty/pane/ssh-pane-lease-claim.ts`, `ipc/pty/runtime/undelivered-ssh-kill.ts`, `ipc/ssh-worktree-create-root-registration.ts`, `ipc/worktrees/listing/ssh-worktree-fallback.ts`, `ipc/workspace-cleanup-disconnected-ssh.ts`, `ipc/preflight-remote-windows-terminal-capabilities.ts`, `ipc/remote-filesystem-owner.ts`, `ipc/remote-watcher-event-batch.ts`, `ai-vault/ssh-session-list.ts`, `ai-vault/remote-session-*.ts`, `automations/external-manager-{relay,discovery}.ts`, `window/clipboard-remote-file-{copy,staging}.ts`, `workspace-space-remote-scan.ts`, `remote-worktree-history-cleanup.ts`, `runtime/{public-ssh-state,orca-runtime-notify-ssh-state-changed,orca-runtime-has-live-or-persisted-serve-or-ssh-owned-pty-binding,runtime-file-commands-ssh-file-watcher-rearm,ssh-file-explorer-chunk-read,runtime-remote-fetch-controller}.ts` (`runtime-remote-fetch-controller.ts` is git-remote fetching, not SSH — the inventory misfiled it), `worktree-{create,removal}-execution-host-route.ts`, `worktree-removal-test-ssh-host-home.ts`, `providers/execution-host-provider-dispatch.ts`, `ipc/pty/provider/registry.ts`, `ipc/pty.ts`, `startup/main-process-runtime-service.ts`, `window/attach-main-window-services.ts`, `ipc/ai-vault*.ts`, `ipc/repos/nested-repo-*.ts`, `preflight/agent-detection.ts`, `runtime/rpc/methods/client-events.ts`, `runtime/orca-runtime-*.ts`, `ipc/worktrees-test-harness.ts`, `ipc/worktrees-test-module-mocks.ts`.

### Task B6.1: Cut the SSH relay daemon from src/relay; build only the two WSL bundles

**Files:**
- Delete: every file under `src/relay/` not in the 75-file KEEP list (339 files), including `relay.ts`, `relay-daemon.ts`, `ai-vault-service-entry.ts`, `pty-handler*.ts`, `fs-*.ts`, `git-*.ts`, `port-scan-handler.ts`, `skill-install-handler.ts`, `relay-runtime-*.ts`, `node-pty-*.ts`, `hermes-*.ts`, `external-automation*.ts`, `pty-shell-overlay-wrappers.ts`, `plugin-host-call-handler.ts`, `*.integration.test.ts`, `integration.test.ts`; `config/relay-assets/` (3 patch files); `config/scripts/relay-windows-process-tree-staging.mjs`, `config/scripts/relay-windows-process-tree-staging.test.mjs`, `config/scripts/relay-windows-process-tree-workflow-contract.test.mjs`, `config/scripts/build-windows-process-tree-relay-addon.mjs`, `config/scripts/relay-asset-line-ending-pin.test.mjs`, `config/scripts/relay-frame-buffer-benchmark.mjs`, `config/scripts/relay-json-payload-benchmark.ts`, `config/scripts/relay-replay-buffer-benchmark.mjs`, `config/scripts/relay-watcher-fault-harness.mjs`, `config/scripts/pty-source-ack-boundary-benchmark.mjs`, `config/scripts/hermes-run-correlation-benchmark.mjs`, `config/scripts/benchmark-sentinel-retention.mjs`, `config/scripts/ssh-localhost-e2e-routing.test.mjs` (its line 48 asserts `existsSync` for `src/relay/relay-agent-hook-runtime.ts`); `.github/workflows/relay-windows-process-tree.yml`; `src/main/__fixtures__/shell-wrapper-snapshots/relay-bash-rcfile.txt`, `src/main/__fixtures__/shell-wrapper-snapshots/relay-zsh-zshenv.txt`; `src/shared/relay-retry-after-header.ts`, `src/shared/relay-version-marker.ts`, `src/shared/relay-version-marker.test.ts` (zero importers); `tests/tools/omp-relay-close-lifecycle.test.mjs`, `tests/tools/omp-relay-close-lifecycle.md` (import `src/relay/pty-handler-test-harness.ts`); the 12 `src/main/ssh` tests that import deleted relay modules: `ssh-connection-file-transfer.test.ts ssh-relay-gc-claim-termination.test.ts ssh-relay-install-lock-termination.test.ts ssh-relay-repair-lock-termination.test.ts ssh-relay-session-agent-hooks.integration.test.ts ssh-relay-session.test.ts ssh-relay-versioned-install-termination.test.ts ssh-relay-versioned-install.test.ts ssh-remote-cli-host-passthrough.test.ts ssh-remote-cli-launcher.test.ts ssh-remote-commands.test.ts ssh-system-fallback.test.ts`; and the relay-only tests outside: `src/main/ai-vault/remote-session-large-transcripts.test.ts` (imports `relay/ai-vault-service-filesystem`), `src/main/git/status-branch-line-total-relay-parity.test.ts` (relay git parity), `src/main/ipc/worktrees-ssh-fork-push-target-remote.test.ts` (`relay/git-exec-validator`), `src/main/providers/terminal-path-existence-batch.integration.test.ts` (`relay/fs-path-existence`).
- Modify: `config/scripts/build-relay.mjs` (replace whole file, step 3); `config/scripts/relay-artifact-manifest.test.mjs` (rewrite, step 4); `config/tsconfig.relay.json:8` (delete the `"exclude": ["../src/relay/integration.test.ts"],` row; keep `include`); `config/knip.json:24` (delete `"src/relay/relay.ts",`); `config/local-only-allowlist.txt:22` (delete the row `src/relay/port-scan-handler.ts:wildcard-bind`; keep the comment at 20 and the `local-workspace-port-address.ts` row); `config/max-lines-baseline.txt:10` (`inline src/relay/pty-handler.ts` — via `--prune`); `src/shared/child-process/__fixtures__/child-process-import-allowlist.txt:152-161,163-165` (13 `src/relay/*` rows; keep 162 `src/relay/preflight-handler.ts`, which is in KEEP and still imports child_process); `src/shared/child-process/__fixtures__/windows-console-visibility-allowlist.txt:50-57` (8 `relay/*` rows); `src/main/shell-wrapper-generated-file-snapshot.test.ts:20` (import of `ensureOverlayRestoreWrappers`), `:139-141` (`it('relay overlay wrappers', …)`), `:159` (the `['relay', …]` row); `src/main/zsh-scoped-histfile.live-shell.test.ts` and `src/main/zsh-wrapper-version-mismatch.live-shell.test.ts` (delete the `../relay/pty-shell-overlay-wrappers` import and the overlay case in each; both are in `UNIT_EXCLUDE` but still typecheck); `src/main/ai-vault-search/session-search-scope-entry-points.test.ts` (delete the `../../relay/ai-vault-handler` import and the SSH-leg cases), `src/main/git/status-conflict-overlap.bench.test.ts` (delete the three `../../relay/git-*` imports and the relay half of the bench), `src/main/ipc/worktree-push-target-cleanup.test.ts` and `src/main/ipc/worktree-push-target-reconciliation.test.ts` (delete the `../../relay/git-exec-validator` import and the SSH cases that build a fake SSH executor), `src/main/plugins/plugin-host-conformance.test.ts` (delete the `../../relay/plugin-host-call-handler` import and its relay case), `src/main/runtime/runtime-file-path-existence.test.ts` (delete the `../../relay/fs-path-existence` and `fs-path-metadata-requests` imports and the SSH cases), `src/main/runtime/tui-idle-name-only-real-pty.integration.test.ts` (delete the `../../relay/pty-shell-utils` import and its relay case); `config/vitest.performance.config.ts:9` (delete the `src/relay/fs-path-metadata-symlink-concurrency.test.ts` row); `.github/workflows/performance-contracts.yml:19` (same path row); `config/scripts/pr-code-change-scope.mjs:51` (`'src/relay/git-'`), `:157-158` (`'config/scripts/build-relay'`, `'src/relay/'`), `:293` (`'src/relay/windows-port-scan.win32.test.ts'`); `.github/workflows/pr.yml:1002` (`src/relay/windows-port-scan.win32.test.ts`); `.github/workflows/release-cut.yml:1190-1205` (the `relay-windows-process-tree` job), `:1405-1412` (its artifact download step), `:1436` (`ORCA_REQUIRE_RELAY_NATIVE_ADDONS: x64,arm64`), `:2268` (`needs` row); `.github/workflows/dev-channel-win-build.yml:247-248,256`; `.github/workflows/node-server-tests.yml:153-160,366-367` and `config/scripts/orcad-windows-process-tree.mjs`, `config/scripts/node-server-change-scope.mjs` (B3 deletes all three; if any still exists it imports the staging script deleted here — delete it in this task); `config/reliability-gates.jsonc` (scripted prune, step 6).
- Test: `config/scripts/relay-artifact-manifest.test.mjs` (rewritten), the 35 kept `src/relay/*.test.ts`, `src/main/agent-hooks/*.test.ts`, `src/main/shell-wrapper-generated-file-snapshot.test.ts`, `src/shared/child-process/*.test.ts`, `config/scripts/websocket-server-loopback-bind.test.ts` (no `new WebSocketServer(` lives under `src/relay`, so the recognized count is unchanged), `config/scripts/electron-builder-config.test.mjs:165-184` (unchanged: it asserts `out/relay/**` stays out of app.asar and `relayExtraResource` ships `out/relay`; the ignore glob `!out/relay{,/**/*}` still matches the three non-WSL paths at lines 172-174).

**Interfaces:** Consumes the two WSL entries and `src/main/agent-hooks/wsl-hook-relay-launch.ts:40-49` / `src/main/browser/wsl-browser-network-relay-launch.ts:33-42`, which already resolve `<resources>/relay/wsl/wsl-agent-hook-relay.js` and `wsl-browser-network-relay.js` (no edit). Produces `out/relay/wsl/{wsl-agent-hook-relay.js,wsl-browser-network-relay.js,.version,.browser-network-version}` as the only relay artifacts; `config/electron-builder.config.cjs:81-84 relayExtraResource` keeps shipping `out/relay` → `resources/relay` unchanged. Produces `config/scripts/prune-reliability-gates-for-deleted-files.mjs`, reused by B6.2 and B6.3.

- [ ] **Step 1: Re-derive the KEEP set.** Write a closure walker to the scratchpad (follow relative `from '…'`, `import('…')`, `require('…')` specifiers from the two entries, resolving `.ts`, `.tsx`, `/index.ts`) and run it; expected: the 40 non-test relay files above (add any newcomer to KEEP). Then classify every `src/relay/*.test.ts`: keep it if its closure touches no `src/relay` file outside KEEP, no `src/main/ssh` file outside the 15 kept, no `src/main/orcad`, no `src/main/providers/ssh-*` outside the 13 kept; expected: the 35 listed. Write the 75 keep paths to `<scratchpad>/relay-keep.txt`.
- [ ] **Step 2: Delete.** `find src/relay -type f | grep -v -x -F -f <scratchpad>/relay-keep.txt | wc -l` → 339; then `git rm` that list, plus every other path under Delete above.
- [ ] **Step 3: Replace `config/scripts/build-relay.mjs`** with:
  ```js
  #!/usr/bin/env node
  /**
   * Bundle the two WSL guest relays. They run inside a WSL distro via wsl.exe, use
   * only Node built-ins, and ship inside the app through the out/relay extraResource.
   */
  import { build } from 'esbuild'
  import { createHash } from 'node:crypto'
  import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
  import { join } from 'node:path'

  const __dirname = import.meta.dirname
  // Why: the script lives under config/scripts, so go two levels up to reach the repo root.
  const ROOT = join(__dirname, '..', '..')
  // Why: lets the packaging contract test build into a temp tree instead of clobbering out/relay.
  const OUT_ROOT = process.env.ORCA_RELAY_OUT_ROOT ?? join(ROOT, 'out', 'relay')
  const RELAY_VERSION = '0.1.0'

  const WSL_HOOK_ENTRY = join(ROOT, 'src', 'relay', 'wsl-agent-hook-relay.ts')
  const WSL_BROWSER_NETWORK_ENTRY = join(ROOT, 'src', 'relay', 'wsl-browser-network-relay.ts')

  async function bundleWslRelay(entry, outfile) {
    await build({
      entryPoints: [entry],
      bundle: true,
      platform: 'node',
      target: 'node18',
      format: 'cjs',
      outfile,
      sourcemap: false,
      minify: true,
      define: { 'process.env.NODE_ENV': '"production"' }
    })
    return createHash('sha256').update(readFileSync(outfile)).digest('hex').slice(0, 12)
  }

  const outDir = join(OUT_ROOT, 'wsl')
  // Why: a stale per-platform SSH relay tree from an earlier checkout must not ship beside the WSL bundles.
  rmSync(OUT_ROOT, { recursive: true, force: true })
  mkdirSync(outDir, { recursive: true })

  const hookHash = await bundleWslRelay(WSL_HOOK_ENTRY, join(outDir, 'wsl-agent-hook-relay.js'))
  writeFileSync(join(outDir, '.version'), `${RELAY_VERSION}+${hookHash}`)
  console.log(`Built WSL hook relay → ${outDir}/wsl-agent-hook-relay.js`)

  const browserNetworkHash = await bundleWslRelay(
    WSL_BROWSER_NETWORK_ENTRY,
    join(outDir, 'wsl-browser-network-relay.js')
  )
  writeFileSync(join(outDir, '.browser-network-version'), `${RELAY_VERSION}+${browserNetworkHash}`)
  console.log(`Built WSL browser network relay → ${outDir}/wsl-browser-network-relay.js`)

  console.log('Relay build complete.')
  ```
  `src/shared/relay-artifacts.ts` stays on disk until B6.2 (eight `src/main/ssh` files still import it); this script simply stops importing it.
- [ ] **Step 4: Rewrite `config/scripts/relay-artifact-manifest.test.mjs`** (failing first: it currently iterates `RELAY_BUILD_PLATFORMS`): keep the `beforeAll` that runs `node config/scripts/build-relay.mjs` with `ORCA_RELAY_OUT_ROOT=<mkdtemp>`; assert `readdirSync(root)` deep-equals `['wsl']`; assert `readdirSync(join(root, 'wsl')).sort()` deep-equals `['.browser-network-version', '.version', 'wsl-agent-hook-relay.js', 'wsl-browser-network-relay.js']`; assert each version file matches `/^0\.1\.0\+[0-9a-f]{12}$/` and equals `0.1.0+` + the first 12 hex chars of the sha256 of its bundle; delete every `relay-artifacts.ts` import. Run `pnpm test config/scripts/relay-artifact-manifest.test.mjs` — expected: pass after step 3.
- [ ] **Step 5: Apply the Modify list** (tsconfig, knip, allowlist, both child-process fixtures, the nine test files, vitest performance config, `pr-code-change-scope.mjs`, workflows). Run `pnpm check:max-lines-ratchet --prune`.
- [ ] **Step 6: Reliability gates.** Create `config/scripts/prune-reliability-gates-for-deleted-files.mjs`: read `config/reliability-gates.jsonc` with `jsonc-parser` (`parseTree`/`modify`/`applyEdits` so comments survive); for each gate drop `testFiles` entries whose path does not exist on disk, drop `assertionRefs` whose `file` is no longer in `testFiles`, drop `commands` that name a missing path, drop `evidenceRuns` whose `command` is no longer in `commands`; delete any gate whose `testFiles` becomes empty; never touch `providers`/`coveredProviders`; print the gate ids it changed. Run it, then `pnpm run check:reliability-gates` — expected: clean. Gates touched by this task's deletions: `ssh-relay.staged-upload-recovery` (every test gone → gate deleted), `relay-performance.ai-vault-ready-ownership`, `agent-session.spawn-workspace-trust`, `terminal-session.shell-ready-exec-prompt-fallback`, `git-worktree.refresh-event-semantics`, `terminal-performance.output-backpressure-budget`, `runtime-files.watcher-process-isolation`, `skill-upload.cross-process-staging-ownership`, `ssh.localhost-terminal-agent-hooks` (plus any other gate the script reports).
- [ ] **Step 7: Verify.** `pnpm run build:relay` — expected: the two "Built WSL…" lines and `ls out/relay` → `wsl`. `pnpm tc` — expected: green. `pnpm test src/relay src/main/agent-hooks src/main/ssh src/main/git src/main/ipc/worktree-push-target-cleanup.test.ts src/main/ipc/worktree-push-target-reconciliation.test.ts src/main/plugins src/main/runtime/runtime-file-path-existence.test.ts src/main/ai-vault-search src/main/shell-wrapper-generated-file-snapshot.test.ts src/shared/child-process config/scripts/relay-artifact-manifest.test.mjs config/scripts/electron-builder-config.test.mjs config/scripts/websocket-server-loopback-bind.test.ts config/scripts/check-local-only.test.mjs tests/tools` — expected: pass (`child-process-import-boundary.test.ts` "no stale allowlist entry" passes only once the 13 relay rows are gone). `pnpm run check:code-quality:changed`, `pnpm run check:local-only`, `pnpm run check:reliability-gates` — expected: clean.
- [ ] **Step 8: Commit:**
  ```
  refactor(local-only): remove the SSH relay daemon and build only the WSL relays

  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01PskLbdTqJNXxJ7KRnDoDoD
  ```

### Task B6.2: Stub the four SSH registries, then remove the SSH connection, provider, handler, forwarding and browser-tunnel layers

**Files:**
- Create: `src/shared/local-only-unsupported-error.ts`, `src/shared/local-only-unsupported-error.test.ts`, `src/main/ssh/ssh-target-registry.test.ts`.
- Modify (full rewrite of SSH-only files, allowed by the seam rule): `src/main/providers/ssh-git-dispatch.ts`, `src/main/providers/ssh-filesystem-dispatch.ts`, `src/main/ssh/ssh-target-registry.ts`, `src/main/ipc/ssh.ts`; test rewrites `src/main/providers/ssh-git-dispatch.test.ts`, `src/main/providers/ssh-filesystem-dispatch.test.ts`, `src/main/ipc/ssh.test.ts`.
- Delete (src/main/ssh): the 197 non-test files not in the 15-file KEEP list — `ssh-connection*.ts`, `ssh-config-*.ts`, `ssh-host-key-*.ts`, `ssh-known-hosts*.ts`, `ssh-keyboard-interactive*.ts`, `ssh-private-key-authentication.ts`, `ssh-agent-identity-filter*.ts`, `ssh-reconnect-*.ts`, `ssh-port-forward*.ts`, `ssh2-port-forward-provider.ts`, `ssh-port-scanner*.ts`, `ssh-proxy-command*.ts`, `system-ssh-*.ts`, `sftp-*.ts`, `ssh-hostile-host-*.ts`, `ssh-windows-host-cells.ts`, `ssh-remote-*.ts` except `ssh-remote-platform.ts`, `ssh-relay-*.ts`, `relay-*.ts` except `relay-protocol.ts`, `remote-install-*.ts`, `remote-node-runtime-store-*.ts`, `orcad-*.ts` (if B3 left any), `pinned-runtime-materializer.ts`, `runtime-archive-download.ts`, `build-toolchain-diagnosis.ts`, `ssh-plain-ssh-*.ts`, `ssh-pty-*.ts`, `ssh-owner-*.ts`, `ssh-orphan-relay-pty-sweep.ts`, `ssh-pending-pty-kill-replay.ts`, `ssh-transport-*.ts`, `ssh-upload-session-lifetime.ts`, `ssh-security-key-identity.ts`, `ssh-session-*.ts`, `ssh-login-shell-command.ts`, `ssh-g-config-resolution.ts`, `ssh-exec-stdin-file-transfer.ts`, `ssh-file-transfer-abort.ts`, `ssh-forward-channel-lifetime.ts`, `ssh-channel-open.ts`, `ssh-control-socket.ts`, `ssh-target-readoption.ts`, `vscode-ssh-authority.ts`, `__tests__/ssh-connection-test-client.ts` — and every `src/main/ssh/*.test.ts` / `*.docker.test.ts` / `*.integration.test.ts` not in the 16-test KEEP list (including `ssh-orphan-sweep-pane-state-verdicts.test.ts`, `ssh-remote-runtime-telemetry.test.ts`, `ssh-config-loader-regression.test.ts`).
- Delete (providers): `src/main/providers/ssh-*.ts` not in the 13 kept — `ssh-agent-session-*.ts ssh-capability-probe-waiter.ts ssh-filesystem-doc-preview.ts ssh-filesystem-download.ts ssh-filesystem-file-upload.ts ssh-filesystem-path-existence.ts ssh-filesystem-provider-capabilities.ts ssh-filesystem-provider-sftp.ts ssh-filesystem-provider-watch.ts ssh-filesystem-provider.ts ssh-filesystem-range-read.ts ssh-filesystem-terminal-artifact.ts ssh-filesystem-watch-notifications.ts ssh-plain-shell-pty-provider.ts ssh-pty-applied-size.ts ssh-pty-notification-routing.ts ssh-pty-provider-contract.ts ssh-pty-provider-mock-multiplexer.ts ssh-pty-provider-output-state.ts ssh-pty-provider-rpc-operations.ts ssh-pty-provider.ts ssh-pty-session-reattach.ts ssh-pty-source-delivery-ledger.ts ssh-pty-source-delivery-state.ts ssh-pty-source-frame.ts ssh-pty-spawn-env.ts ssh-pty-spawn-exit-race.ts ssh-pty-spawn-repair.ts ssh-pty-spawn-request.ts ssh-pty-write.ts ssh-sftp-filesystem-provider.ts` — and their tests (`ssh-filesystem-*.test.ts`, `ssh-pty-*.test.ts`, `ssh-plain-shell-pty-provider.test.ts`, `ssh-sftp-filesystem-provider.test.ts`).
- Delete (ipc handler and transport layer): `src/main/ipc/ssh-active-relay-sessions.ts ssh-advertised-url-refresh.ts ssh-browse.ts ssh-connect-attempt-registry.ts ssh-connect-flow.ts ssh-connection-handlers.ts ssh-connection-state-callbacks.ts ssh-host-sleep-reconnect.ts ssh-ipc-context.ts ssh-ipc-mock-shapes.ts ssh-ipc-module-mocks.ts ssh-ipc-test-harness.ts ssh-passphrase.ts ssh-port-forward-handlers.ts ssh-port-forward-persistence.ts ssh-relay-lost-backoff.ts ssh-relay-session-callbacks.ts ssh-renderer-broadcast.ts ssh-session-teardown.ts ssh-shutdown-drain.ts ssh-target-crud-handlers.ts ssh-target-lifecycle-queue.ts filesystem-import-ssh.ts filesystem-import-ssh-directory.ts` and tests `ssh-active-relay-sessions.test.ts ssh-app-shutdown.test.ts ssh-browse.test.ts ssh-disconnect-cancellation.test.ts ssh-handler-reregistration.test.ts ssh-host-partition-session-export.test.ts ssh-host-sleep-reconnect.test.ts ssh-passphrase.test.ts ssh-plain-ssh-connect.test.ts ssh-pty-consumer-identity.test.ts ssh-relay-reset-resume.test.ts ssh-state-broadcast-fanout.test.ts ssh-target-registry.test.ts ssh-terminate-sessions.test.ts filesystem-import-ssh-ops.test.ts filesystem-import-ssh-path-safety.test.ts filesystem-import-ssh.test.ts preflight-remote-ssh.test.ts`; `src/main/ports/ssh-advertised-url-enrichment.ts` + `.test.ts`; `src/main/runtime/rpc/methods/ssh.ts` + `ssh.test.ts`; `src/shared/rpc-contract/ssh-params.ts`.
- Delete (browser tunnels and SOCKS): `src/main/browser/ssh-browser-network-execution-route.ts local-ssh-browser-route.ts local-ssh-browser-partitions.ts remote-browser-socks-server.ts remote-browser-socks-upstream.ts system-ssh-socks-client-socket.ts execution-route-socket-duplex.ts browser-route-tcp-egress-socks-recorder.ts` and tests `ssh-browser-network-execution-route.test.ts local-ssh-browser-route.test.ts local-ssh-browser-partition-identity.test.ts local-ssh-browser-partitions.probe-cache.test.ts remote-browser-socks-buffering.test.ts remote-browser-socks-server.test.ts system-ssh-socks-client-socket.test.ts execution-route-socket-duplex.test.ts`; `tests/e2e/ssh-browser-network-execution-route.docker.unit.test.ts`, `tests/e2e/direct-ssh-snapshot-parking.unit.test.ts` (both run under `pnpm test` through `tests/e2e/**/*.unit.test.ts`).
- Delete (shared): `src/shared/relay-artifacts.ts`, `src/shared/relay-optional-artifacts.test.ts`, `src/shared/relay-windows-breakaway-launch.ts`, `src/shared/relay-runtime-self-test-report.ts` (their last importers are the `src/main/ssh` files deleted here), `src/shared/telemetry-ssh-runtime-event-schemas.ts`, `src/shared/ssh-relay-pty-ownership-proof.ts` + `.test.ts`. `src/shared/ssh-ai-vault-relay.ts` stays (the `ipc/ssh.ts` stub imports its types).
- Modify (line deletions, plus the two fail-closed replacements marked ★):
  - `src/main/startup/main-process-ready-foundation.ts:18` (`import { initSshHostKeyStoreFile } …`), `:179-182` (comment + `initSshHostKeyStoreFile(profile.dataFile)`). Lines 273-281 (`listLocalSshTargetIds`) stay: they read the persistence `Store` (B7) and `browser-route-partition-storage-runtime.ts` is kept.
  - `src/main/startup/main-process-quit.ts:7` (`import { beginSshShutdown } …`), `:175-179` (comment + `const localSshRouteShutdown = import('../browser/local-ssh-browser-route')…`), `:183-185` (comment + `const sshShutdown = beginSshShutdown()`), `:243-244` (the `local-ssh-browser-routes` and `ssh` rows of the teardown list).
  - ★ `src/main/browser/browser-network-execution-route-dispatch.ts:24-37`: delete the SSH branch (`const [{ getSshConnectionManager }, authority, sshRoute] = await Promise.all([…])` through `return sshRoute.resolveSshBrowserNetworkExecutionRoute(…)`) and put in its place
    ```ts
    // Why: no other execution-host kind can be tunnelled in this build; fail closed, never route locally (I4).
    throw new LocalOnlyUnsupportedError('ssh', `browser tunnel for ${context.executionHost.kind}`)
    ```
    add `import { LocalOnlyUnsupportedError } from '../../shared/local-only-unsupported-error'` after line 4, and delete the doc-comment sentences at lines 9-12 that describe the SSH stack. The file is runtime-bundled; the new import is electron-free.
  - `src/main/ipc/browser.ts:100-134`: delete the whole `ipcMain.handle('browser:prepareSshWorkspacePartition', …)` registration, from the `// Why: an SSH workspace's page …` comment at 100 through the closing `)` at 134 (re-check the range: it ends just before `ipcMain.handle('browser:repairGuestRegistration'` at 136).
  - `src/main/window/main-window-webview-security.ts:8-10` (delete `enforceLocalSshWebRtcPolicyForGuest,` and `isLocalSshBrowserPartition` and, now empty, the whole `import { … } from '../browser/local-ssh-browser-partitions'`), `:72-75` (comment + `const isLocalSshPartition = isLocalSshBrowserPartition(partition)`), `:82` (delete the ` && !isLocalSshPartition` term, leaving `(!isProfilePartition && !isRoutePartition)`), `:128-129` (comment + `enforceLocalSshWebRtcPolicyForGuest(guest)`). In `main-window-webview-security.test.ts` delete the `../browser/local-ssh-browser-partitions` mock and the direct-SSH partition cases.
  - `src/main/ipc/shell.ts:17` (`resolveVsCodeRemoteSshLaunchSpec` in the import block), `:19` (`import { resolveVsCodeSshAuthority } …`), `:81-105` (`const connectionId = request.connectionId?.trim()` and the whole `if (connectionId) { … }` arm). Then `src/main/external-editor-launch.ts:218-246` (`export function resolveVsCodeRemoteSshLaunchSpec(…)` — now unused). Keep `isVsCodeLauncherExecutable` (`:107`, Windows launcher detection) and `src/shared/vscode-remote-ssh-launcher.ts` (renderer importer; part 2).
  - `src/main/automations/precheck-runner.ts:2` (`import type { ClientChannel } from 'ssh2'`), `:5` (`import { getSshConnectionManager } from '../ipc/ssh'`), `:6` (`import { shellEscape } from '../ssh/ssh-connection-utils'`), `:197-252` (`function runSshChannelPrecheck(…)`), `:254-275` (`async function runSshPrecheck(…)`). Keep the `| { type: 'ssh'; cwd: string; connectionId: string }` union member at `:14-18` (`automations/service.ts:199` still builds it from a persisted `executionTargetId`; B7 strips those rows; the member is inert like `ExecutionHostKind`). ★ Replace the dispatch body at `:281-283` with
    ```ts
    if (args.target.type === 'ssh') {
      // Why: SSH targets are unsupported in this build; a precheck that cannot run must fail, never run locally (I4).
      return failedPrecheckResult(args.precheck, Date.now(), 'SSH targets are unsupported in this build.')
    }
    ```
    In `precheck-runner.test.ts` delete the `../ipc/ssh` mock and the SSH execution cases; add one case asserting an `{ type: 'ssh', … }` target yields a failed result carrying that message.
  - ★ `src/main/ipc/filesystem-mutations.ts:9` (`import { importExternalPathsSsh } …`); add `import { LocalOnlyUnsupportedError } from '../../shared/local-only-unsupported-error'`; in `fs:importExternalPaths` replace the arm body at `:166-177` so it reads `if (args.connectionId) { throw new LocalOnlyUnsupportedError('ssh', 'fs:importExternalPaths') }`; in `fs:resolveDroppedPathsForAgent` keep the `if (args.connectionId == null) { return { … } }` block at `:279-285` and replace everything after it up to the handler's closing brace (the `worktreePath`/`destDir`/`importExternalPathsSsh` upload path from `:286`) with `throw new LocalOnlyUnsupportedError('ssh', 'fs:resolveDroppedPathsForAgent')`. Keep every `assertSshMutationExpectation` call (kept module). In `filesystem-mutations.test.ts` delete the `./filesystem-import-ssh` mock and the SSH import cases.
  - `src/main/automations/external-automation-owner-guard.ts:26` (`import { isRuntimeOwnedSshTarget } from '../ssh/ssh-connection-store'`), `:52-55` (comment + `if (isRuntimeOwnedSshTarget(target)) { throw … }`; VM-owned targets left with B1).
  - `src/shared/telemetry-event-registry.ts:99` (`import { sshRemoteRuntimeResolvedSchema } …`), `:201` (`ssh_remote_runtime_resolved: sshRemoteRuntimeResolvedSchema,`); `src/main/ipc/telemetry.ts:34` (`'ssh_remote_runtime_resolved'`). Lines 33/200 (`direct_ssh_reconnect_operation`) are renderer reconnect telemetry — part 2.
  - `src/main/runtime/rpc/methods/index.ts:26` (`import { SSH_METHODS } from './ssh'`), `:75` (`...SSH_METHODS,`); then `pnpm run generate:rpc-params-catalog` (drops the five `ssh.*` rows and the `./ssh-params` import from `src/shared/rpc-contract/rpc-params-catalog.generated.ts`). `src/cli/runtime/client.ts:84 call<TResult>(method: string, …)` is string-typed, so the CLI's `'ssh.listTargetSummaries'` strings (part 2) keep compiling.
  - `config/scripts/check-runtime-launcher-protocol-ratchet.mjs:14-16,24` (`src/main/ssh/pinned-runtime-materializer.ts`, `runtime-archive-download.ts`, `orcad-remote-node-runtime.ts`, `orcad-remote-runtime.ts` rows — cut whatever B3/B4 left) and the matching rows in `check-runtime-launcher-protocol-ratchet.test.mjs`.
  - `src/shared/child-process/__fixtures__/child-process-import-allowlist.txt:132-139` (8 `src/main/ssh/*` rows); `src/shared/child-process/__fixtures__/windows-console-visibility-allowlist.txt:40` (`main/ssh/ssh-connection.ts`).
  - `config/max-lines-baseline.txt` and `config/ts-nocheck-baseline.txt`: `pnpm check:max-lines-ratchet --prune`, `pnpm check:ts-nocheck-ratchet --prune` (ts-nocheck rows 54, 66, 165 name kept files and stay).
  - `config/scripts/ci-shard-timings.json`: drop keys whose path no longer exists (`node -e` over `Object.keys`, filter by `existsSync`).
  - `.github/workflows/computer-e2e.yml:48-49,90` (`ssh-remote-cli-launcher` rows); `.github/workflows/pr.yml:1003-1004` (`src/main/ssh/ssh-relay-upload-stage-windows-identity.test.ts`, `src/main/ssh/remote-node-runtime-store-windows.test.ts`); `config/scripts/pr-code-change-scope.mjs:294-295` (same two paths); `config/scripts/wsl-e2e-lane-contract.test.mjs:35` (replace the probe path `'src/main/ssh/connection.ts'` with `'src/main/providers/local-pty-provider.ts'`: the case only needs a non-WSL unit-only path).
  - `config/reliability-gates.jsonc`: run `node config/scripts/prune-reliability-gates-for-deleted-files.mjs` (from B6.1).
- Test (new): the three created test files; one added case in `src/main/ipc/filesystem-mutations.test.ts` and one in `src/main/browser/browser-network-execution-route.test.ts`.

**Interfaces:** Consumes `SshGitProvider` (kept class), `IFilesystemProvider` (`providers/types.ts`), `SshConnectionState`/`SshTarget` (`shared/ssh-types.ts`, kept inert; 188 importers), `SshChannelMultiplexer` (kept), `SshAiVaultRelayListParams`/`SshAiVaultRelayTitleParams` (`shared/ssh-ai-vault-relay.ts`), `RemoteHostPlatform` (`ssh/ssh-remote-platform.ts`), `ExecutionHostId` (`shared/execution-host.ts`, unions untouched). Produces `LocalOnlyUnsupportedError`; stub exports `getSshGitProvider → undefined`, `getSshGitProviderGeneration → 0`, `requireSshGitProvider → throws`, `registerSshGitProvider → throws`, `unregisterSshGitProvider → no-op`, `SSH_GIT_PROVIDER_UNAVAILABLE_MESSAGE`; `getSshFilesystemProvider → undefined`, `requireSshFilesystemProvider → throws`, `registerSshFilesystemProvider → throws`, `unregisterSshFilesystemProvider → no-op`, `onSshFilesystemProviderRegistered → () => {}`, `SSH_FILESYSTEM_PROVIDER_UNAVAILABLE_MESSAGE`; `getRegisteredSshState → undefined`, `listRegisteredSshTargets → []`, `listRegisteredRemovedSshTargetLabels → {}`, `getActiveMultiplexer → undefined`, `connectRegisteredSshTarget → rejects`; `getActiveSshAiVaultHostInfo → null`, `getActiveSshAiVaultHostInfos → []`, `requestActiveSsh{SessionSearch,AiVaultSessionList,AiVaultSessionTitles} → rejects`, `registerSshHandlers → no-op`, `resetSshHandlerStateForTests → resolves`, `SshRelayAiVaultHostInfo` type. After this task: no runtime `ssh2` import under `src/` (`grep -rn "from 'ssh2'" src --include='*.ts' | grep -v "import type"` → empty); no `ipcMain.handle('ssh:` channel; no `ssh.*` RPC method; no `.listen(` in `src/main/ssh` or `src/main/browser` outside `cdp-ws-proxy.ts` and the `browser-route-*-fixture.ts` test fixtures.

- [ ] **Step 1: Re-derive the delete sets** (line numbers above may be stale): `ls src/main/ssh | grep -v -x -F -f <keep-15-plus-16-tests>`; `ls src/main/providers/ssh-* | grep -v -x -F -f <keep-13-plus-their-tests>`; the ipc/browser/ports/shared lists above. For every candidate confirm no survivor imports it: `grep -rln "/<basename>'" src tests config --include='*.ts' --include='*.tsx' --include='*.mjs' | grep -v -x -F -f <delete-list>` must print nothing or only files in the Modify list. Any other hit is a missed edit — resolve it before deleting (add an export to a stub, or add the file to the delete list if it is SSH-only).
- [ ] **Step 2: Failing error test.** Create `src/shared/local-only-unsupported-error.test.ts`:
  ```ts
  import { describe, expect, it } from 'vitest'
  import {
    LOCAL_ONLY_UNSUPPORTED_CODE,
    LocalOnlyUnsupportedError,
    isLocalOnlyUnsupportedError
  } from './local-only-unsupported-error'

  describe('LocalOnlyUnsupportedError', () => {
    it('carries a stable code, the capability and the operation', () => {
      const error = new LocalOnlyUnsupportedError('ssh', 'requireSshGitProvider(t1)')
      expect(error.code).toBe(LOCAL_ONLY_UNSUPPORTED_CODE)
      expect(error.capability).toBe('ssh')
      expect(error.message).toBe('ssh is unsupported in this build (requireSshGitProvider(t1))')
      expect(error.name).toBe('LocalOnlyUnsupportedError')
      expect(isLocalOnlyUnsupportedError(error)).toBe(true)
      expect(isLocalOnlyUnsupportedError(new Error('x'))).toBe(false)
    })
  })
  ```
  `pnpm test src/shared/local-only-unsupported-error.test.ts` — expected: module not found.
- [ ] **Step 3: Create `src/shared/local-only-unsupported-error.ts`** (if B5 already created this exact path, keep theirs and confirm it exports these names):
  ```ts
  export const LOCAL_ONLY_UNSUPPORTED_CODE = 'unsupported_in_local_only_build' as const

  export type LocalOnlyUnsupportedCapability = 'ssh' | 'runtime'

  // Why: invariant I4 — a legacy `ssh:`/`runtime:` value reaching a seam fails closed and never falls back to local.
  export class LocalOnlyUnsupportedError extends Error {
    readonly code = LOCAL_ONLY_UNSUPPORTED_CODE

    constructor(
      readonly capability: LocalOnlyUnsupportedCapability,
      readonly operation: string
    ) {
      super(`${capability} is unsupported in this build (${operation})`)
      this.name = 'LocalOnlyUnsupportedError'
    }
  }

  export function isLocalOnlyUnsupportedError(error: unknown): error is LocalOnlyUnsupportedError {
    return error instanceof LocalOnlyUnsupportedError
  }
  ```
  Re-run — expected: pass.
- [ ] **Step 4: Failing stub tests.** Replace `src/main/providers/ssh-git-dispatch.test.ts` with:
  ```ts
  import { describe, expect, it } from 'vitest'
  import { isLocalOnlyUnsupportedError } from '../../shared/local-only-unsupported-error'
  import type { SshGitProvider } from './ssh-git-provider'
  import {
    getSshGitProvider,
    getSshGitProviderGeneration,
    registerSshGitProvider,
    requireSshGitProvider,
    unregisterSshGitProvider
  } from './ssh-git-dispatch'

  describe('ssh-git-dispatch (local-only stub)', () => {
    it('never resolves a provider for any connection id', () => {
      expect(getSshGitProvider('target-1')).toBeUndefined()
      expect(getSshGitProviderGeneration('target-1')).toBe(0)
    })

    it('fails closed on require', () => {
      expect(() => requireSshGitProvider('target-1')).toThrow(
        expect.objectContaining({ code: 'unsupported_in_local_only_build', capability: 'ssh' })
      )
    })

    it('refuses registration so no producer can reintroduce SSH git', () => {
      // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the stub never dereferences the provider; this only proves registration is refused.
      const provider = {} as SshGitProvider
      let caught: unknown
      try {
        registerSshGitProvider('target-1', provider)
      } catch (error) {
        caught = error
      }
      expect(isLocalOnlyUnsupportedError(caught)).toBe(true)
      expect(getSshGitProvider('target-1')).toBeUndefined()
      expect(() => unregisterSshGitProvider('target-1')).not.toThrow()
    })
  })
  ```
  Replace `src/main/providers/ssh-filesystem-dispatch.test.ts` with the same three cases against `getSshFilesystemProvider`, `requireSshFilesystemProvider`, `registerSshFilesystemProvider`, `unregisterSshFilesystemProvider`, plus `expect(typeof onSshFilesystemProviderRegistered(() => {})).toBe('function')` and that the listener is never invoked. Create `src/main/ssh/ssh-target-registry.test.ts`: `getRegisteredSshState('t1')` is `undefined`, `listRegisteredSshTargets()` deep-equals `[]`, `listRegisteredRemovedSshTargetLabels()` deep-equals `{}`, `getActiveMultiplexer('t1')` is `undefined`, `await expect(connectRegisteredSshTarget('t1')).rejects.toMatchObject({ code: 'unsupported_in_local_only_build' })`. Replace `src/main/ipc/ssh.test.ts` with: `getActiveSshAiVaultHostInfo('t1')` is `null`; `getActiveSshAiVaultHostInfos()` deep-equals `[]`; each `requestActiveSsh*` rejects with `code: 'unsupported_in_local_only_build'`; with `vi.mock('electron', () => ({ ipcMain: { handle: vi.fn(), removeHandler: vi.fn() } }))`, `registerSshHandlers(store, () => null)` leaves `ipcMain.handle` uncalled; `resetSshHandlerStateForTests()` resolves. Run the four — expected: all fail against the real modules.
- [ ] **Step 5: Write the stubs.** `src/main/providers/ssh-git-dispatch.ts`:
  ```ts
  import { LocalOnlyUnsupportedError } from '../../shared/local-only-unsupported-error'
  import type { SshGitProvider } from './ssh-git-provider'

  // Why a stub: the SSH connection layer is removed, so no git provider is ever registered. The ~40
  // `if (connectionId)` callers keep compiling; every arm resolves to "unavailable" and never to local (I4).
  export const SSH_GIT_PROVIDER_UNAVAILABLE_MESSAGE =
    'Remote connection dropped. Click Reconnect on the SSH target before retrying.'

  export function registerSshGitProvider(connectionId: string, _provider: SshGitProvider): never {
    throw new LocalOnlyUnsupportedError('ssh', `registerSshGitProvider(${connectionId})`)
  }

  export function unregisterSshGitProvider(_connectionId: string): void {}

  export function getSshGitProviderGeneration(_connectionId: string): number {
    return 0
  }

  export function getSshGitProvider(_connectionId: string): SshGitProvider | undefined {
    return undefined
  }

  export function requireSshGitProvider(connectionId: string): SshGitProvider {
    throw new LocalOnlyUnsupportedError('ssh', `requireSshGitProvider(${connectionId})`)
  }
  ```
  (The message text is kept verbatim: 39 callers embed it in result objects and tests assert on it.) `src/main/providers/ssh-filesystem-dispatch.ts`:
  ```ts
  import { LocalOnlyUnsupportedError } from '../../shared/local-only-unsupported-error'
  import type { IFilesystemProvider } from './types'

  export const SSH_FILESYSTEM_PROVIDER_UNAVAILABLE_MESSAGE =
    'Remote connection dropped. Click Reconnect on the SSH target before retrying.'

  // Why kept: filesystem-watcher-handlers.ts subscribes at registration; a no-op unsubscribe leaves that file untouched.
  export function onSshFilesystemProviderRegistered(
    _listener: (connectionId: string) => void
  ): () => void {
    return () => {}
  }

  export function registerSshFilesystemProvider(
    connectionId: string,
    _provider: IFilesystemProvider
  ): never {
    throw new LocalOnlyUnsupportedError('ssh', `registerSshFilesystemProvider(${connectionId})`)
  }

  export function unregisterSshFilesystemProvider(_connectionId: string): void {}

  export function getSshFilesystemProvider(_connectionId: string): IFilesystemProvider | undefined {
    return undefined
  }

  export function requireSshFilesystemProvider(connectionId: string): IFilesystemProvider {
    throw new LocalOnlyUnsupportedError('ssh', `requireSshFilesystemProvider(${connectionId})`)
  }
  ```
  `src/main/ssh/ssh-target-registry.ts`:
  ```ts
  import type { SshConnectionState, SshTarget } from '../../shared/ssh-types'
  import type { SshChannelMultiplexer } from './ssh-channel-multiplexer'
  import { LocalOnlyUnsupportedError } from '../../shared/local-only-unsupported-error'

  // Why a stub: no SSH target can be registered or connected in this build. Readers
  // (agent-detection, client-events, orca-runtime-*, nested-repo-*, remote-repo-*) keep compiling.
  export function connectRegisteredSshTarget(targetId: string): Promise<SshConnectionState> {
    return Promise.reject(
      new LocalOnlyUnsupportedError('ssh', `connectRegisteredSshTarget(${targetId})`)
    )
  }

  export function getRegisteredSshState(_targetId: string): SshConnectionState | undefined {
    return undefined
  }

  export function listRegisteredSshTargets(): SshTarget[] {
    return []
  }

  export function listRegisteredRemovedSshTargetLabels(): Record<string, string> {
    return {}
  }

  export function getActiveMultiplexer(_connectionId: string): SshChannelMultiplexer | undefined {
    return undefined
  }
  ```
  (`setSshTargetRegistryStore`, `getSshTargetRegistryStore`, `setSshTargetRegistryHandlers`, `setSshActiveMultiplexerResolver`, `setSshConnectionManagerResolver`, `getSshConnectionManager` have no callers once the ipc transport files are deleted in step 7; `pnpm tc` proves it.) `src/main/ipc/ssh.ts`:
  ```ts
  import type { BrowserWindow } from 'electron'
  import type { Store } from '../persistence'
  import type { OrcaRuntimeService } from '../runtime/orca-runtime'
  import type { ExecutionHostId } from '../../shared/execution-host'
  import type { RemoteHostPlatform } from '../ssh/ssh-remote-platform'
  import type {
    SshAiVaultRelayListParams,
    SshAiVaultRelayTitleParams
  } from '../../shared/ssh-ai-vault-relay'
  import { LocalOnlyUnsupportedError } from '../../shared/local-only-unsupported-error'

  // Why re-exported: ai-vault, nested-repo and precheck callers import the registry through this module.
  export {
    connectRegisteredSshTarget,
    getActiveMultiplexer,
    getRegisteredSshState,
    listRegisteredRemovedSshTargetLabels,
    listRegisteredSshTargets
  } from '../ssh/ssh-target-registry'

  export type SshRelayAiVaultHostInfo = {
    targetId: string
    executionHostId: ExecutionHostId
    remoteHome: string
    hostPlatform: RemoteHostPlatform
  }

  export function getActiveSshAiVaultHostInfo(_targetId: string): SshRelayAiVaultHostInfo | null {
    return null
  }

  export function getActiveSshAiVaultHostInfos(): SshRelayAiVaultHostInfo[] {
    return []
  }

  export function requestActiveSshSessionSearch(
    targetId: string,
    method: string,
    _params: unknown
  ): Promise<unknown> {
    return Promise.reject(
      new LocalOnlyUnsupportedError('ssh', `requestActiveSshSessionSearch(${targetId}, ${method})`)
    )
  }

  export function requestActiveSshAiVaultSessionList(
    targetId: string,
    _params: SshAiVaultRelayListParams,
    _options: { signal?: AbortSignal; timeoutMs?: number } = {}
  ): Promise<unknown> {
    return Promise.reject(
      new LocalOnlyUnsupportedError('ssh', `requestActiveSshAiVaultSessionList(${targetId})`)
    )
  }

  export function requestActiveSshAiVaultSessionTitles(
    targetId: string,
    _params: SshAiVaultRelayTitleParams,
    _options: { signal?: AbortSignal; timeoutMs?: number } = {}
  ): Promise<unknown> {
    return Promise.reject(
      new LocalOnlyUnsupportedError('ssh', `requestActiveSshAiVaultSessionTitles(${targetId})`)
    )
  }

  // Why a no-op with the upstream signature: the 17 `ssh:*` channels and `ssh:submitCredential` left with
  // the connection manager; keeping the call at attach-main-window-services.ts:116 leaves that file untouched.
  export function registerSshHandlers(
    _store: Store,
    _getMainWindow: () => BrowserWindow | null,
    _runtime?: OrcaRuntimeService
  ): void {}

  export function resetSshHandlerStateForTests(): Promise<void> {
    return Promise.resolve()
  }
  ```
  (`getSshConnectionStore` is dropped on purpose: its callers are `ipc/browser.ts:116`, deleted below, `ipc/remote-workspace*.ts` (B5) and `ephemeral-vm-runtime-ssh.ts` (B1).) Run the four stub tests — expected: pass.
- [ ] **Step 6: Failing fail-closed tests.** In `src/main/ipc/filesystem-mutations.test.ts` add a case that invokes the `fs:importExternalPaths` handler with `connectionId: 'ssh-1'` and asserts rejection with `code: 'unsupported_in_local_only_build'`; in `src/main/browser/browser-network-execution-route.test.ts` add a case that `resolveBrowserNetworkExecutionRoute` (from `./browser-network-execution-route-dispatch`) rejects with the typed error for `executionHost.kind === 'ssh'`. Run both — expected: fail (today they route to SSH).
- [ ] **Step 7: `git rm`** every path under Delete (sets re-derived in step 1).
- [ ] **Step 8: Apply the Modify list** in this order: rpc index + catalog regen; startup files; browser dispatch, `ipc/browser.ts`, webview security; `shell.ts` + `external-editor-launch.ts`; `precheck-runner.ts`; `filesystem-mutations.ts`; `external-automation-owner-guard.ts`; telemetry registry + `ipc/telemetry.ts`; ratchet files, fixtures, workflows, `ci-shard-timings.json`.
- [ ] **Step 9: `pnpm tc`.** Expected: green. Triage any residual error: an SSH-named file whose importers are all deleted → delete it and record it in the commit body; any other file → it imports a dropped export: add the export back to the matching stub rather than editing the caller, unless the symbol is a class the caller instantiates, in which case delete the caller's whole SSH arm.
- [ ] **Step 10: Persistence test mocks.** 45 `src/main/persistence-*.test.ts` plus `active-view-persistence-boundary.test.ts`, `quit-path-durable-write-blocking.test.ts`, `automations/automation-worker-durability.test.ts`, `ipc/orca-profiles-switch-persistence.test.ts`, `runtime/runtime-managed-worktree-metadata-sweep.test.ts`, `worktree-removal-close-records.test.ts`, `worktree-removal-session-partition-fencing.test.ts` carry `vi.mock('./ssh/ssh-config-parser', …)` / `vi.mock('../ssh/ssh-config-parser', …)` (list them with `grep -rln "ssh/ssh-config-parser'" src/main --include='*.test.ts'`). Run `pnpm test src/main/persistence-initial-load.test.ts`: if vitest rejects the unresolvable mock path, delete that `vi.mock(…)` block (3-5 lines) in every listed file; B7 later prunes the `sshTargets` assertions inside them.
- [ ] **Step 11: Run the touched suites:** `pnpm test src/shared/local-only-unsupported-error.test.ts src/main/ssh src/main/providers src/main/ipc src/main/browser src/main/ports src/main/startup src/main/runtime/rpc src/main/automations src/main/window src/shared/telemetry-event-registry.test.ts src/shared/child-process tests/e2e` — expected: the new cases pass; each remaining failure is a test that registers a fake SSH provider through a stub, mocks a deleted module, or asserts SSH routing. Delete SSH-only test files (name contains `ssh`, `remote-repo`, `worktree-remote`, `direct-ssh`, `socks`, or every case needs a registered SSH provider) and prune the SSH `describe`/`it` blocks in mixed files: `ipc/pty-*.test.ts` (18 files from `grep -l registerSshPtyProvider src/main/ipc/pty-*.test.ts`), `ipc/pty/provider/registry-color-query-reply-colors.test.ts`, `ipc/pty/register-without-renderer.test.ts`, `ipc/worktrees/removal/remove-unregistered-worktree-host-home.test.ts`, `repo-worktrees.test.ts`, `repo-icon-autodetect.test.ts`, `repo-git-remote-identity.test.ts`, `providers/provider-dispatch.test.ts`, `providers/execution-host-provider-dispatch.test.ts`, `runtime/orca-runtime-test-{lifecycle,mocks}.spec.ts`, `runtime/orca-runtime-test-mocks/{imported-values,setup}.spec.ts`, the 14 `runtime/orca-runtime-tests/*.spec.ts` that call `registerSshGitProvider` (`ssh-worktree-lifecycle*.spec.ts` ×3 are whole-file deletes), `runtime/{orchestration-worker-workspace-resolution,runtime-file-path-existence,runtime-file-target-execution-host,runtime-git-command-target,runtime-git-target-execution-host,runtime-unregistered-worktree-removal-host-home}.test.ts`, `worktree-{create,removal}-execution-host-route.test.ts`, `window/clipboard-runtime-owned-ssh-paste.test.ts`. Keep every local, folder-workspace and WSL case. Record the pruned files in the commit body.
- [ ] **Step 12: Verify.** `pnpm tc`; step 11's suites plus `pnpm test src/main/agent-hooks src/relay config/scripts/check-runtime-launcher-protocol-ratchet.test.mjs config/scripts/check-max-lines-ratchet.test.mjs config/scripts/check-ts-nocheck-ratchet.test.mjs config/scripts/wsl-e2e-lane-contract.test.mjs`; `pnpm run check:code-quality:changed`; `pnpm run check:local-only` (expected clean; the only `ssh2` specifiers left are `import type`, which B0's rule must exempt); `pnpm run check:runtime-electron-ratchet` (baseline stays empty: `ipc/ssh.ts` and the dispatch import nothing from `electron` at runtime); `pnpm run verify:rpc-params-catalog`; `pnpm run check:reliability-gates` after running the prune script; `grep -rn "\.listen(\|createServer(" src/main/ssh src/main/browser` → only `cdp-ws-proxy.ts` and the `browser-route-*-fixture.ts` fixtures.
- [ ] **Step 13: Commit:**
  ```
  refactor(local-only): stub the SSH registries and remove SSH connections, providers, IPC/RPC and tunnels

  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01PskLbdTqJNXxJ7KRnDoDoD
  ```

### Task B6.3: Prune the SSH test long tail against the Spec A baseline

**Files:**
- Delete / Modify: test files only under `src/main/**`, `src/shared/**`, `src/relay/**` (kept set), chosen by the diff below; no production code.
- Test: the full `pnpm test` run compared with `notes/local-only/after/` (13 known failing files).

**Interfaces:** Consumes the B6.2 tree. Produces a suite whose failing-file set equals the Spec A baseline (no new failing files), and `config/reliability-gates.jsonc` with no row naming a deleted test.

- [ ] **Step 1:** `ORCA_BACKGROUND_LAUNCH=1 pnpm test` bare (cartoon wraps it); save the failing-file list to `notes/local-only/mid/b6-part1-failing.txt` (gitignored).
- [ ] **Step 2:** For each failing file not in the baseline: delete it if its name or its import closure is SSH-only (`ssh`, `relay`, `remote-repo`, `remote-worktree`, `direct-ssh`, `socks`); otherwise delete only the failing SSH `describe`/`it` blocks and the `vi.mock` entries for deleted modules. Never edit a passing test; never add a skip.
- [ ] **Step 3:** Re-run the touched files; `pnpm tc`; `pnpm run check:code-quality:changed`; `pnpm run check:local-only`; `node config/scripts/prune-reliability-gates-for-deleted-files.mjs && pnpm run check:reliability-gates`.
- [ ] **Step 4: Commit:**
  ```
  test(local-only): prune SSH-only tests after the connection layer removal

  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01PskLbdTqJNXxJ7KRnDoDoD
  ```

### Task B6.4: Drop the ssh2 runtime dependency and its packaging entries

**Files:**
- Modify: `package.json:187` (delete `"ssh2": "^1.17.0",`; keep `:232 "@types/ssh2"`), `pnpm-workspace.yaml:47` (`cpu-features: true`) and `:53` (`ssh2: false`) under `allowBuilds`, `pnpm-lock.yaml` (regenerated), `config/packaged-runtime-node-modules.cjs:27` (`'ssh2',`), `config/scripts/check-runtime-electron-ratchet.mjs:53` (`'cpu-features'` in `EXTERNAL`) and `:57` (the comment naming ssh2's cpu-features). `config/scripts/check-local-only.mjs` is B0's: do not duplicate its `ssh2` rule here.
- Test: new `config/scripts/packaged-runtime-package-roots.test.mjs`, `config/scripts/check-local-only.test.mjs`, `config/scripts/check-runtime-electron-ratchet.test.mjs`, `src/shared/child-process/child-process-import-boundary.test.ts`.

**Interfaces:** Consumes B6.2 (no runtime `ssh2` import left). Produces a lockfile without `ssh2` (and without `asn1`, `bcrypt-pbkdf`, `cpu-features`, `nan` only if `pnpm why` shows no other dependant) and a packaged `Resources/node_modules` without `ssh2`.

- [ ] **Step 1: Failing test first:** create `config/scripts/packaged-runtime-package-roots.test.mjs`:
  ```js
  import { createRequire } from 'node:module'
  import { describe, expect, it } from 'vitest'

  const require = createRequire(import.meta.url)
  const { PACKAGED_RUNTIME_PACKAGE_ROOTS } = require('../packaged-runtime-node-modules.cjs')

  describe('packaged runtime package roots', () => {
    it('ships no SSH client: the ssh2 runtime dependency is gone', () => {
      expect(PACKAGED_RUNTIME_PACKAGE_ROOTS).not.toContain('ssh2')
    })

    it('still ships the local and WSL runtime closure', () => {
      for (const name of ['node-pty', '@parcel/watcher', 'ws', 'yaml', 'zod', 'jsonc-parser']) {
        expect(PACKAGED_RUNTIME_PACKAGE_ROOTS).toContain(name)
      }
    })
  })
  ```
  `pnpm test config/scripts/packaged-runtime-package-roots.test.mjs` — expected: the first case fails.
- [ ] **Step 2:** Edit `package.json`, `pnpm-workspace.yaml`, `packaged-runtime-node-modules.cjs`, `check-runtime-electron-ratchet.mjs`. Run `pnpm install` (lockfile regenerates; no `--frozen-lockfile`). `pnpm why ssh2` — expected: nothing. `pnpm why cpu-features`, `pnpm why nan` — if either is still required by another package, keep its `allowBuilds` row and say so in the commit body.
- [ ] **Step 3: Verify.** `pnpm tc`; `pnpm test config/scripts/packaged-runtime-package-roots.test.mjs config/scripts/check-local-only.test.mjs config/scripts/check-runtime-electron-ratchet.test.mjs src/main/agent-hooks` (the 37 `import type { SFTPWrapper } from 'ssh2'` sites compile against `@types/ssh2`); `pnpm run check:code-quality:changed`; `pnpm run check:local-only`; `pnpm run check:runtime-electron-ratchet`; `grep -c "ssh2" pnpm-lock.yaml` → only the `@types/ssh2` rows.
- [ ] **Step 4: Commit:**
  ```
  chore(local-only): drop the ssh2 runtime dependency and its packaging entries

  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01PskLbdTqJNXxJ7KRnDoDoD
  ```
---

## Planner group: b6-ui

## Unit B6-2 — SSH in preload, renderer, CLI, tests, CI (B6 part 2)

Conventions for every task below (same as Spec A):
- Line numbers were read at `57f87b013d` (branch `local-only/spec-b`). B0–B5 and b6-main shift them. Before every edit, re-anchor on the quoted identifier with `rg -n '<identifier>' <file>`; delete bottom-up inside a file. Never reflow surrounding code.
- `DEL` = whole file (`git rm -q`). `LINES` = delete only the quoted lines in a shared file.
- **Renderer deletion rule (write it on the task, apply it literally):** a renderer file goes iff it (a) calls `window.api.ssh` / `window.api.remoteWorkspace`, (b) renders SSH-only UI, or (c) is imported only by files in (a)/(b). A pure function over the inert `shared/ssh-types` that still has a non-SSH importer stays in place, untouched (the "stub seam" of the renderer). The 41 kept files are listed in B6-2.3 step 9; do not move or rename them.
- **Keep every `connectionId?: string` optional parameter** in the git/fs/pty/worktree/repos preload bridges and the `{ kind: 'ssh'; connectionId }` member of `DocPreviewGrantOwner` (`src/preload/api/doc-preview-api.ts:4`). They are inert types (design: unions are not narrowed). Only the methods whose `connectionId: string` is *required* go (B6-2.4).
- Ternaries of the shape `sshTargetId ? <ssh call> : <local/runtime call>` collapse to the non-SSH arm; delete the SSH arm and the condition, never rewrite the surviving arm.
- Reliability gates are pruned **in the same commit** as each test-file delete with the gitignored helper written in B6-2.1 step 1: `node notes/local-only/prune-reliability-gates.mjs && pnpm format && pnpm run check:reliability-gates`. If the checker still names a gate (red/green evidence lost on a `soak`/`blocking` gate), delete that whole gate object by hand.
- Test files: a test goes iff its subject module is deleted or it mocks/asserts `window.api.ssh` / `window.api.remoteWorkspace`; a test of a kept (inert) module stays while it passes.
- Test-tail policy: whole-delete every ssh-named test whose subject is deleted; in a non-ssh-named test delete only the `it`/`describe` blocks that mock or assert `window.api.ssh`, `window.api.remoteWorkspace`, or a deleted module; never relax an assertion about local behaviour. Tests that merely use `'ssh:…'` fixture host ids against the inert types must keep passing unchanged. The bar is the Spec A "after" baseline (`notes/local-only/after/`: 13 known failing files); no new failing files.
- Verification per task: `pnpm tc`, `pnpm test <paths>`, `pnpm run check:code-quality:changed`, `pnpm run check:local-only` (violation count must not rise), plus the task's own `rg` sweep. Run apps and e2e only with `ORCA_BACKGROUND_LAUNCH=1`.
- Commits are authorized (one per task). Pushing is not. Commit trailer (verbatim, both lines):
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01PskLbdTqJNXxJ7KRnDoDoD
  ```

Ordering inside the unit: B6-2.1 → B6-2.2 → B6-2.3 → B6-2.4 → B6-2.5 → B6-2.6 → B6-2.7 → B6-2.8 → B6-2.9. Renderer first, preload fourth: the `window.api.ssh` key can only leave `PreloadApi` once no renderer caller remains, and the catalog prune (B6-2.5) only works once the components are gone.

### Task B6-2.1: Renderer — SSH session/reconnect machinery and remote-workspace sync

**Files:**
- Delete (renderer, `src/renderer/src/`): `startup/active-workspace-ssh-targets.ts`, `startup/active-workspace-ssh-targets.test.ts`, `startup/ssh-startup-reconnect.ts`, `startup/ssh-startup-reconnect.test.ts`, `startup/startup-ssh-connection-restore.ts`, `startup/startup-ssh-connection-restore.test.ts`, `hooks/ipc-events/direct-ssh-bridge-runtime.ts`, `hooks/ipc-events/direct-ssh-initial-state-hydration.ts`, `hooks/ipc-events/direct-ssh-state-ipc-bridge.ts`, `hooks/ipc-events/direct-ssh-connect-reply-routing.test.ts`, `hooks/ipc-events/direct-ssh-hydration-fanout.test.ts`, `hooks/ipc-events/direct-ssh-hydration-target-metadata.test.ts`, `hooks/ipc-events/remote-workspace-ipc-bridge.ts`, `hooks/direct-ssh-host-hydration.ts`, `hooks/direct-ssh-host-hydration-scope.ts`, `hooks/direct-ssh-host-hydration-telemetry.ts`, `hooks/direct-ssh-host-hydration.test.ts`, `hooks/direct-ssh-host-catalog-noop.test.ts`, `hooks/direct-ssh-reconnect-coordinator.ts`, `hooks/direct-ssh-reconnect-coordinator-outcomes.ts`, `hooks/direct-ssh-reconnect-coordinator-stabilization.ts`, `hooks/direct-ssh-reconnect-coordinator-telemetry.ts`, `hooks/direct-ssh-reconnect-coordinator-types.ts`, `hooks/direct-ssh-reconnect-coordinator.test.ts`, `hooks/direct-ssh-reconnect-preparation.ts`, `hooks/direct-ssh-reconnect-preparation-metrics.ts`, `hooks/direct-ssh-reconnect-rollout.ts`, `hooks/direct-ssh-reconnect-rollout.test.ts`, `hooks/direct-ssh-reconnect-tokens.ts`, `hooks/direct-ssh-reconnect-tokens.test.ts`, `hooks/direct-ssh-runtime-wake-isolation.test.tsx`, `hooks/direct-ssh-state-routing.ts`, `hooks/direct-ssh-state-routing.test.ts`, `hooks/direct-ssh-worktree-refresh-scheduler.ts`, `hooks/direct-ssh-worktree-refresh-scheduler-cancellation.ts`, `hooks/direct-ssh-worktree-refresh-scheduler-metrics.ts`, `hooks/direct-ssh-worktree-refresh-scheduler-types.ts`, `hooks/direct-ssh-worktree-refresh-scheduler.test.ts`, `hooks/direct-ssh-worktree-refresh-target-queue.ts`, `hooks/ipc-events-ssh-authority-test-fixtures.ts`, `hooks/useIpcEvents-agent-status-ssh-authority.test.ts`, `hooks/useIpcEvents-ssh-disconnect-cleanup.test.ts`, `hooks/remote-workspace-deferred-placement-retry.ts`, `hooks/remote-workspace-deferred-placement-retry.test.ts`, `hooks/remote-workspace-push-status.ts`, `hooks/remote-workspace-session-merge.ts`, `hooks/remote-workspace-session-merge-close-tombstones.test.ts`, `hooks/remote-workspace-session-merge-closed-terminal-tombstone.test.ts`, `hooks/remote-workspace-session-merge-local-survival.test.ts`, `hooks/remote-workspace-session-merge-parked-scrollback.test.ts`, `hooks/remote-workspace-session-readiness.ts`, `hooks/remote-workspace-snapshot-apply.ts`, `hooks/remote-workspace-snapshot-apply-deferred-session-write.test.ts`, `hooks/remote-workspace-snapshot-arrival-coordinator.ts`, `hooks/remote-workspace-snapshot-arrival-coordinator.test.ts`, `hooks/remote-workspace-snapshot-duplicate-tab-repair.test.ts`, `hooks/remote-workspace-snapshot-fresh-client-tab-seeding.test.ts`, `hooks/remote-workspace-snapshot-local-tab-survival.test.ts`, `hooks/remote-workspace-snapshot-placement.ts`, `hooks/remote-workspace-snapshot-unplaced-tab-adoption.test.ts`, `hooks/remote-workspace-target-sync.ts`, `hooks/remote-workspace-target-sync-types.ts`, `hooks/remote-workspace-target-sync.test.ts`, `hooks/__tests__/remote-workspace-target-sync-test-harness.ts`, `app-shell/remote-workspace-unplaced-upload-suppression.test.tsx`, `lib/direct-ssh-reconnect-product-telemetry.ts`, `lib/direct-ssh-reconnect-product-telemetry-types.ts`, `lib/direct-ssh-reconnect-product-telemetry.test.ts`, `lib/resume-sleeping-agent-session-direct-ssh-hydration-gap.test.ts`, `lib/ssh-failed-target-sleeping-agent-resume.test.ts`, `store/slices/agent-status-ssh-connection-clear.test.ts`, `src/shared/direct-ssh-reconnect-telemetry-schema.test.ts`. **Not deleted** (their subject module stays and runs on local paths — keep them as long as they pass; a failing `it` that mocks `api.ssh` is trimmed under the test-tail policy): `store/slices/{ssh,ssh-target-cleanup,readopted-ssh-worktree-rows,superseded-ssh-repo-rows,direct-ssh-terminal-recovery,direct-ssh-terminal-retry,direct-ssh-terminal-workspace-scope,direct-ssh-pane-detach-ledger,repos-ssh-host-reconciliation,repos-nested-ssh-projection,runtime-environment-ssh}.test.ts`, `lib/{direct-ssh-target-scope,new-workspace-ssh-gate,ssh-mutation-expectation,ssh-background-startup-delivery,workspace-session-ssh-partition-ownership,workspace-session-ssh-partition-round-trip}.test.ts`, `runtime/runtime-environment-ssh-state.test.ts`, `store/terminals/restored-relay-session-identity.test.ts`, `hooks/ssh-reconnect-pane-retry.test.ts`.
- Modify: `src/renderer/src/app-shell/use-app-startup-hydration.ts:21-22,240-264`, `src/renderer/src/hooks/ipc-events/app-lifetime-ipc-bridge.ts:14-15,51,58,126-127,146-147`, `src/renderer/src/app-shell/use-app-session-persistence.ts:3-6,42-43,48-100,126-127,133-190`, `src/renderer/src/lib/workspace-terminal-host-authority.ts:5` (type import only if `RemoteWorkspaceSyncStatus` stays exported from the inert `store/slices/ssh.ts` — it does; leave the line), `config/reliability-gates.jsonc` (via helper).
- Test: `pnpm test src/renderer/src/app-shell src/renderer/src/hooks src/renderer/src/store src/renderer/src/lib/workspace-session src/renderer/src/lib/workspace-terminal-host-authority.test.ts`.

**Interfaces:** Consumes: `window.api.ssh.*`, `window.api.remoteWorkspace.*` (still typed until B6-2.4). Produces: no renderer code dials an SSH target at startup or on IPC; `SshSlice` (`store/slices/ssh.ts`) and `ssh-target-cleanup.ts` stay as the inert state holder (pure state, no IPC — verified: their only imports are shared types and local helpers). `createSessionWriteSubscriber` is called without `shouldSchedulePersist`/`subscribeToPersistGateOpen` (both optional per `src/renderer/src/lib/session-write-subscriber.ts:91`).

- [ ] **Step 1: Write the gitignored gate-prune helper** (used by every later task; `notes/local-only/` is gitignored, do not commit it):
  ```bash
  mkdir -p notes/local-only && cat > notes/local-only/prune-reliability-gates.mjs <<'EOF'
  // Drops reliability-gate rows whose test files no longer exist: the testFiles entry, the same
  // path token inside each command, assertionRefs for that file, evidenceRuns whose command no
  // longer matches a surviving command, and whole gates that lose every test file or every
  // passed run (check-reliability-gates.mjs rules). Run from the repo root; then `pnpm format`.
  import { existsSync, readFileSync, writeFileSync } from 'node:fs'
  import { applyEdits, modify, parse } from 'jsonc-parser'

  const FILE = 'config/reliability-gates.jsonc'
  const options = { formattingOptions: { tabSize: 2, insertSpaces: true, eol: '\n' } }
  let text = readFileSync(FILE, 'utf8')
  const set = (path, value) => {
    text = applyEdits(text, modify(text, path, value, options))
  }
  const gates = parse(text).gates
  const report = []
  for (let index = gates.length - 1; index >= 0; index -= 1) {
    const gate = gates[index]
    const dead = new Set((gate.testFiles ?? []).filter((file) => !existsSync(file)))
    if (dead.size === 0) continue
    const testFiles = gate.testFiles.filter((file) => !dead.has(file))
    const strip = (command) => command.split(' ').filter((token) => !dead.has(token)).join(' ')
    const commands = [...new Set((gate.commands ?? []).map(strip))].filter((command) =>
      testFiles.some((file) => command.includes(file))
    )
    const evidenceRuns = (gate.evidenceRuns ?? [])
      .map((run) => ({ ...run, command: strip(run.command) }))
      .filter((run) => commands.includes(run.command))
    const assertionRefs = (gate.assertionRefs ?? []).filter((ref) => !dead.has(ref.file))
    const passed = evidenceRuns.some((run) => run.result === 'passed')
    if (testFiles.length === 0 || commands.length === 0 || assertionRefs.length === 0 || !passed) {
      set(['gates', index], undefined)
      report.push(`deleted gate ${gate.id} (${[...dead].join(', ')})`)
      continue
    }
    set(['gates', index, 'testFiles'], testFiles)
    set(['gates', index, 'commands'], commands)
    set(['gates', index, 'evidenceRuns'], evidenceRuns)
    set(['gates', index, 'assertionRefs'], assertionRefs)
    report.push(`pruned ${gate.id}: ${[...dead].join(', ')}`)
  }
  writeFileSync(FILE, text)
  console.log(report.join('\n') || 'no stale test files')
  EOF
  node notes/local-only/prune-reliability-gates.mjs
  ```
  Review the printed report before every commit: a gate whose commands were all path-less scripts loses them too, and a `soak`/`blocking` gate that loses its red run must be deleted by hand. Expected on a clean tree: `no stale test files` (b6-main's deletions have already been pruned by its own tasks; if it prints `pruned …`, those are b6-main leftovers and the output is correct).
- [ ] **Step 2: Delete the files.** `git rm -q` every path under Delete above (from `src/renderer/src/` and `src/shared/direct-ssh-reconnect-telemetry-schema.test.ts`). Expected: `rg --files src/renderer | rg -E 'direct-ssh-reconnect|direct-ssh-host-hydration|direct-ssh-state|direct-ssh-worktree-refresh|remote-workspace-|startup/.*ssh|ipc-events/direct-ssh'` prints nothing.
- [ ] **Step 3: `use-app-startup-hydration.ts`.** Delete line 21 (`import { restoreSshConnectionsForStartup } from '../startup/startup-ssh-connection-restore'`), line 22 (`import { collectActiveWorkspaceSshTargetIds } from '../startup/active-workspace-ssh-targets'`), and the block from the comment `// Why: re-establish SSH before terminal reconnect …` (line 240) through the `} else { logRendererStartupDiagnostic('ssh-reconnect-skipped', { connectionIds: 0 }) }` closing brace (line 264). Then `rg -n 'isRuntimeOwnedSshTargetId|actions\.setDeferredSshReconnectTargets' src/renderer/src/app-shell/use-app-startup-hydration.ts`; delete the now-unused `isRuntimeOwnedSshTargetId` import if that was its only use.
- [ ] **Step 4: `app-lifetime-ipc-bridge.ts`.** Delete lines 14-15 (the two `direct-ssh-*` imports), line 51 (`| 'directSsh.stop'`), line 58 (`const directSshRuntime = createDirectSshBridgeRuntime()`), lines 126-127 (`registerDirectSshStateIpcBridge(unsubs, directSshRuntime)`, `registerRemoteWorkspaceIpcBridge(unsubs, directSshRuntime)`), lines 146-147 (`directSshRuntime.stop()`, `onCleanupPhase?.('directSsh.stop')`), and the `registerRemoteWorkspaceIpcBridge` import (`rg -n remote-workspace-ipc-bridge` in the file). Then `rg -n "directSsh.stop" src/renderer` and delete that phase from any test expectation list.
- [ ] **Step 5: `use-app-session-persistence.ts`.** Delete lines 3-6 (the `remote-workspace-snapshot-apply` import), 42-43 (`RemoteWorkspaceObservedPatchResult` type import and `applyRemoteWorkspacePushStatus` import), the `RemoteWorkspaceUploadAuthority` type and the two helpers `captureRemoteWorkspaceUploadAuthorities` / `remoteWorkspaceUploadAuthorityIsCurrent` and `captureUploadedDirectSshLayoutEdits` (lines 48-~115; re-anchor with `rg -n 'function captureUploadedDirectSshLayoutEdits'`), lines 126-127 (`shouldSchedulePersist: () => !isDirectSshRemoteWorkspaceApplyInProgress(),` and `subscribeToPersistGateOpen: onDirectSshRemoteWorkspaceApplyWindowClosed,`), and lines 133-190 (from `const uploadAuthorities = captureRemoteWorkspaceUploadAuthorities(state)` through the closing `}` of `if (uploadAuthorities.length > 0) { … }`). Keep `const localWrite = patchWorkspaceSessionByHost(window.api.session, patch, state)` and `void localWrite`. Delete the `DirectSshLayoutEdit` type import if unused afterwards.
- [ ] **Step 6: Typecheck and sweep.** `pnpm tc`. Then `rg -n "remote-workspace-|direct-ssh-reconnect|direct-ssh-bridge|startup-ssh|active-workspace-ssh" src/renderer/src --glob '!*.test.*'` → no hits. Any remaining importer found by `tc` gets the same treatment: delete the import line and the call site, collapsing to the local arm.
- [ ] **Step 7: Tests and gates.** `node notes/local-only/prune-reliability-gates.mjs && pnpm format && pnpm run check:reliability-gates`; then `pnpm test src/renderer/src/app-shell src/renderer/src/hooks src/renderer/src/store src/renderer/src/lib`; apply the test-tail policy to failures (expected: `hooks/ipc-events-test-harness.ts:240` keeps its `remoteWorkspace` stub until B6-2.4; `ipc-events-agent-status-window-test-fixtures.ts:21,140` likewise). `pnpm run check:code-quality:changed`; `pnpm run check:local-only`.
- [ ] **Step 8: Commit.**
  ```
  refactor(local-only): remove renderer SSH reconnect machinery and remote-workspace sync

  Delete the direct-SSH startup reconnect, IPC state bridges, reconnect
  coordinator, worktree refresh scheduler and the SSH remote-workspace
  session sync hooks. The SshSlice stays as inert state; startup and
  session persistence keep only their local paths.

  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01PskLbdTqJNXxJ7KRnDoDoD
  ```

### Task B6-2.2: Renderer — SSH surfaces in settings, status bar, ports, browser pane, terminal overlay

**Files:**
- Delete (`src/renderer/src/components/`): `settings/SshPane.tsx`, `settings/SshTargetCard.tsx`, `settings/SshTargetCard.test.tsx`, `settings/SshTargetForm.tsx`, `settings/SshTargetForm.test.tsx`, `settings/SshHostAdvancedFields.tsx`, `settings/SshPassphraseDialog.tsx`, `settings/SshDestructiveActionDialog.tsx`, `settings/SshTargetDestructiveActions.tsx`, `settings/BrowserSshWorkspaceRoutingSetting.tsx`, `settings/BrowserSshWorkspaceRoutingSetting.test.tsx`, `settings/browser-ssh-workspace-routing-copy.ts`, `settings/ssh-search.ts`, `settings/ssh-session-termination.ts`, `settings/ssh-target-action-state.ts`, `settings/ssh-target-action-state.test.ts`, `settings/ssh-target-draft.ts`, `settings/ssh-target-draft.test.ts`, `settings/ssh-target-remove.ts`, `settings/ssh-target-remove.test.ts`, `settings/ssh-target-save-payload.ts`, `settings/ssh-target-save-payload.test.ts`, `settings/use-ssh-add-target-intent.ts`, `status-bar/SshStatusSegment.tsx`, `status-bar/SshStatusSegment.test.ts`, `status-bar/SshTargetStatusRow.tsx`, `status-bar/ssh-status-segment-copy.ts`, `status-bar/ssh-status-segment-copy.test.ts`, `right-sidebar/ssh-ports-panel.tsx`, `right-sidebar/ssh-detected-port-row.tsx`, `right-sidebar/ssh-forwarded-port-row.tsx`, `right-sidebar/ssh-port-forward-dialog.tsx`, `browser-pane/assemble-chrome/ssh-routed-browser-page-gate.tsx`, `browser-pane/assemble-chrome/ssh-routed-browser-page-gate.test.tsx`, `browser-pane/use-ssh-workspace-browser-route.host-connection.test.tsx` (keep `browser-pane/use-ssh-workspace-browser-route.ts`: `browser-page-viewport-overlays.tsx:12,74` imports its pure hook), `terminal-pane/TerminalSshReconnectOverlay.tsx`, `terminal-pane/TerminalSshReconnectOverlay.test.tsx`, `terminal-pane/ssh-reconnect-model-paint-gate.test.ts`, `terminal-pane/direct-ssh-hidden-output-restore-unavailable-banner.test.ts`, `terminal-pane/pty-connection-deferred-ssh-passphrase.test.ts`, `terminal-pane/pty-connection-direct-ssh-reattach-retry.test.ts`, `terminal-pane/pty-connection-direct-ssh-spawn-retry.test.ts`, `terminal-pane/pty-connection-parked-ssh-snapshot.test.ts`, `terminal-pane/pty-connection-ssh-reattach-early-input.test.ts`, `terminal-pane/pty-connection-ssh-startup-draft-delivery.test.ts`, `terminal-pane/scan22-ssh-new-tab-disposed-spawn-kill.repro.test.ts`, `terminal-pane/terminal-link-remote-runtime-ssh-open.test.ts`, `terminal-pane/pty-connection/reattach-payload-ssh-reconnect-model-paint.test.ts`, `terminal-pane/pty-connection/ssh-session-gone-verdict.test.ts`, `tab-bar/TabBar.windows-shell-ssh-host.test.ts`, `src/renderer/src/ssh/ssh-connect-in-flight.ts`, `ssh/ssh-connect-in-flight.test.ts`, `ssh/ssh-connect-ui-timeout.ts`, `ssh/ssh-connect-ui-timeout.test.ts`, `ssh/ssh-connect-verb.ts`, `ssh/ssh-connect-verb.test.ts` (keep `ssh/ssh-connection-recoverability.ts` and its test: pure classifier imported by `lib/worktree-host-connection-phase.ts:10`, `components/automations/external-automation-source-availability.ts:6`, `components/status-bar/remote-host-connection-status.ts:5`, `lib/new-workspace-ssh-gate.ts:1`; likewise keep `terminal-pane/ssh-reattach-model-restore.test.ts` and `terminal-pane/pty-connection/direct-ssh-reattach-recovery.test.ts`, whose subjects stay).
- Modify: `settings/settings-remote-security-section-renderers.tsx:4,42-59`, `settings/settings-page-renderer.tsx:39,131`, `src/renderer/src/hooks/settings-navigation-remote-sections.ts:8,16,33-47`, `settings/use-settings-store-model.ts:119,187-188`, `settings/use-settings-page-effects.ts:41,208-209,234`, `settings/BrowserPane.tsx:18,115,282,297-299`, `settings/browser-search.ts:14-17,270-~292`, `settings/appearance-status-bar-search.ts:174-~195`, `settings/AppearanceWindowSidebarSection.tsx:46-47`, `status-bar/StatusBarSurface.tsx:43-45,88,283`, `status-bar/use-status-bar-controller.ts:157,275`, `status-bar/StatusBarVisibilityMenu.tsx:158-166`, `status-bar/status-bar-copy-localization.test.tsx` (delete the `SshStatusSegment` describe/its, lines 12,19,22-29,54-60,145-185 — re-anchor), `src/shared/status-bar-defaults.ts:14`, `src/shared/feature-wall-tiles.ts:6,38,103-114`, `config/scripts/check-feature-wall-assets.mjs:14`, `resources/onboarding/feature-wall/tile-06.{gif,poster.jpg,recorded-at.json}` (delete), `right-sidebar/PortsPanel.tsx:4,17-19`, `browser-pane/assemble-chrome/browser-workspace-pane.tsx:24,162-166,214`, `browser-pane/assemble-chrome/browser-workspace-pane.retention-props.test.tsx` (the `SshRoutedBrowserPageGate` mock/assertions), `terminal-pane/TerminalPaneRuntimePortals.tsx:3,80-118`, `terminal-pane/TerminalPaneSurface.tsx:23,200`, `src/renderer/src/app-shell/AppRootSurfaces.tsx:49-53,123,279-285`, `src/renderer/src/components/sidebar/use-add-repo-hosted-controller.ts:61-70` (`handleOpenSshSettings` and its return entry; then its consumer via `rg -n handleOpenSshSettings`), `src/renderer/src/components/sidebar/AddRepoDialogStepContent.tsx:66,136,205` (`onOpenSshSettings` prop plumbing — delete together with B6-2.3's RemoteStep removal if that lands first), `config/reliability-gates.jsonc`.
- Test: `pnpm test src/renderer/src/components/settings src/renderer/src/components/status-bar src/renderer/src/components/right-sidebar src/renderer/src/components/browser-pane src/renderer/src/components/terminal-pane src/renderer/src/app-shell src/renderer/src/hooks/useSettingsNavigationMetadata.test.ts`.

**Interfaces:** Consumes: `SshSlice` state keys (`sshConnectionStates`, `sshTargetLabels`, `sshCredentialQueue`, …) remain readable; `StatusBarItem` union keeps the inert `'ssh'` member (`src/shared/ui-chrome-types.ts:69`) but it is no longer a default item nor a visible toggle. Produces: no settings pane `'ssh'`, no status-bar SSH segment, local-only Ports panel, browser pages render without the SSH route gate, no SSH onboarding tile.

- [ ] **Step 1: Delete the files** listed above with `git rm -q`. Expected: `ls src/renderer/src/ssh` prints only `ssh-connection-recoverability.ts` and `ssh-connection-recoverability.test.ts`.
- [ ] **Step 2: Settings pane and navigation.** `settings-remote-security-section-renderers.tsx`: delete line 4 (`import { SshPane } from './SshPane'`) and the whole `export function renderSshSettingsSection(…) { … }` (lines 42-59). `settings-page-renderer.tsx`: delete line 39 (`renderSshSettingsSection` in the import list) and line 131 (`{renderSshSettingsSection(context)}`). `settings-navigation-remote-sections.ts`: delete line 8 (`getSshPaneSearchEntries` import), the `ssh` section object (lines 33-47, from `...(showDesktopOnlySettings` through `: []),` that closes the `id: 'ssh'` entry) and `Cable,` from the lucide import (line 16) if unused. `use-settings-store-model.ts`: delete line 119 (`const [sshHostAddIntentSignal, setSshHostAddIntentSignal] = useState(0)`) and lines 187-188 (the two model entries). `use-settings-page-effects.ts`: delete line 41, lines 208-209 (`} else if (settingsNavigationTarget.intent === 'add-ssh-host') {` and `setSshHostAddIntentSignal((signal) => signal + 1)` — the following `} else if (… 'add-remote-orca-server')` keeps the chain closed; if B5 removed that branch too, the `if` ends after the quick-command branch) and line 234; leave the `'add-ssh-host'` intent member of `SettingsNavigationTarget` inert. `use-add-repo-hosted-controller.ts`: delete `handleOpenSshSettings` (lines 61-70) and its entry in the returned object; `rg -n 'handleOpenSshSettings|onOpenSshSettings' src/renderer/src` and delete each prop plumbing line (`AddRepoDialogStepContent.tsx:66,136,205`, `AddRepoSteps.tsx`, the composer card) — if B6-2.3 is already done these are gone.
- [ ] **Step 3: Browser settings.** `BrowserPane.tsx`: delete line 18 (`BrowserSshWorkspaceRoutingSetting` import), line 115 (`const showSshWorkspaceRouting = …[9]`), change line 282 from `{showClientHostedRemote || showSshWorkspaceRouting ? (` to `{showClientHostedRemote ? (`, delete lines 297-299 (`{showSshWorkspaceRouting ? ( <BrowserSshWorkspaceRoutingSetting … /> ) : null}`). `browser-search.ts`: delete lines 14-17 (the two `getBrowserSshWorkspaceRouting*` imports) and the whole search-entry object whose `title: getBrowserSshWorkspaceRoutingTitle()` (lines 270-~292, through its closing `},`). Then **re-check the index coupling**: `rg -n 'browserSearchEntries\[' src/renderer/src/components/settings/BrowserPane.tsx` — every index after 9 (`showUserAgent = …[10]` and any later) must drop by one (`[10]` → `[9]`, …) because the SSH entry sat at index 9. Confirm by counting the objects in `getBrowserPaneSearchEntries()` after the cut. (If B5 already removed the client-hosted entry at index 8, shift by two.)
- [ ] **Step 4: Status bar.** `StatusBarSurface.tsx`: delete lines 43-45 (the `SshStatusSegment` lazy import), 88 (`showSsh,`), 283 (`{showSsh ? <SshStatusSegment … /> : null}`). `use-status-bar-controller.ts`: delete line 157 (`const showSsh = statusBarItems.includes('ssh')`) and line 275 (`showSsh,`). `StatusBarVisibilityMenu.tsx`: delete the `DropdownMenuCheckboxItem` whose `checked={statusBarItems.includes('ssh')}` (lines 158-166); drop `Server` from the lucide import if unused. `appearance-status-bar-search.ts`: delete the object with `id: 'ssh',` (lines 174-~195, through `},`). `AppearanceWindowSidebarSection.tsx`: delete lines 46-47 (`} else if (id === 'ssh') { recordFeatureInteraction('ssh')`), keeping the following `} else if (` chain intact. `src/shared/status-bar-defaults.ts`: delete line 14 (`'ssh',`). Keep `StatusBarItem`'s `'ssh'` member (inert; persisted `statusBarItems` containing `'ssh'` hydrate through `migrateStatusBarItems` unchanged and simply render nothing). `status-bar-copy-localization.test.tsx`: delete the SSH imports (12, 19), the `sshConnectionStates`/`sshTargetLabels` fixture fields and `setSshTargets` helper (22-29, 54-60) and the `it`s that render `SshStatusSegment` (145-185); keep the Resource Manager cases.
- [ ] **Step 5: Ports panel.** `PortsPanel.tsx`: delete line 4 (`import { SshPortsPanel } from './ssh-ports-panel'`) and lines 17-19 (`if (activeRepo?.connectionId) { return <SshPortsPanel /> }`). If `activeRepo` becomes unused, delete line 15 and `useRepoById` from line 2. `PortsPanel.test.tsx` keeps its `PortForwardEntry` type test (it exercises `@/lib/workspace-port-urls`, not the deleted panel).
- [ ] **Step 6: Browser pane gate.** `browser-workspace-pane.tsx`: delete line 24 (`SshRoutedBrowserPageGate` import); replace the wrapper (lines 162-166 `<SshRoutedBrowserPageGate worktreeId=… sessionProfileId=… pageIds=…>` + `{(routedPartition) => (` and the matching `)}` + `</SshRoutedBrowserPageGate>` at 213-214) by its inner `<div className="relative flex min-h-0 flex-1">…</div>`, and change `sessionPartition={routedPartition ?? browserTab.sessionPartition ?? null}` to `sessionPartition={browserTab.sessionPartition ?? null}`. Exact resulting JSX for the branch:
  ```tsx
      {localBrowserPages.length > 0 ? (
        <div className="relative flex min-h-0 flex-1">
          {localBrowserPages.map((page) => (
  ```
  (everything inside unchanged) …
  ```tsx
          <BrowserMobileDriverOverlay
            driver={activeBrowserDriver}
            onTakeBack={reclaimActiveBrowserForDesktop}
          />
        </div>
      ) : null}
  ```
  `browser-workspace-pane.retention-props.test.tsx`: delete the `vi.mock('./ssh-routed-browser-page-gate', …)` and any assertion on the gate's props. `pnpm format` afterwards.
- [ ] **Step 7: Terminal reconnect overlay.** `TerminalPaneRuntimePortals.tsx`: delete line 3 (`TerminalSshReconnectOverlay` import) and the whole `export function TerminalPaneSshReconnectPortals(…) { … }` (lines 80-118). `TerminalPaneSurface.tsx`: delete line 23 (`TerminalPaneSshReconnectPortals` in the import list) and line 200 (`<TerminalPaneSshReconnectPortals controller={controller} />`). Leave `showSshReconnectOverlay` and the `sshReconnect*` controller fields in place (inert; they are false/null with no SSH state).
- [ ] **Step 8: Passphrase dialog.** `AppRootSurfaces.tsx`: delete lines 49-53 (the `SshPassphraseDialog` lazy import), 123 (`const hasSshCredentialRequest = useAppStore((s) => s.sshCredentialQueue.length > 0)`), 279-285 (`{hasSshCredentialRequest ? ( <Suspense …><ModalBoundary boundaryId="modal.ssh-passphrase" …><SshPassphraseDialog /></ModalBoundary></Suspense> ) : null}`).
- [ ] **Step 8b: Feature-wall SSH tile.** `src/shared/feature-wall-tiles.ts`: delete line 6 (`| 'tile-06'`), line 38 (`'tile-06',` in the order list) and the tile object `{ id: 'tile-06', kind: 'media', title: 'Remote workspaces', … owner: 'ssh-workspaces', docsUrl: 'https://www.onorca.dev/docs/ssh' }` (lines 103-114, re-anchor with `rg -n "id: 'tile-06'"`). `config/scripts/check-feature-wall-assets.mjs:14`: delete `'tile-06',`. `git rm -q resources/onboarding/feature-wall/tile-06.gif resources/onboarding/feature-wall/tile-06.poster.jpg resources/onboarding/feature-wall/tile-06.recorded-at.json`. Keep `config/local-only-allowlist.txt:8` (the other tiles still carry `onorca.dev` docs links). `pnpm run check:feature-wall-assets` → passes. `rg -n "tile-06|ssh-workspaces" src config resources` → no hits. The `'ssh'` `FeatureInteractionId` (`src/shared/feature-interaction-catalog.ts:46,139`) stays inert.
- [ ] **Step 9: Typecheck and sweep.** `pnpm tc`; then `rg -n "SshPane|SshStatusSegment|SshPortsPanel|SshRoutedBrowserPageGate|TerminalSshReconnectOverlay|SshPassphraseDialog|getSshPaneSearchEntries|BrowserSshWorkspaceRouting" src/renderer src/shared` → no hits.
- [ ] **Step 10: Tests and gates.** `node notes/local-only/prune-reliability-gates.mjs && pnpm format && pnpm run check:reliability-gates`; `pnpm test <paths under Test>`; apply the test-tail policy; `pnpm run check:code-quality:changed`; `pnpm run check:local-only`.
- [ ] **Step 11: Commit.**
  ```
  refactor(local-only): remove the SSH settings pane, status segment, ports panel and overlays

  Delete the SSH hosts settings section and search entries, the status-bar
  Remote Hosts segment and toggle, the SSH ports panel, the browser-pane
  SSH route gate and routing setting, the terminal SSH reconnect overlay,
  the passphrase dialog and the SSH onboarding tile. The 'ssh'
  StatusBarItem member stays inert.

  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01PskLbdTqJNXxJ7KRnDoDoD
  ```

### Task B6-2.3: Renderer — sidebar host and add-project SSH flows, remote file browser, composer/automation connects, terminal deferred-attach SSH branch

**Files:**
- Delete (`src/renderer/src/components/sidebar/`): `AddRemoteHostDialog.tsx`, `AddRemoteHostDialog.config-picker.test.tsx`, `AddRemoteHostFields.tsx`, `AddRemoteHostFields.test.tsx`, `AddRemoteHostSshConfigPicker.tsx`, `AddRemoteHostSshFormPanel.tsx`, `AddRemoteHostServerFormPanel.tsx` (only if B5 left it; it is runtime-only), `add-remote-host-ssh-actions.ts`, `add-remote-host-ssh-actions.test.ts`, `AddRepoHostSelector.tsx`, `AddRepoHostSelector.test.tsx`, `AddRepoHostSelectorSlot.tsx`, `AddRepoRemoteStep.tsx`, `SshTargetRow.tsx`, `RemoteFileBrowser.tsx`, `RemoteFileBrowser.paste.test.tsx`, `RemoteFileBrowserBreadcrumbs.tsx`, `RemoteFileBrowserEntryList.tsx`, `remote-file-browser-helpers.ts`, `remote-file-browser-helpers.test.ts`, `remote-file-browser-path-preview-resolver.ts`, `use-remote-file-browser-listing.ts`, `use-remote-file-browser-path-preview.ts`, `use-remote-file-browser-filter-key-commands.ts`, `use-add-repo-remote-nested-scan.ts`, `HostRemoveDialog.tsx` (its `HostRemovalTarget` is `ssh | runtime | null`, `host-rename-remove.ts:40-43`; nothing local is removable through it), `ssh-host-remove-resolution.ts`, `ssh-host-remove-resolution.test.ts`, `ssh-host-remove-workspaces.ts`, `ssh-target-duplicate.ts`, `ssh-target-duplicate.test.ts`, `ForgetSshWorkspaceDialog.tsx`, `ssh-workspace-forget-resolution.test.ts` (keep `ssh-workspace-forget-resolution.ts`: pure, imported by `delete-worktree-flow.ts:10`), `WorktreeCardSshHostControl.tsx`, `WorktreeCardSshHostControl.test.tsx`, `WorktreeCard.ssh-reconnect-prompt.test.tsx`; plus `src/renderer/src/components/automations/use-automation-desktop-ssh-registrations.ts` (only importer is the `connectSshTarget` consumer removed below — keep it if `rg -n useAutomationDesktopSshRegistrations src/renderer` still shows a non-test importer after step 5), `src/renderer/src/components/terminal-pane/pty-connection/ssh-session-connect.ts`, `src/renderer/src/components/terminal-pane/ssh-pane-connect-gate.ts` and `ssh-pane-connect-gate.test.ts` (its only importer is the deleted block).
- Modify: `sidebar/AddRepoDialog.tsx` (the `AddRepoHostSelectorSlot` import and `<AddRepoHostSelectorSlot hostSelection={…} />` element, via `rg -n AddRepoHostSelectorSlot`), `sidebar/index.tsx:31,255`, `sidebar/delete-worktree-flow.ts:79-93` (keep `resolveSshWorkspaceForget`, remove only the `openModal('forget-ssh-workspace', …)` branch — see step 2), `sidebar/HostSectionHeaderMenu.tsx:27,38,64-65,76,78-84,89,92,98-110,237-248,263-270,285-295` and `host-header-menu-items.ts:14-15,31-39,48-49,61-63`, `sidebar/worktree-card-header.tsx:14,106-115` (and the `sshTargetLabel`/`sshStatus`/`sshTargetRemoved`/`sshOwnerEnvironmentId` props they fed, via `rg -n`), `sidebar/AddRepoSteps.tsx:6,43,55,78-93,109,119-121,130,185-192,193,250`, `sidebar/use-add-repo-host-selection.ts:10,28,35-36,79-80,116-152,175,182`, `sidebar/AddRepoDialogStepContent.tsx:3,10,17,30,32,34,51,66,87,100,102,104,136,156,195,197,205,222,224,264`, `sidebar/CreateProjectLocationField.tsx:6,11,19,40-50,70,81,113`, `sidebar/AddRepoCloneStep.tsx:7,17,33,41,53,67-77`, `sidebar/useAddRepoCloneFlow.ts:135-141`, `sidebar/useCreateRepo.ts:106-112`, `sidebar/AddProjectFromFolderDialog.tsx:76-90`, `sidebar/NonGitFolderDialog.tsx:57-74`, `src/renderer/src/store/projects/project-host-setup-actions.ts:243-252`, `sidebar/add-repo-browse-authority.ts:6,17-18`, `components/NewWorkspaceComposerCard.tsx:17-18,234-241,313`, `components/automations/use-automation-host-catalog.ts:45,93,146,244-246`, `src/renderer/src/hooks/automation-dispatch-workspace.ts:112-145`, `src/renderer/src/hooks/composer-state/host-runtime-effects.ts:186-232` (the two `window.api.ssh.connect` callbacks), `components/terminal-pane/pty-connection/deferred-session-attach.ts:2-3,5,13,22-298`, `components/terminal-pane/terminal-remote-file-download-open.ts:17-19`, `components/right-sidebar/file-explorer-row-file-transfer.ts:20-31`, `src/renderer/src/runtime/runtime-file-read-client.ts:118-120`, `config/reliability-gates.jsonc`.
- Test: `pnpm test src/renderer/src/components/sidebar src/renderer/src/components/automations src/renderer/src/components/terminal-pane src/renderer/src/components/right-sidebar src/renderer/src/hooks src/renderer/src/store/projects src/renderer/src/runtime src/renderer/src/components/NewWorkspaceComposerCard.test.tsx`.

**Interfaces:** Consumes: B5 must have removed the runtime-environment arms of the same dialogs (`AddRemoteHostServerFormPanel`, `AddRepoServerStartStep`, the `runtime` cases in `HostSectionHeaderMenu`/`host-rename-remove.ts`); B6-2 then deletes the host dialogs whole. Produces: the add-project dialog has no host selector (local only), `RemoteFileBrowser` is gone, a terminal session with a `connectionId` never reaches `window.api.ssh` (the block is removed; B7's hydration strip and main's PTY seam make `session.connectionId` unreachable).

- [ ] **Step 1: Delete the files** under Delete with `git rm -q` (skip any path B5 already removed). Expected: `ls src/renderer/src/components/sidebar | rg -i 'ssh|RemoteFileBrowser|AddRemoteHost|AddRepoHostSelector|AddRepoRemoteStep|HostRemoveDialog'` → only `ssh-workspace-forget-resolution.ts`.
- [ ] **Step 2: Sidebar modal and card.** `sidebar/index.tsx`: delete line 31 (`const ForgetSshWorkspaceDialog = lazyWithRetry(…)`) and line 255 (`{activeModal === 'forget-ssh-workspace' ? <ForgetSshWorkspaceDialog /> : null}`). Keep `'forget-ssh-workspace'` in the `activeModal` union (`store/slices/ui/ui-slice-contract-contextual.ts:38`, inert; `activeModal` is not persisted). `delete-worktree-flow.ts`: delete the branch `if (sshResolution.kind === 'ghost' || sshResolution.kind === 'disconnected') { … state.openModal('forget-ssh-workspace', …) return }` (lines 86-93) — keep the `resolveSshWorkspaceForget` computation (pure, returns `not-ssh` for every local repo) and the surrounding local delete flow; if `sshResolution` becomes unused delete lines 79-85 and the import at line 10 too. `worktree-card-header.tsx`: delete line 14 (`WorktreeCardSshHostControl` import) and the JSX `{repo?.connectionId && ( <WorktreeCardSshHostControl … /> )}` (lines 106-115); then `rg -n 'sshTargetLabel|sshStatus|sshTargetRemoved|sshOwnerEnvironmentId' src/renderer/src/components/sidebar/worktree-card-header.tsx src/renderer/src/components/sidebar/WorktreeCard*.tsx` and delete each now-unused prop/selector line.
- [ ] **Step 3: Host header menu.** `HostSectionHeaderMenu.tsx`: delete line 27 (`sshConnectVerb` import), lines 64-65 (`} else if (row.kind === 'ssh') { state.openSettingsTarget({ pane: 'ssh', … }) }` — keep the `else` branch that follows), the `sshStatus` selector (78-84, replace its only remaining use at 89 by deleting `sshConnected: sshStatus === 'connected',`), the `runSshAction` callback (98-~112) and the two menu items `model.actions.includes('ssh-reconnect')` / `'ssh-disconnect'` (237-248); drop `Plug`/`PlugZap` from the lucide import if unused. Then `rg -n 'HostRemoveDialog|removeOpen|removalTarget|resolveHostRemoval' src/renderer/src/components/sidebar/HostSectionHeaderMenu.tsx` and delete the import (38), the `removeOpen` state (76), `removalTarget` (92), the `model.actions.includes('remove')` menu item (263-~270) and the `{removalTarget && ( <HostRemoveDialog … /> )}` element (285-~295). `host-header-menu-items.ts`: delete the `'ssh-reconnect' | 'ssh-disconnect'` union members (14-15), the `sshConnected` input field (31-32), `sshActions` (36-39), the `case 'ssh':` arm (48-49) and the `'remove'` push for `ssh`/`runtime` kinds (61-63, together with its comment); update `host-header-menu-items.test.ts` by deleting the SSH and remove cases. Host-scope UI check: `rg -n "hostOptions.length|length > 1|return null" src/renderer/src/components/sidebar/SidebarHostScopeMenuSection.tsx src/renderer/src/components/sidebar/use-sidebar-host-scope-options.ts src/renderer/src/components/sidebar/SidebarWorkspaceOptionsMenu.tsx` — if the scope section still renders with a single `local` host, delete the `if (host.kind === 'ssh') { … 'Configured SSH' … 'Project SSH' … }` label branch (`SidebarHostScopeMenuSection.tsx:30-39`) and leave the section (it is host-agnostic UI); `DashboardHostBadge.tsx:19,37`, `WorktreeHostContextBadge.tsx`, `NoticeHostGlyph.tsx`, `activity-thread-hover-card-summary.tsx:58`, `host-section-rows.ts:77`, `sidebar-host-options.ts:52-85` keep their `ssh` arms inert (pure labelling over the inert union, no capability).
- [ ] **Step 4: Add-project flow.** `AddRepoSteps.tsx`: delete line 6 (`SshTarget, SshConnectionState` type import), 43 (`const [sshTargets, setSshTargets] = useState…`), 55 and 109 (`setSshTargets([])`), the SSH-target load effect 78-93 (`const targets = (await window.api.ssh.listTargets()) …` through `setSshTargets(withState)`), the `onStateChanged` subscription 119-121, the `await window.api.ssh.connect({ targetId })` call at 130 (collapse its enclosing handler to a no-op or delete the handler if only SSH used it — `rg -n -B6 'window.api.ssh.connect' AddRepoSteps.tsx`), the `window.api.repos.addRemote({…})` call at 185-192 with its `sshConnectionId: selectedTargetId` setup (193) — collapse to the local `addRepo` arm, and line 250 (`sshTargets,`). `use-add-repo-host-selection.ts`: delete line 10 (type import), 28 (`selectedSshTargetId: string | null`), 35-36 (`setSshConnectionState`/`sshConnectionStates` selectors), 79-80 (`selectedSshTargetId` derivation), the `if (!host || parsed?.kind !== 'ssh') { … } … window.api.ssh.connect …` block inside `handleConnectAddProjectHost` (116-152; if the whole handler is SSH-only, delete it and its consumer prop `onConnectHost`), 175 (deps) and 182 (return entry). `AddRepoDialogStepContent.tsx`: delete line 3 (`RemoteStep` import) and the `<RemoteStep … />` JSX (re-anchor `rg -n '<RemoteStep'`), the props `isSshLikely`, `sshTargets`, `selectedSshTargetId`, `lockSshTargetSelection`, `browseHostKind` (`'ssh'` member), `onOpenSshSettings`, `sshTargetId={selectedSshTargetId}` (lines 10,17,30,32,34,51,66,87,100,102,104,136,156,195,197,205,222,224,264 — delete each line and every caller that passes them, found with `rg -n 'isSshLikely|lockSshTargetSelection|selectedSshTargetId|sshTargets=' src/renderer/src/components/sidebar`). `CreateProjectLocationField.tsx` and `AddRepoCloneStep.tsx`: delete the `RemoteFileBrowser` import, the `sshTargetId` prop declarations and the `{sshTargetId ? ( <RemoteFileBrowser targetId={sshTargetId} … /> ) : …` branches (40-50 / 67-77); if B5 removed the runtime branch too, delete the whole remote-browse block and the `isRemoteClone`/`browsingDestination` gating that only served it. `add-repo-browse-authority.ts`: delete `browseSsh: (targetId: string) => void` (6) and `if (host?.kind === 'ssh') { actions.browseSsh(host.targetId) … }` (17-18 plus its `return`). `useAddRepoCloneFlow.ts:135-141`, `useCreateRepo.ts:106-112`, `project-host-setup-actions.ts:243-252`: collapse `sshTargetId?.trim() ? await window.api.repos.cloneRemote({…}) :` / `options.sshTargetId ? await window.api.repos.createRemote({…}) :` / `parsedHost?.kind === 'ssh' ? await window.api.repos.cloneRemote({…}) :` to the following arm; delete the `if (parsedHost?.kind !== 'ssh')` guard around `assertProjectHostSetupMutationRuntimeCapabilities(target)` (keep the call). `AddProjectFromFolderDialog.tsx:76-90` and `NonGitFolderDialog.tsx:57-74`: delete the `if (connectionId) { … window.api.repos.addRemote(…) … }` branch, keeping the local branch; delete the `connectionId` prop if it is now unused (`rg -n connectionId <file>`).
- [ ] **Step 5: Composer and automation connects.** `NewWorkspaceComposerCard.tsx`: delete lines 17-18 (`@/ssh/ssh-connect-ui-timeout`, `@/ssh/ssh-connect-in-flight` imports), the `if (action.kind === 'ssh') { … return }` block (234-241) and line 313 (`handleAddSshHost={() => setAddRemoteHostMode('ssh')}`); then `rg -n 'handleAddSshHost|setAddRemoteHostMode|AddRemoteHostMode' src/renderer/src/components` and delete every remaining line (the dialog is gone). `use-automation-host-catalog.ts`: delete lines 244-246 (`connectSshTarget: (targetId) => { void window.api.ssh.connect({ targetId }) },`) and the `connectSshTarget` member of `AutomationHostRecoveryDeps` (`rg -n connectSshTarget src/renderer/src/components/automations`); delete line 45 and 93 and 146 (`useAutomationDesktopSshRegistrations` / `desktopSshGenerations`) only if `desktopSshGenerations` has no other consumer in the file. `automation-dispatch-workspace.ts`: delete the `if (sshTargetId) { … }` block (116-~150) and the `const sshTargetId = …` declaration (112-115); keep the `folderWorkspaceHost` resolution. `host-runtime-effects.ts`: delete the bodies of `onConnectSelectedProject` (186-209) and `onConnectSelectedProjectGroup` (211-232) down to the two callbacks' consumers (`rg -n 'onConnectSelectedProject' src/renderer/src/hooks src/renderer/src/components`), deleting the callbacks and their prop plumbing; delete line 38 (`isSshConnectInProgress` import) if unused.
- [ ] **Step 6: Terminal deferred attach.** `deferred-session-attach.ts`: delete lines 2-3 and 5 and 13 (the `isRuntimeOwnedSshTargetId`, `resolveSshPaneConnectGate`, `waitForUserInitiatedSshConnect, waitForSshConnection`, `recoverUnverifiableDirectSshReattach` imports) and the whole `if (session.connectionId) { … }` block (lines 22-298, from the comment `// Why: trigger the deferred SSH connect per-tab` through the `}` immediately before `runDeferredSessionReattachChoice(session)`). Keep `runDeferredSessionReattachChoice(session)`. Leave `deferred-session-reattach-connect.ts:176-179` and `reattach-result-handler.ts:128-131` (`if (session.connectionId) { recoverUnverifiableDirectSshReattach(…) }`) and `direct-ssh-reattach-recovery.ts` in place (pure recovery request, inert without a `connectionId`).
- [ ] **Step 7: SSH-only download callers.** `terminal-remote-file-download-open.ts`: collapse `fileContext.connectionId ? await window.api.fs.downloadFile({…}) : await downloadRuntimeFile(…)` to `await downloadRuntimeFile(fileContext, filePath, name)`. `file-explorer-row-file-transfer.ts`: collapse the `typeof connectionIdOrRuntimeContext === 'string' ? (node.isDirectory ? downloadFolder : downloadFile) : downloadRuntimeFile(…)` ternary to the `downloadRuntimeFile(connectionIdOrRuntimeContext, node.path, node.name)` arm and narrow the parameter type to `RuntimeFileOperationArgs` (delete `string |`); fix its callers via `pnpm tc`. `runtime-file-read-client.ts`: delete lines 118-120 (`if (context.connectionId) { return window.api.fs.downloadFile(…) }`).
- [ ] **Step 8: Typecheck, sweep.** `pnpm tc`. Then `rg -n "window\.api\.ssh|api\.ssh\b|window\.api\.remoteWorkspace|repos\.(cloneRemote|createRemote|addRemote)|fs\.(downloadFile|downloadFolder)\(" src/renderer/src --glob '!*.test.*'` → no hits (test fixtures that stub the namespace are cleaned in B6-2.4).
- [ ] **Step 9: Record the kept inert files** (no edit; this is the rule's output, used by B6-2.9's sweep): `components/automations/use-automation-desktop-ssh-registrations.ts` (if kept), `components/browser-pane/use-ssh-workspace-browser-route.ts`, `components/new-workspace/new-workspace-composer-ssh-status.ts`, `components/sidebar/ssh-workspace-forget-resolution.ts`, `components/terminal-pane/pty-connection/{direct-ssh-reattach-recovery,direct-ssh-retry-lease,direct-ssh-retry-status,hidden-restore-state-and-ssh-probe,resolve-ssh-reconnect-model-paint,ssh-reattach-input-buffering,ssh-snapshot-prepaint}.ts`, `components/terminal-pane/{ssh-reattach-model-restore,terminal-paste-ssh-platform}.ts`, `hooks/ssh-reconnect-pane-retry.ts`, `lib/{direct-ssh-target-owner-index,direct-ssh-target-scope-types,direct-ssh-target-scope,new-workspace-ssh-gate,ssh-background-startup-delivery,ssh-mutation-expectation,ssh-workspace-browser-route-eligibility}.ts`, `runtime/runtime-environment-ssh-state.ts` (B5 may delete), `store/slices/{direct-ssh-pane-retry-ledger,direct-ssh-terminal-authority-ledger,direct-ssh-terminal-recovery-types,direct-ssh-terminal-recovery,direct-ssh-terminal-workspace-scope,readopted-ssh-worktree-rows,runtime-environment-ssh-selectors,runtime-environment-ssh,ssh-target-cleanup,ssh,superseded-ssh-repo-rows}.ts`, `store/slices/worktrees/listing/{direct-ssh-authority,known-ssh-worktree-fetch}.ts`, `store/slices/worktrees/teardown/orphaned-runtime-ssh-project-purge.ts`, `store/terminals/{direct-ssh-terminal-bindings,workspace-terminal-ssh-placeholders}.ts`, `ssh/ssh-connection-recoverability.ts`. `known-ssh-worktree-fetch.ts` calls `window.api.worktrees.listKnownForExecutionHost` only for an `ssh:` host that no longer exists; it stays.
- [ ] **Step 10: Tests and gates.** `node notes/local-only/prune-reliability-gates.mjs && pnpm format && pnpm run check:reliability-gates`; `pnpm test <paths under Test>` with the test-tail policy (expected trims: `use-automation-host-catalog.test.tsx`, `use-automation-host-catalog-readoption.test.tsx`, `NewWorkspaceComposerCard.test.tsx`, `AddRepoSteps.default-checkout.test.ts`, `use-add-repo-host-selection.test.ts`, `useAutomationDispatchEvents.test.ts`, `pty-connection-reattach-binding.test.ts`, `pty-connection-remote-runtime-attach.test.ts`, `pty-connection-runtime-owner-spawn-routing.test.ts`, `remote-hidden-output-restore-outcomes.test.ts`, `remote-hidden-output-restore-unavailable-banner.repro.test.ts`, `TerminalErrorToast.test.ts`, `ipc-error.test.ts`, `host-header-menu-items.test.ts`, `host-rename-remove.test.ts`); `pnpm run check:code-quality:changed`; `pnpm run check:local-only`.
- [ ] **Step 11: Commit.**
  ```
  refactor(local-only): remove sidebar SSH host flows, the remote file browser and SSH connects

  Delete the add-remote-host dialog, host selector, SSH target rows,
  remote file browser, host remove dialog and worktree-card SSH control;
  collapse add-project, clone, create and download paths to their local
  arms; drop the terminal deferred-attach SSH branch and every renderer
  call into window.api.ssh.

  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01PskLbdTqJNXxJ7KRnDoDoD
  ```

### Task B6-2.4: Preload — delete the `ssh` and `remoteWorkspace` bridges and the SSH-only transfer methods

**Files:**
- Delete: `src/preload/api/ssh-api.ts`, `src/preload/api/ssh-bridge.ts`, `src/preload/ssh-authority-forwarding.test.ts`, `src/preload/api/remote-workspace-bridge.ts`, `src/shared/remote-workspace-types.ts`, `src/shared/remote-workspace-session-projection.ts`, `src/shared/remote-workspace-session-projection.test.ts` (b6-main deletes `src/main/ipc/remote-workspace*.ts`, the only main importers of `shared/remote-workspace-types`; if those still exist when this task runs, keep the two shared files and note it in the commit body).
- Modify: `src/preload/index.ts:72,161` (+ the `remoteWorkspaceApi` import and `remoteWorkspace:` key, `rg -n remoteWorkspace src/preload/index.ts`), `src/preload/api-types.ts:50,129` (+ `remoteWorkspace` lines), `src/preload/api/workspace-session-api.ts:9-13,45-59` (the `remoteWorkspace` namespace type), `src/preload/api/fs-bridge.ts:53-61`, `src/preload/api/filesystem-api.ts:56-63`, `src/preload/api/repos-bridge.ts:18,45,47`, `src/preload/api/repository-api.ts:81-96` (`cloneRemote`, `createRemote`, `addRemote`), `src/preload/api/worktree-api.ts:85` (comment line only), `src/renderer/src/hooks/ipc-events-test-harness.ts:240`, `src/renderer/src/hooks/ipc-events-agent-status-window-test-fixtures.ts:21,140`, `src/renderer/src/lib/workspace-session-host-split.ts:34-35` (comment), `src/shared/rpc-contract/rpc-params-catalog.generated.ts` (only via `pnpm run generate:rpc-params-catalog`, no hand edit), `config/reliability-gates.jsonc`.
- Test (new, TDD): `src/preload/local-only-preload-surface.test.ts`; run `pnpm test src/preload src/renderer/src/hooks/ipc-events src/renderer/src/lib/workspace-session-host-split.test.ts`.

**Interfaces:** Consumes: main-side `ssh:*` and `remoteWorkspace:*` `ipcMain` handlers are already gone (b6-main). Produces: `PreloadApi` has no `ssh` and no `remoteWorkspace` key; `fs.downloadFile`/`fs.downloadFolder`/`repos.cloneRemote`/`repos.createRemote`/`repos.addRemote` no longer exist; every `connectionId?: string` optional parameter and `DocPreviewGrantOwner`'s `ssh` member stay.

- [ ] **Step 1 (RED): write the surface ratchet.** Create `src/preload/local-only-preload-surface.test.ts` (the electron mock scaffold is the one `ssh-authority-forwarding.test.ts:14-61` uses today; the runtime assertions are what make this RED under `pnpm test`, the `expectTypeOf` lines additionally fail `pnpm tc` once test files are in the typecheck program):
  ```ts
  import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest'
  import type { PreloadApi } from './api-types'

  const { exposeInMainWorld, invoke, on, removeListener, send, sendSync } = vi.hoisted(() => ({
    exposeInMainWorld: vi.fn(),
    invoke: vi.fn(),
    on: vi.fn(),
    removeListener: vi.fn(),
    send: vi.fn(),
    sendSync: vi.fn()
  }))

  vi.mock('electron', () => ({
    contextBridge: { exposeInMainWorld },
    ipcRenderer: { invoke, on, removeListener, send, sendSync },
    webFrame: {
      getZoomFactor: vi.fn(() => 1),
      setZoomFactor: vi.fn(),
      setVisualZoomLevelLimits: vi.fn()
    },
    webUtils: { getPathForFile: vi.fn(() => '') }
  }))

  // Why: the renderer compiles against PreloadApi and runs against the exposed object, so a
  // bridge that returns in an upstream merge would silently reopen an SSH call path. The type
  // assertions fail typecheck; the runtime assertions fail this test.
  describe('local-only preload surface', () => {
    const originalContextIsolated = Object.getOwnPropertyDescriptor(process, 'contextIsolated')

    beforeEach(() => {
      vi.resetModules()
      exposeInMainWorld.mockReset()
      Object.defineProperty(process, 'contextIsolated', { configurable: true, value: true })
      vi.stubGlobal('window', {
        addEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
        removeEventListener: vi.fn()
      })
      vi.stubGlobal('document', { addEventListener: vi.fn() })
    })

    afterEach(() => {
      vi.unstubAllGlobals()
      if (originalContextIsolated) {
        Object.defineProperty(process, 'contextIsolated', originalContextIsolated)
      } else {
        Reflect.deleteProperty(process, 'contextIsolated')
      }
    })

    it('exposes neither an SSH nor a remote-workspace bridge', async () => {
      await import('./index')
      const api = exposeInMainWorld.mock.calls.find(([name]) => name === 'api')?.[1] as PreloadApi
      expect(api).toBeDefined()
      expect(api).not.toHaveProperty('ssh')
      expect(api).not.toHaveProperty('remoteWorkspace')
      expect(api.fs).not.toHaveProperty('downloadFile')
      expect(api.fs).not.toHaveProperty('downloadFolder')
      expect(api.repos).not.toHaveProperty('cloneRemote')
      expect(api.repos).not.toHaveProperty('createRemote')
      expect(api.repos).not.toHaveProperty('addRemote')
    })

    it('types no SSH surface', () => {
      expectTypeOf<PreloadApi>().not.toHaveProperty('ssh')
      expectTypeOf<PreloadApi>().not.toHaveProperty('remoteWorkspace')
      expectTypeOf<PreloadApi['fs']>().not.toHaveProperty('downloadFile')
      expectTypeOf<PreloadApi['fs']>().not.toHaveProperty('downloadFolder')
      expectTypeOf<PreloadApi['repos']>().not.toHaveProperty('cloneRemote')
      expectTypeOf<PreloadApi['repos']>().not.toHaveProperty('createRemote')
      expectTypeOf<PreloadApi['repos']>().not.toHaveProperty('addRemote')
    })
  })
  ```
  Run `pnpm test src/preload/local-only-preload-surface.test.ts` → expected FAIL on `expect(api).not.toHaveProperty('ssh')` (the bridge is still exposed).
- [ ] **Step 2: Delete the bridges.** `git rm -q src/preload/api/ssh-api.ts src/preload/api/ssh-bridge.ts src/preload/ssh-authority-forwarding.test.ts src/preload/api/remote-workspace-bridge.ts`. `src/preload/index.ts`: delete line 72 (`import { sshApi } from './api/ssh-bridge'`), line 161 (`ssh: sshApi,`), and the `remoteWorkspaceApi` import plus `remoteWorkspace: remoteWorkspaceApi,` entry. `src/preload/api-types.ts`: delete line 50 (`import type { SshApi } from './api/ssh-api'`), line 129 (`ssh: SshApi`), and the `remoteWorkspace:` member (`rg -n remoteWorkspace src/preload/api-types.ts`). `workspace-session-api.ts`: delete lines 9-13 (the `remote-workspace-types` import) and the `remoteWorkspace: { … }` namespace (45-59).
- [ ] **Step 3: SSH-only transfer methods.** `fs-bridge.ts`: delete `downloadFile` (53-57) and `downloadFolder` (58-61). `filesystem-api.ts`: delete the two matching type members (56-63). `repos-bridge.ts`: delete lines 18 (`addRemote`), 45 (`cloneRemote`), 47 (`createRemote`). `repository-api.ts`: delete `cloneRemote` (81), `createRemote` (82-87), and `addRemote` with its `// Why:` comment (88-96). Leave `clone`, `cloneAbort`, every `connectionId?:` optional field, and `worktree-api.ts:134`'s `connectionId?: string | null`. Delete the comment at `worktree-api.ts:85` only (`// Forget a workspace from Orca only (no remote Git/FS work) — for workspaces pinned to a removed/disconnected SSH host.`) and keep `forgetLocal`.
- [ ] **Step 4: Shared remote-workspace types.** If `rg -l "shared/remote-workspace" src/main` is empty: `git rm -q src/shared/remote-workspace-types.ts src/shared/remote-workspace-session-projection.ts src/shared/remote-workspace-session-projection.test.ts`; then `rg -n "remote-workspace" src --glob '!*.test.*'` and delete each leftover import/comment (`workspace-session-host-split.ts:34-35` comment lines). Otherwise skip and record it for b6-main.
- [ ] **Step 5: Test harness stubs.** `ipc-events-test-harness.ts`: delete line 240 (`remoteWorkspace: createApiNamespaceStub({ clientId: () => Promise.resolve(null) })`). `ipc-events-agent-status-window-test-fixtures.ts`: delete the `remoteWorkspace?: Record<string, unknown>` field (21) and `remoteWorkspace: args.remoteWorkspace` (140). Then `rg -n "ssh: \{|ssh: createApiNamespaceStub|remoteWorkspace" src/renderer/src --glob '*.test.*' --glob '*fixture*' --glob '*harness*'` and delete each stub entry for the removed namespaces (keep `'ssh:…'` host-id fixtures).
- [ ] **Step 6: RPC catalog and typecheck.** `pnpm run generate:rpc-params-catalog` (b6-main already removed `ssh.*` methods; this must be a no-op, verified by `pnpm run verify:rpc-params-catalog`). `pnpm tc` — expected green; the GREEN run of `pnpm test src/preload/local-only-preload-surface.test.ts` passes.
- [ ] **Step 7: Sweep.** `rg -n "ipcRenderer\.(invoke|on)\('(ssh|remoteWorkspace):" src/preload` → no hits; `rg -n "api\.ssh\b|window\.api\.ssh|window\.api\.remoteWorkspace" src/renderer src/preload` → no hits (tests included).
- [ ] **Step 8: Tests and gates.** `node notes/local-only/prune-reliability-gates.mjs && pnpm format && pnpm run check:reliability-gates`; `pnpm test src/preload src/renderer/src/hooks src/renderer/src/lib`; `pnpm run check:code-quality:changed`; `pnpm run check:local-only`.
- [ ] **Step 9: Commit.**
  ```
  refactor(local-only): drop the preload SSH and remote-workspace bridges

  Delete window.api.ssh and window.api.remoteWorkspace, the SSH-only
  download and remote repo methods on fs and repos, and the shared
  remote-workspace types. Optional connectionId parameters stay inert.
  A type-level test pins the surface.

  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01PskLbdTqJNXxJ7KRnDoDoD
  ```

### Task B6-2.5: Localization — prune the orphaned SSH catalog keys

**Files:**
- Modify: `src/renderer/src/i18n/locales/{en,es,fr,ja,ko,zh}.json`, `src/renderer/src/i18n/en-runtime-required.json` (via `pnpm run sync:localization-runtime-catalog`), `config/localization-coverage-allowlist.json` (only rows whose file no longer exists; none today).
- Test: `pnpm run verify:localization-catalogs && pnpm run verify:localization-extraction && pnpm run verify:localization-coverage && pnpm test src/renderer/src/i18n`.

**Interfaces:** Consumes: B6-2.1–B6-2.4 (and B5's pane deletions) have removed every literal `translate('…')` call site of the SSH namespaces (`auto.components.settings.SshPane`, `SshTargetForm`, `SshTargetCard`, `SshPassphraseDialog`, `SshDestructiveActionDialog`, `SshTargetDestructiveActions`, `auto.components.settings.ssh.search`, `settings.browser.sshWorkspaceRouting`, `auto.components.settings.browser.search.sshWorkspaceRouting`, `auto.components.status.bar.SshStatusSegment`, `SshTargetStatusRow`, `auto.components.terminal.pane.TerminalSshReconnectOverlay`, `auto.components.sidebar.AddRemoteHostDialog`, `ForgetSshWorkspaceDialog`, `WorktreeCardSshHostControl`, `SshTargetRow`, `AddRepoHostSelector`, `AddRepoRemoteStep`, `HostRemoveDialog`, `RemoteFileBrowser`, `browser.sshRoute`, `browser.sshEgress`, `auto.ssh.sshConnectVerb`, and the SSH keys inside `NewWorkspaceComposerCard`, `WorktreeOpenInMenu`, `HostSectionHeaderMenu`, `useAutomationDispatchEvents`, `useComposerState` — 319 `en.json` leaves carry `ssh` in their path, roughly 600 more belong to the deleted components). Produces: six locale files and the runtime catalog with no unreferenced SSH keys; `verify:localization-*` exit 0.

- [ ] **Step 1: Prune orphans** (Spec A's snippet with an SSH suspect list; requires `rg` on PATH):
  ```bash
  node -e '
  const fs=require("fs"),cp=require("child_process");
  const dir="src/renderer/src/i18n/locales";const en=JSON.parse(fs.readFileSync(dir+"/en.json","utf8"));
  const flat=(o,p="",out=[])=>{for(const[k,v]of Object.entries(o)){const key=p?p+"."+k:k;typeof v==="string"?out.push(key):flat(v,key,out)}return out};
  const suspect=/ssh|Ssh|SSH|AddRemoteHost|RemoteFileBrowser|HostRemoveDialog|HostSectionHeaderMenu|AddRepoHostSelector|AddRepoRemoteStep|remoteBrowsing|remoteEgress|hostStatus|NewWorkspaceComposerCard|WorktreeOpenInMenu|useAutomationDispatchEvents|useComposerState|SidebarWorkspaceOptionsMenu|appearance\.search|StatusBar\.|auto\.hooks\.useIpcEvents|auto\.lib\.|auto\.hooks\.|auto\.startup\.|remotePairingCopy/;
  const orphan=flat(en).filter(k=>suspect.test(k)&&cp.spawnSync("rg",["-q","-F",k,"src/renderer/src","src/main","src/shared","src/preload"]).status!==0);
  const del=(o,path)=>{const[h,...r]=path;if(!o||!(h in o))return;if(r.length===0){delete o[h];return}del(o[h],r);if(o[h]&&typeof o[h]==="object"&&Object.keys(o[h]).length===0)delete o[h]};
  for(const f of fs.readdirSync(dir)){const p=dir+"/"+f;const c=JSON.parse(fs.readFileSync(p,"utf8"));for(const k of orphan)del(c,k.split("."));fs.writeFileSync(p,JSON.stringify(c,null,2)+"\n")}
  console.log("pruned",orphan.length,"keys");'
  ```
  Expected: `pruned N keys` with N ≥ 319. Spot-check: `rg -c '"SshPane"|"SshTargetForm"|"TerminalSshReconnectOverlay"|"AddRemoteHostDialog"' src/renderer/src/i18n/locales/en.json` → 0.
- [ ] **Step 2: Runtime catalog and formatting.** `pnpm run sync:localization-runtime-catalog && pnpm format`.
- [ ] **Step 3: Verify.** `pnpm run verify:localization-catalogs && pnpm run verify:localization-extraction && pnpm run verify:localization-coverage`. If `verify:localization-catalog` reports a key still referenced (a dynamic key the literal search missed), restore that key in all six locales from `git show HEAD:src/renderer/src/i18n/locales/<locale>.json` and re-run. `pnpm test src/renderer/src/i18n`. `pnpm tc`; `pnpm run check:code-quality:changed`; `pnpm run check:local-only`.
- [ ] **Step 4: Commit.**
  ```
  fix(local-only): prune the orphaned SSH locale keys

  Drops the SSH settings, host dialog, status segment, reconnect overlay
  and browser-routing strings from all six locales and the runtime
  catalog now that their components are gone.

  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01PskLbdTqJNXxJ7KRnDoDoD
  ```

### Task B6-2.6: CLI — refuse `--host ssh:`, drop SSH target selectors, `host list` and SSH automation destinations

**Files:**
- Delete: `src/cli/host-selector-alternatives.ts`, `src/cli/host-selector-alternatives.test.ts`, `src/cli/index-omitted-host-scope-selectors.test.ts` (rewrite not worth it: its only SSH case is the runtime round trip; local/omitted-host cases are covered by `index-terminal-list-host-scope.test.ts`) — keep `src/cli/omitted-host-scope-selectors.ts`.
- Modify: `src/cli/execution-host-flag.ts:1-14,18-26,38-45,126-148,174-207`, `src/cli/execution-host-flag.test.ts` (new cases + delete the ssh/`resolveHostFlagTarget` cases at 70, 192, 254), `src/cli/omitted-host-scope-selectors.ts:7-12,39-41,55-58,61,76-91`, `src/cli/worktree-project-target.ts:3,76`, `src/cli/handlers/project.ts:13,27-28,64,71,100,115-117,157`, `src/cli/index.ts:17,34-37,55-58,126-127,140-142`, `src/cli/automation-destination.ts:5-10,19,42-59,69-76`, `src/cli/format.ts:78-120` (`HostListEntry`, `formatHostList`, `formatHostConnection`), `src/cli/automation-format.ts:33-35,41-43`, `src/cli/automation-owner-conflict-recovery.ts:5,23-24`, `src/cli/handler-group-manifest.ts:194`, `src/cli/handlers/environment.ts:64-104` and `src/cli/specs/environment.ts:17-32` (`host list`; whole files are B5's — delete only `host list` if B5 left them), `src/cli/specs/project.ts:39,55`, `src/cli/specs/core.ts:259`, `src/cli/specs/search.ts:30`, `src/cli/specs/introspection.ts:11`, `src/cli/handlers/introspection.ts:7`, `src/cli/runtime/orchestration-compatibility-envelope.ts:10`, `src/cli/handlers/automations.ts:129`, `src/cli/handlers/account.ts:258` (comment-only sites: delete the SSH clause of each sentence), `config/reliability-gates.jsonc`.
- Test: `pnpm test src/cli`.

**Interfaces:** Consumes: `parseExecutionHostId` still parses `ssh:`/`runtime:` (inert union, b6-main does not narrow); `RuntimeClientError(code: string, …)` (`src/cli/runtime/types.ts:10-16`, open code string). B5 has removed `runtime:` host routing (`resolveHostFlagEnvironmentId`, `assertEnvironmentSelectorResolvable`, `listEnvironments`). Produces: `parseHostFlag` accepts only `local` and fails closed on anything else with code `invalid_argument` (I4); `resolveHostFlagTarget` is gone and every caller uses `parseHostFlag`; `AutomationDestination` selectors are always `{ kind: 'self' }` for a reachable repo; no `ssh.listTargetSummaries`/`ssh.listTargets`/`ssh.getState` RPC call exists in `src/cli`.

- [ ] **Step 1 (RED): fail-closed test.** In `src/cli/execution-host-flag.test.ts` add, next to the existing `parseHostFlag` cases (`parseHostFlag` is already imported at line 25):
  ```ts
  it('refuses an ssh host selector in this local-only build', () => {
    expect(() => parseHostFlag(new Map([['host', 'ssh:devbox']]))).toThrow(
      /Unsupported --host value: ssh:devbox/
    )
  })

  it('refuses a runtime host selector in this local-only build', () => {
    expect(() => parseHostFlag(new Map([['host', 'runtime:03ef704c']]))).toThrow(
      /Unsupported --host value: runtime:03ef704c/
    )
  })
  ```
  `pnpm test src/cli/execution-host-flag.test.ts` → the two new cases FAIL (the current code returns the parsed host).
- [ ] **Step 2 (GREEN): `execution-host-flag.ts`.** Replace lines 38-45 of `parseHostFlag` with (the existing `Invalid --host value` throw stays for unparsable input — `execution-host-flag.test.ts:55` asserts it — only its message tail changes):
  ```ts
    const parsed = parseExecutionHostId(raw)
    if (!parsed) {
      throw new RuntimeClientError('invalid_argument', `Invalid --host value: ${raw}. Expected local.`)
    }
    if (parsed.kind !== 'local') {
      // Why: ssh: and runtime: ids still parse (the unions are inert) but nothing can host them in
      // this build, so a legacy selector fails closed here rather than filtering to nothing.
      throw new RuntimeClientError(
        'invalid_argument',
        `Unsupported --host value: ${raw}. This build runs on this machine only; use --host local.`
      )
    }
    return parsed
  ```
  (If B5 already added a `runtime` rejection in this function, fold the `ssh` case into that same `kind !== 'local'` check instead of adding a third throw.) Delete `resolveHostFlagTarget` (lines 126-148, comment through closing brace), the `toSshExecutionHostId` import (5), the `host-selector-alternatives` import block (8-14), and the `listSshTargets` member of `HostFlagRoutingSelection` (19-21) if B5 left the type; delete `assertEnvironmentSelectorResolvable` (174-207) if B5 left it. Run the test → GREEN.
- [ ] **Step 3: Callers.** `worktree-project-target.ts`: line 3 → `import { hostFilterMatchesHostId, parseHostFlag } from './execution-host-flag'`; line 76 → `const host = parseHostFlag(flags)`. `handlers/project.ts`: delete line 28 (`resolveHostFlagTarget`), change line 64 and 100 to `parseHostFlag(flags)` (drop the `await`), delete line 13 (`getSshTargetIdForExecutionHost` import) and change line 117 to `const pathIsOffClient = client.isRemote` (B5 may already have reduced `client.isRemote`; if it did, delete the whole `pathIsOffClient` guard and its consumer), delete the SSH sentences in the comments at 71, 115-116, 157. `index.ts`: delete line 17 (`import { listSshTargets } from './host-selector-alternatives'`), lines 126-127 (`listSshTargetsForSuggestion`), the `listSshTargets: listSshTargetsForSuggestion,` property and its comment (140-142) if the `resolveHostFlagEnvironmentId` call survived B5, line 37 (`commandPath.join(' ') === 'host list' ||` with its three comment lines 34-36), and the comment lines 55-58 (`// Why: the SSH relay bridge executes this CLI …` through `… resolve against the caller's directory.`) — keep `resolveInvocationCwd` and `ORCA_CLI_CWD` (WSL uses them).
- [ ] **Step 4: Omitted host selectors.** `omitted-host-scope-selectors.ts`: delete lines 7-12 (the `host-selector-alternatives` import), the `sshTargets` round trip (55-58) and its use (61 → `selector: resolveSelector(host, environments)` or, after B5, `resolveSelector(host)`), the `sshTargets` parameter (79) and the `if (host?.kind === 'ssh') { … }` arm (84-86) of `resolveSelector`; delete the `environments` arm (87-90) only if B5 has not. Replace the doc sentence at 39 (`… and \`docs/reference/ssh-execution-boundary.md\` requires a listing to name its gaps.`) by deleting the clause after the comma, and delete `and SSH-target registry` from line 41.
- [ ] **Step 5: `host list` and formatters.** If B5 left `handlers/environment.ts`: delete the `'host list'` handler (64-104, comment through the closing `},`) and the `['host', 'list']` spec in `specs/environment.ts` (17-32); otherwise skip. `handler-group-manifest.ts`: delete line 194 (`'host list',`). `format.ts`: delete `HostListEntry` (78-88), `formatHostList` (89-104), `formatHostConnection` (115-~125); keep `formatHostName`. `automation-destination.ts`: delete `sshTargetGeneration` (42-59), the `SshTargetSummary` import (19), lines 73-76 (`const generation = …` through the `: { selector: { kind: 'ssh', … } }`), and the `const connectionId = repo.connectionId?.trim(); if (!connectionId) {` guard (69-70) so the function ends `return { selector: { kind: 'self' } }` after resolving the repo; delete the doc paragraph lines 5-10 that describe SSH registrations. `automation-format.ts`: delete the two `if (selector.kind === 'ssh') { return \`ssh:…\` }` blocks (33-35, 41-43). `automation-owner-conflict-recovery.ts`: delete the two SSH next-step strings (23-24) and the comment at 5 — keep the `automation_target_removed` entry with its remaining copy.
- [ ] **Step 6: Help text.** `specs/project.ts`: delete lines 39 and 55 (`'SSH targets are set up/cloned through the desktop UI …'`). `specs/core.ts:259`: delete the clause `terminals routed over SSH resolv…` up to its closing punctuation (re-anchor with `rg -n 'routed over SSH' src/cli/specs/core.ts`). `specs/search.ts:30`: delete `In an Orca SSH terminal, the forwarded CLI searches the controlling Orca runtime by default. `. `specs/introspection.ts:11` and `handlers/introspection.ts:7`: delete `so it is safe over SSH and in headless contexts` → keep `works without a running Orca app`. `runtime/orchestration-compatibility-envelope.ts:10`, `handlers/automations.ts:129`, `handlers/account.ts:258`: delete the SSH clause of each comment.
- [ ] **Step 7: Delete files and typecheck.** `git rm -q src/cli/host-selector-alternatives.ts src/cli/host-selector-alternatives.test.ts src/cli/index-omitted-host-scope-selectors.test.ts`. `pnpm tc`. `pnpm run build:cli` (the CLI bundle must still build). Sweep: `rg -n "ssh\.(listTargetSummaries|listTargets|getState)|SshTargetSummary|--host ssh|host-selector-alternatives" src/cli` → no hits; `rg -n "ssh" src/cli --glob '!bundled-skill-guides.ts' --glob '!*.test.*' -i` → only `WindowsShell*` identifiers and `ORCA_CLI_CWD` remain.
- [ ] **Step 8: Tests and gates.** `pnpm test src/cli` with the test-tail policy (expected trims: `execution-host-flag.test.ts:70,192,254`, `index-project-setup.test.ts:237-290,484`, `handlers/automation-destination-fencing.test.ts:81-130` (SSH fence cases; keep the `self` cases), `automation-format.test.ts:39`, `index.test.ts`/`index-local-command-routing-flags.test.ts` `host list` expectations, `terminal-list-host-scope-format.test.ts` / `index-terminal-list-host-scope.test.ts` ssh selector rows). `node notes/local-only/prune-reliability-gates.mjs && pnpm format && pnpm run check:reliability-gates`; `pnpm run check:code-quality:changed`; `pnpm run check:local-only`.
- [ ] **Step 9: Commit.**
  ```
  refactor(local-only): make the CLI refuse ssh hosts and drop SSH target selectors

  --host accepts only local and fails closed on ssh:/runtime: ids. Remove
  the SSH target lookup, host list, SSH automation destinations and the
  SSH clauses of the command help.

  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01PskLbdTqJNXxJ7KRnDoDoD
  ```

### Task B6-2.7: e2e — SSH specs, helpers, fixtures, tools, runner scripts, routing and shard timings

**Files:**
- Delete: `tests/e2e/ssh-*.spec.ts` (all 36: `ssh-ai-vault-session-history`, `ssh-codex-display-artifacts-repro`, `ssh-cold-activation-restore`, `ssh-cold-hydration-gap-tab-seeding`, `ssh-config-host-import`, `ssh-config-host-picker`, `ssh-docker-bulk-open-freeze-repro`, `ssh-docker-five-pane-input-under-flood`, `ssh-docker-half-open-link`, `ssh-docker-quick-open-large-listing`, `ssh-docker-reconnect-pane-restore`, `ssh-docker-relay-perf`, `ssh-docker-relay-stall-credential`, `ssh-docker-resource-accumulation`, `ssh-docker-transport-drop-recovery`, `ssh-docker-watcher-isolation`, `ssh-egress-indicator-preview`, `ssh-external-image-preview`, `ssh-host-form-modal`, `ssh-localhost`, `ssh-lost-kill-tab-resurrection`, `ssh-pi-compatible-agent-title`, `ssh-port-forward-lifecycle`, `ssh-reconnect-tab-destruction`, `ssh-restart-tab-accumulation`, `ssh-route-error-card-preview`, `ssh-routing-optout-demo`, `ssh-stale-resume-execution-host-scope`, `ssh-startup-exec-readiness`, `ssh-terminal-parking`, `ssh-terminal-window-wake-stale-grid-repro`), `tests/e2e/ssh-codex-real-remote.ts`, `tests/e2e/ssh-codex-reconnect-replay-driver.ts`, `tests/e2e/ssh-codex-replay-reply-probe.ts`, `tests/e2e/ssh-codex-replay-reply-probe.unit.test.ts`, `tests/e2e/ssh-codex-repro-remote-fixtures.ts`, `tests/e2e/ssh-codex-terminal-observers.ts`, `tests/e2e/ssh-terminal-stale-grid-probe.ts`, `tests/e2e/ssh-config-host-picker.PLAN.md`, `tests/e2e/ssh-browser-network-execution-route.docker.unit.test.ts`, `tests/e2e/direct-ssh-snapshot-parking.unit.test.ts`, `tests/e2e/local-ssh-browser-routing.spec.ts`, `tests/e2e/pty-input-write-queue-ssh.spec.ts`, `tests/e2e/terminal-inline-images-ssh.spec.ts`, `tests/e2e/terminal-retention-budget.spec.ts` (Docker-SSH-only despite its name: `test.skip(!RUN_DOCKER_SSH …)` at line 38), `tests/e2e/helpers/docker-ssh-relay-{connection,faults,image,processes,target,terminal-tabs,worktree-activation}.ts`, `tests/e2e/helpers/ssh-config-host-picker.ts`, `tests/e2e/helpers/ssh-port-forward-lifecycle-evidence.ts`, `tests/e2e/helpers/ssh-port-forward-snapshot-barrier.ts`, `tests/e2e/helpers/ssh-port-forward-snapshot-barrier.unit.test.ts`, `tests/e2e/helpers/ssh-port-forward-transport-evidence.ts`, `tests/e2e/helpers/ssh-reconnect-failure-observation.ts`, `tests/e2e/helpers/ssh-recovery-input-observation.ts`, `tests/e2e/helpers/ssh-remote-only-browser-fixture.ts`, `tests/e2e/helpers/ssh-test-target-connection.ts`, `tests/e2e/fixtures/docker-ssh-relay/` (whole dir), `tests/tools/omp-relay-close-lifecycle.test.mjs`, `tests/tools/omp-relay-close-lifecycle.md` (imports `src/relay/pty-handler-test-harness.ts`, gone with b6-main; `tests/tools/omp-config-root-relay-shell.test.mjs` imports `relay/plugin-overlay`, a WSL survivor — keep), `config/scripts/run-ssh-docker-e2e.mjs`, `run-ssh-docker-perf-e2e.mjs`, `run-ssh-docker-watcher-isolation-e2e.mjs`, `run-ssh-docker-terminal-parking-e2e.mjs`, `run-ssh-docker-bulk-open-freeze-e2e.mjs`, `run-ssh-codex-artifacts-repro-e2e.mjs`, `run-local-ssh-browser-routing-e2e.mjs`, `run-ssh-staged-upload-reliability.mjs`, `ssh-cleanup-tab-map-benchmark.mjs`, `ssh-source-frontier-benchmark.mjs`, `ssh-watch-fanout-benchmark.mjs`, `windows-ssh-attach-console-repro.mjs`, `ssh-browser-e2e-routing.test.mjs`, `ssh-docker-ci-sharding.test.mjs`, `ssh-localhost-e2e-routing.test.mjs`.
- Modify: `package.json` (scripts `test:e2e:ssh-docker-perf`, `test:e2e:ssh-docker-watcher-isolation`, `test:e2e:ssh-docker`, `test:e2e:local-ssh-browser`, `test:e2e:ssh-docker-terminal-parking`, `test:e2e:ssh-codex-artifacts-repro`, `test:e2e:ssh-docker-bulk-open-freeze`), `tests/e2e/global-setup.ts:18,70-89`, `tests/e2e/global-setup-cli-artifact.unit.test.ts:18,27-29`, `tests/e2e/helpers/orca-app.ts:244-252`, `tests/e2e/helpers/orca-restart.ts:99-101`, `tests/e2e/helpers/browser-pane-mount-census.ts:11,25-29`, `tests/e2e/helpers/electron-process-shutdown.ts:27` (comment), `tests/e2e/helpers/host-created-terminal-retention-oracle.ts:50,55`, `tests/e2e/helpers/terminal-inline-image-proof.ts:11` (string), `config/scripts/pr-e2e-source-routing.mjs:16-45,67-104,193-203,217-220,240-241`, `config/scripts/pr-e2e-gate-contract.test.mjs:8,12,26-28,127-131,148-155,164,170,201-264,267-284,293-336,339-400`, `config/scripts/pr-e2e-native-only-routing.test.mjs:20`, `config/scripts/ci-shard-timings.json` (via the snippet), `config/performance-audit.md:31-32`, `config/reliability-gates.jsonc`.
- Test: `pnpm test config/scripts/pr-e2e-gate-contract.test.mjs config/scripts/pr-e2e-native-only-routing.test.mjs tests/e2e/global-setup-cli-artifact.unit.test.ts`, `pnpm run typecheck:e2e` (error count must not rise above the Spec A baseline of 166), `pnpm run check:reliability-gates`.

**Interfaces:** Consumes: `tests/e2e/ephemeral-vm-provisioned-root.spec.ts` is B1's (it also imports docker-ssh helpers; if B1 has not deleted it when this task runs, delete it here and say so in the commit body). Produces: no spec reads `ORCA_E2E_SSH_*`; `global-setup.ts` never builds the SSH relay or the Docker image; `pr-e2e-source-routing.mjs` has no SSH routes and `SSH_SOURCE_ROUTE_IDS`/`hasSshSourceChange`/`--ssh-source` are gone (B6-2.8 removes their workflow consumers in the same ordering: run B6-2.8 right after, CI is red in between only on the fork's own PR workflow).

- [ ] **Step 1: Delete.** `git rm -q tests/e2e/ssh-*.ts tests/e2e/ssh-config-host-picker.PLAN.md tests/e2e/direct-ssh-snapshot-parking.unit.test.ts tests/e2e/local-ssh-browser-routing.spec.ts tests/e2e/pty-input-write-queue-ssh.spec.ts tests/e2e/terminal-inline-images-ssh.spec.ts tests/e2e/terminal-retention-budget.spec.ts tests/e2e/helpers/docker-ssh-relay-*.ts tests/e2e/helpers/ssh-*.ts tests/tools/omp-relay-close-lifecycle.test.mjs tests/tools/omp-relay-close-lifecycle.md config/scripts/run-ssh-*.mjs config/scripts/run-local-ssh-browser-routing-e2e.mjs config/scripts/ssh-*-benchmark.mjs config/scripts/windows-ssh-attach-console-repro.mjs config/scripts/ssh-browser-e2e-routing.test.mjs config/scripts/ssh-docker-ci-sharding.test.mjs config/scripts/ssh-localhost-e2e-routing.test.mjs && git rm -r -q tests/e2e/fixtures/docker-ssh-relay`. Expected: `rg --files tests config/scripts | rg -i 'ssh'` prints only `config/scripts/ssh-hostile-hosts-workflow.test.mjs` and `config/scripts/ssh-windows-hosts-workflow.test.mjs` (B6-2.8 deletes those with their workflows).
- [ ] **Step 2: `package.json`.** Delete the seven `test:e2e:ssh-*` / `test:e2e:local-ssh-browser` script lines. `rg -n 'ssh' package.json` → only `@types/ssh2` (devDependency, kept by design) and nothing else.
- [ ] **Step 3: e2e harness.** `global-setup.ts`: delete line 18 (`import { prepareDockerSshRelayImage } from './helpers/docker-ssh-relay-image'`), the whole SSH relay-build gate (lines 70-85: `if ( process.env.ORCA_E2E_SSH_LOCALHOST === '1' || … ORCA_E2E_SKILL_SSH_HOST …) { … execSync('pnpm run build:relay', …) }` — every condition is SSH) and the Docker image block (86-89: `if (process.env.ORCA_E2E_SSH_DOCKER === '1' || process.env.ORCA_E2E_NESTED_RUNTIME_SSH === '1') { … prepareDockerSshRelayImage(root) }`); then `rg -n 'outLinuxRelay' tests/e2e/global-setup.ts` and delete its now-unused declaration. The WSL relay e2e (`windows-wsl-e2e.yml`) builds the relay in the workflow, not here. `global-setup-cli-artifact.unit.test.ts`: delete line 18 (`vi.mock('./helpers/docker-ssh-relay-image', …)`) and lines 27-29 (the three `ORCA_E2E_*SSH*` names). `orca-app.ts:244-252` and `orca-restart.ts:99-101`: delete the spread `...((process.env.ORCA_E2E_SSH_LOCALHOST === '1' || … ) && { … })` with its comment, keeping the surrounding env object. `browser-pane-mount-census.ts`: delete the four SSH gate-card constants (25-29) and the comment at 11, plus their uses (`rg -n GATE_PREPARING_TITLE tests/e2e/helpers`). `host-created-terminal-retention-oracle.ts:55`: delete `!ptyId.startsWith('ssh-') &&` and the SSH half of the comment at 50. `electron-process-shutdown.ts:27` and `terminal-inline-image-proof.ts:11`: delete the SSH words from the comment/string.
- [ ] **Step 4: PR routing script.** `pr-e2e-source-routing.mjs`: delete the route objects `ssh.localhost-agent-hooks` (16-23), `browser-network.ssh-docker-route` (24-35), `browser.local-ssh-workspace-route` (36-45), `ssh-terminal-source` (67-91) and `ssh-workspace-session-restore` (92-~104); delete `SSH_SOURCE_ROUTE_IDS` and `hasSshSourceChange` (193-203); in `shouldRunReusablePrE2e` delete the comment line 217 and the `hasSshSourceChange(changedPaths) ||` clause (219); delete the `--ssh-source` branch (240-241). `pr-e2e-gate-contract.test.mjs`: delete the imports `hasSshSourceChange`, `SSH_SOURCE_ROUTE_IDS` (8, 12), `sshDockerRunner` (26-28), the three `expect(changedRun.run).toContain('. != "tests/e2e/ssh-…"')` lines (127-131), the `it`s titled `keeps startup-exec live parity in the isolated SSH lane`, `maps SSH source edits onto the Docker-backed specs they can break`, `routes direct-SSH workspace and tab restore from its unnamed source seams`, `triggers the Docker-SSH lane from SSH source, not from a spec name`, `gives every Docker-gated SSH spec a lane that runs it` and the SSH expectations inside the remaining lane loops (164, 170: drop `'ssh-docker-watcher-isolation'` from the job-name arrays). `pr-e2e-native-only-routing.test.mjs:20`: delete `'tests/e2e/ssh-startup-exec-readiness.spec.ts',`. `config/performance-audit.md:31-32`: delete the sentence naming `test:e2e:ssh-docker-perf` and `SSH RTT`.
- [ ] **Step 5: Shard timings.** Prune every key whose file no longer exists:
  ```bash
  node -e '
  const fs=require("fs");const f="config/scripts/ci-shard-timings.json";const d=JSON.parse(fs.readFileSync(f,"utf8"));
  let n=0;for(const lane of ["unit","e2e"]){const t=d[lane].timings;for(const k of Object.keys(t)){if(!fs.existsSync(k)){delete t[k];n++}}}
  fs.writeFileSync(f,JSON.stringify(d,null,2)+"\n");console.log("pruned",n)' && pnpm format
  ```
  Expected: `pruned N` with N ≥ 40 (the SSH specs, helpers and `config/scripts/ssh-*.test.mjs` keys, plus any stale b6-main keys). `rg -c '"tests/e2e/ssh-' config/scripts/ci-shard-timings.json` → 0.
- [ ] **Step 6: Typecheck and tests.** `pnpm tc`; `pnpm run typecheck:e2e` (count errors with `… 2>&1 | rg -c 'error TS'`; must be ≤ 166); `pnpm test config/scripts/pr-e2e-gate-contract.test.mjs config/scripts/pr-e2e-native-only-routing.test.mjs tests/e2e/global-setup-cli-artifact.unit.test.ts tests/tools/omp-config-root-relay-shell.test.mjs`. Note: `pr-e2e-gate-contract.test.mjs` also reads `e2e.yml`/`pr.yml`; the SSH-lane expectations removed here must match B6-2.8's workflow cuts — run B6-2.8 immediately after and re-run this test there.
- [ ] **Step 7: Gates and sweeps.** `node notes/local-only/prune-reliability-gates.mjs && pnpm format && pnpm run check:reliability-gates` (expected deletions include `ssh.localhost-terminal-agent-hooks`, `ssh.docker-recovery-and-resource-lifecycle`, `ssh-port-forward.renderer-snapshot-continuity`, `terminal-provider.ssh-remote-reattach-contract` and prunes in `git-worktree.refresh-event-semantics`, `terminal-session.shell-ready-exec-prompt-fallback`, `terminal-input.cooked-reply-queue`, `terminal-performance.output-backpressure-budget`, `browser-network-tunnel.bounded-fail-closed-route`, `browser-client-host.*`, `terminal-provider.snapshot-capability-renderer-responsiveness`, `workspace-session.ssh-host-partition-round-trip`). `rg -n "ORCA_E2E_SSH|ORCA_RUN_DOCKER_SSH|docker-ssh-relay|ORCA_E2E_NESTED_RUNTIME_SSH" tests config src package.json` → only hits inside `.github` (B6-2.8) and `config/reliability-gates.jsonc` evidence summaries, if any. `pnpm run check:code-quality:changed`; `pnpm run check:local-only`.
- [ ] **Step 8: Commit.**
  ```
  test(local-only): remove the SSH e2e specs, Docker sshd fixture and SSH e2e routing

  Delete the SSH and Docker-SSH Playwright specs, their helpers, the sshd
  Docker fixture, the SSH runner scripts and routing tests; drop the SSH
  env gates from the e2e harness, the SSH routes from PR e2e routing and
  the stale shard-timing keys.

  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01PskLbdTqJNXxJ7KRnDoDoD
  ```

### Task B6-2.8: CI — SSH workflows, lanes and workflow contract tests

**Files:**
- Delete: `.github/workflows/ssh-hostile-hosts.yml`, `.github/workflows/ssh-windows-hosts.yml`, `.github/workflows/relay-windows-process-tree.yml`, `.github/workflows/node-server-tests.yml` (orcad qualification lanes; delete if B3 has not), `config/ci/windows-ssh-provider/` (whole dir: `invoke-pinned-relay-cells.ps1`, `preview-ssh`), `config/scripts/ssh-hostile-hosts-workflow.test.mjs`, `config/scripts/ssh-windows-hosts-workflow.test.mjs`, `config/scripts/relay-windows-process-tree-workflow-contract.test.mjs`, `config/scripts/node-server-change-scope.mjs`, `config/scripts/node-server-change-scope.test.mjs`, `config/scripts/node-server-qualification.mjs`, `config/scripts/run-node-server-tests.mjs`, `config/scripts/orcad-template-release-workflow.test.mjs` (all four node-server/orcad-template scripts only if B3 has not), `.github/workflows/e2e.yml` jobs `ssh-docker-watcher-isolation` (332-444), `ssh-browser-network-route` (445-464), `ssh-localhost` (465-~530).
- Modify: `.github/workflows/pr.yml:52,129-133,1002-1004,1072` (`ssh_source_changed` plumbing and three Windows-shard SSH test paths; the `orcad_browser` job 45,665-700,1110,1146-1147,1186 is B3's — delete it here only if B3 has not), `.github/workflows/e2e.yml:20-21,85-87,251-253,273-301,309-315` (the `ssh_source_changed` input, the relay-marker comment, the `openssh-client` apt line and its comment, the 29 `. != "tests/e2e/…ssh…"` exclusion lines in the `changed-e2e` step, the `ORCA_E2E_SSH_DOCKER` block), `.github/workflows/release-cut.yml:1188-1195,1203-1205,1404-1453` (`relay-windows-process-tree` job, its `needs` entries and the `Gate SSH relay watcher process isolation` step and the relay download; `orcad-template` 1152-1187, 1209, 1439-1443, 1594-1596, 1781-1784, 2265-2268 are B3's — delete here only if B3 has not), `.github/workflows/unit-tests.yml:12` (description text `relay integration keeps its x86 host`), `.github/dependabot.yml:3-4` (comment: drop `and to SSH remotes` and `(the SSH cache keys on the binary's hash)`), `config/scripts/release-cut-token-permissions.test.mjs:15-23,30-34` (the `e2e.yml#ssh-*`, `node-server-tests.yml#*` and `orcad-template` expectations), `package.json` (`test:node-server` script, if B3 has not), `config/reliability-gates.jsonc`.
- Test: `pnpm test config/scripts/pr-e2e-gate-contract.test.mjs config/scripts/release-cut-token-permissions.test.mjs config/scripts/pr-workflow-parallelism.test.mjs config/scripts/pr-code-change-scope.test.mjs`, `pnpm run check:reliability-gates`.

**Interfaces:** Consumes: B6-2.7's `pr-e2e-source-routing.mjs` without `--ssh-source`; B3's orcad removal (`node-server-tests.yml`, `orcad-template`, `orcad_browser` are orcad lanes listed under this unit by the brief — delete whatever B3 left, never duplicate). Produces: no workflow installs `openssh-server`, starts `sshd`, builds a Docker sshd image or reads `ORCA_E2E_SSH_*`; `windows-wsl-e2e.yml` and `e2e.yml` keep `pnpm run build:relay` (the WSL relay bundles still ship).

- [ ] **Step 1: Delete the workflows and their contract tests.** `git rm -q .github/workflows/ssh-hostile-hosts.yml .github/workflows/ssh-windows-hosts.yml .github/workflows/relay-windows-process-tree.yml config/scripts/ssh-hostile-hosts-workflow.test.mjs config/scripts/ssh-windows-hosts-workflow.test.mjs config/scripts/relay-windows-process-tree-workflow-contract.test.mjs && git rm -r -q config/ci/windows-ssh-provider`. If `.github/workflows/node-server-tests.yml` still exists: `git rm -q .github/workflows/node-server-tests.yml config/scripts/node-server-change-scope.mjs config/scripts/node-server-change-scope.test.mjs config/scripts/node-server-qualification.mjs config/scripts/run-node-server-tests.mjs config/scripts/orcad-template-release-workflow.test.mjs` and delete the `test:node-server` script from `package.json`. Expected: `ls .github/workflows | rg -i 'ssh|relay-windows|node-server'` → nothing.
- [ ] **Step 2: `pr.yml`.** Delete line 52 (`ssh_source_changed: ${{ steps.e2e_filter.outputs.ssh_source_changed }}`), lines 129-133 (the `# Why a separate signal …` comment, `SSH_SOURCE_CHANGED="$(… --ssh-source)"`, the `echo "ssh_source_changed=…"` and `echo "SSH source changed: …"` lines) and line 1072 (`ssh_source_changed: ${{ needs.code_paths.outputs.ssh_source_changed }}` under the `e2e` job's `with:`). Delete lines 1002-1004 (`src/relay/windows-port-scan.win32.test.ts`, `src/main/ssh/ssh-relay-upload-stage-windows-identity.test.ts`, `src/main/ssh/remote-node-runtime-store-windows.test.ts`) from the Windows shard file list if b6-main has not. If the `orcad_browser` job (665-700) still exists, delete it, its output at 45, the `needs` entry 1110, the env lines 1146-1147 and `check_job orcad_browser …` at 1186.
- [ ] **Step 3: `e2e.yml`.** Delete the `ssh_source_changed` input (20-21), the relay-marker comment lines that name SSH specs (85-87, keep the `.version` marker step itself), the `# Why openssh-client:` comment (251-252) and `openssh-client` from the apt line (253; keep the other packages), the 29 exclusion lines `. != "tests/e2e/local-ssh-browser-routing.spec.ts" and` … `. != "tests/e2e/ssh-localhost.spec.ts" and` (273-301; keep the non-SSH exclusions around them and fix the trailing `and` of the last surviving line), the whole `ORCA_E2E_SSH_DOCKER` block (309-315: the three comment lines, the `if printf … 'tests/e2e/ephemeral-vm-provisioned-root.spec.ts' \ || grep -l 'ORCA_E2E_SSH_DOCKER' …; then` / `E2E_ENV+=(ORCA_E2E_SSH_DOCKER=1)` / `fi` lines — its first clause names B1's deleted spec, its second is SSH), and the three jobs `ssh-docker-watcher-isolation`, `ssh-browser-network-route`, `ssh-localhost` (332-~530, each from its job key through the last step; re-anchor with `rg -n '^  [a-z-]+:$' .github/workflows/e2e.yml`). Keep `ORCA_RELAY_PATH` and `pnpm run build:relay` (lines 61-64, 188, 200): the WSL relay still ships from `out/relay`.
- [ ] **Step 4: `release-cut.yml`, `unit-tests.yml`, dependabot.** `release-cut.yml`: delete the `relay-windows-process-tree` job (1188-1195, comment through `uses: ./.github/workflows/relay-windows-process-tree.yml` and its `with`/`secrets`), its `needs` entries (1205, 2268) and the steps `Download the relay windows process-tree addon` (~1404-1420, the `# Why every leg: each package ships relays for Windows SSH hosts …` comment through the `name: relay-windows-process-tree` download) and `Gate SSH relay watcher process isolation` (1453-~1470). If the `orcad-template` job still exists, delete it (1152-1187), its `needs` entries (1203, 2265), `ORCA_REQUIRE_ORCAD_TEMPLATE: '1'` (1209), the `Download the orcad deployment template` step (1439-1443), the `orcad-template` signing skip (1594-1596) and the `Reseal the orcad template …` step (1781-1784). `unit-tests.yml:12`: change the description to `Hosted runner for the unit shards.`. `.github/dependabot.yml:3-4`: change the comment to `# Why only ripgrep: the bundled rg ships in every artifact, and a bump is a one-line pin change. Other dependencies stay manual.`
- [ ] **Step 5: Contract tests.** `release-cut-token-permissions.test.mjs`: delete lines 15-17 (`e2e.yml#ssh-browser-network-route`, `#ssh-localhost`, `#ssh-docker-watcher-isolation`), 18-23 (`node-server-tests.yml#*`, if that workflow is gone) and 30-34 (`orcad-template` rows, if that job is gone). `rg -n "ssh|relay-windows|node-server|orcad" config/scripts/pr-workflow-parallelism.test.mjs config/scripts/pr-code-change-scope.mjs config/scripts/pr-code-change-scope.test.mjs` and delete each row that names a removed job or path (`orcad_browser`, `node-server`); `pr-e2e-gate-contract.test.mjs` must already be clean from B6-2.7 — re-run it.
- [ ] **Step 6: Verify.** `node -e "const {parse}=require('yaml');for(const f of ['pr','e2e','release-cut','unit-tests','windows-wsl-e2e'])parse(require('fs').readFileSync('.github/workflows/'+f+'.yml','utf8'));console.log('yaml ok')"`; `pnpm test config/scripts/pr-e2e-gate-contract.test.mjs config/scripts/release-cut-token-permissions.test.mjs config/scripts/pr-workflow-parallelism.test.mjs config/scripts/pr-code-change-scope.test.mjs`; `rg -n -i "ssh|orcad|node-server|relay-windows" .github/workflows .github/dependabot.yml` → only `windows-wsl-e2e.yml`/`e2e.yml` `build:relay` lines and WSL text (no `sshd`, `openssh`, `ORCA_E2E_SSH`, `ssh_source_changed`). `node notes/local-only/prune-reliability-gates.mjs && pnpm format && pnpm run check:reliability-gates`; `pnpm tc`; `pnpm run check:code-quality:changed`; `pnpm run check:local-only`.
- [ ] **Step 7: Commit.**
  ```
  ci(local-only): remove the SSH host, relay addon and Docker-SSH workflows and lanes

  Delete the hostile-host and Windows-host SSH workflows, the relay
  process-tree addon workflow, the Docker-SSH and localhost-SSH e2e lanes,
  the SSH source routing plumbing between pr.yml and e2e.yml, and their
  workflow contract tests.

  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01PskLbdTqJNXxJ7KRnDoDoD
  ```

### Task B6-2.9: Sweep — renderer/preload/CLI test tail, remaining references, gates and guard

**Files:**
- Delete: any renderer/preload/cli test file that the policy makes empty.
- Modify: the non-ssh-named tests that still fail under the policy (expected set: `src/renderer/src/components/sidebar/{host-rename-remove,sidebar-host-options,host-section-rows,delete-worktree-flow}.test.ts` SSH cases, `src/renderer/src/components/terminal-pane/pty-connection-*.test.ts` SSH `it`s, `src/renderer/src/hooks/useIpcEvents-*.test.ts` entries that stub `api.ssh`, `src/renderer/src/lib/{worktree-host-connection-phase,agent-status-connection-ownership}.test.ts` SSH cases, `src/cli/*.test.ts` leftovers), `config/reliability-gates.jsonc`, `config/scripts/ci-shard-timings.json`.
- Test: `pnpm test src/renderer src/preload src/cli src/shared config/scripts tests/e2e/global-setup-cli-artifact.unit.test.ts tests/tools`, `pnpm lint`.

**Interfaces:** Consumes: everything above plus b6-main and B7. Produces: `pnpm lint` green (incl. `check:reliability-gates`, `check:local-only`, `verify:localization-*`, `verify:rpc-params-catalog`, `verify:bundled-skill-guides`); the test-file failure set is a subset of `notes/local-only/after/failing-files.txt`.

- [ ] **Step 1: Full test run.** `pnpm test src/renderer src/preload src/cli src/shared config/scripts tests/tools tests/e2e/global-setup-cli-artifact.unit.test.ts` (bare, no piping). Diff the failing-file list against `notes/local-only/after/failing-files.txt`; for each new failure apply the test-tail policy (delete the SSH `it`/`describe`, or the file when nothing local remains), never a `.skip`. Expected: zero new failing files.
- [ ] **Step 2: Reference sweeps** (each must print nothing):
  - `rg -n "window\.api\.ssh|api\.ssh\b|api\.remoteWorkspace|ssh:(connect|getState|listTargets|browseDir|needsPassphrasePrompt)" src/renderer src/preload src/cli tests`
  - `rg -n "ORCA_E2E_SSH|ORCA_RUN_DOCKER_SSH|docker-ssh-relay|ssh_source_changed|--ssh-source" tests config .github package.json`
  - `rg -n "pane: 'ssh'|sectionId: 'ssh'|'forget-ssh-workspace'" src/renderer/src --glob '!*.test.*' --glob '!ui-slice-contract-contextual.ts'`
  - `rg -n "statusBarItems\.includes\('ssh'\)|id: 'ssh'" src/renderer/src --glob '!*.test.*'`
  - `rg --files src/renderer src/preload src/cli | rg -E '(^|/)(Ssh[A-Z]|ssh-|direct-ssh-)' ` → exactly the kept inert list from B6-2.3 step 9 plus their surviving tests (no `.tsx`).
- [ ] **Step 3: Gates, timings, lint.** `node notes/local-only/prune-reliability-gates.mjs && pnpm format` (expected `no stale test files`); re-run the ci-shard-timings prune snippet from B6-2.7 step 5 (expected `pruned 0`); `pnpm run check:max-lines-ratchet` (no renderer/preload/cli rows change; `remote-runtime-pty-transport.ts` is B5's); `pnpm lint` (full) — fix only what this unit introduced.
- [ ] **Step 4: `pnpm tc`, `pnpm run check:code-quality:changed`, `pnpm run check:local-only`** (violation count unchanged from the previous task).
- [ ] **Step 5: Commit** (only if steps 1-3 changed files; otherwise record "no sweep changes" in the task note and skip the commit):
  ```
  test(local-only): trim the SSH test tail and finish the renderer, preload and CLI sweep

  Delete SSH-only cases from tests that also cover local behaviour, drop
  tests left with nothing local to check, and prune the last gate and
  shard-timing rows that named them.

  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01PskLbdTqJNXxJ7KRnDoDoD
  ```