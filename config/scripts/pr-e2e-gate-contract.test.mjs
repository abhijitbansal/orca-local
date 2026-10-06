import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { parse as parseJsonc } from 'jsonc-parser'
import { describe, expect, it } from 'vitest'
import { parse as parseYaml } from 'yaml'
import {
  hasNativeImeSourceChange,
  NATIVE_IME_SOURCE_ROUTE_IDS,
  PR_E2E_SOURCE_ROUTES,
  selectPrE2eSpecs
} from './pr-e2e-source-routing.mjs'
import {
  EXPECTED_NATIVE_IME_TESTS,
  IME_ENGAGEMENT_RECEIPT_ENV
} from './terminal-ime-engagement-receipt.mjs'

const projectDir = resolve(import.meta.dirname, '../..')
const prWorkflow = parseYaml(readFileSync(join(projectDir, '.github/workflows/pr.yml'), 'utf8'))
const e2eWorkflow = parseYaml(readFileSync(join(projectDir, '.github/workflows/e2e.yml'), 'utf8'))
const reliabilityManifest = parseJsonc(
  readFileSync(join(projectDir, 'config/reliability-gates.jsonc'), 'utf8')
)
const playwrightConfig = readFileSync(join(projectDir, 'tests/playwright.config.ts'), 'utf8')
const nativeImeWorkflow = parseYaml(
  readFileSync(join(projectDir, '.github/workflows/terminal-ime-e2e.yml'), 'utf8')
)
const nativeImeRunner = readFileSync(
  join(projectDir, 'config/scripts/run-terminal-ibus-hangul-e2e.mjs'),
  'utf8'
)
const nativeImeSpec = readFileSync(
  join(projectDir, 'tests/e2e/terminal-ibus-hangul-native.spec.ts'),
  'utf8'
)

const filterStep = prWorkflow.jobs.code_paths.steps.find(
  (step) => step.name === 'Filter changed E2E specs'
)
const verifyStep = prWorkflow.jobs.verify.steps.find(
  (step) => step.name === 'Require successful checks'
)

describe('PR E2E gate contract', () => {
  it('keeps E2E advisory while the suite is red on main', () => {
    // Why: pin the deliberate choice so it reads as intentional rather than as
    // the "forgot to wire the gate" bug this file originally caught. Gating on a
    // suite that fails every scheduled run would block the PRs that fix it.
    // Flipping to blocking means updating this expectation too — see the comment
    // on verify's Require-successful-checks step for the exact wiring.
    expect(prWorkflow.jobs.verify.needs).not.toContain('e2e')
    expect(verifyStep.env.E2E).toBeUndefined()
    expect(verifyStep.run).not.toContain('$E2E')
  })

  it('passes only changed specs to the reusable E2E workflow', () => {
    // Why: without this the job could lose its filter and run on every PR — the
    // cost the path filter exists to avoid — while the gate assertions above
    // stay green.
    expect(prWorkflow.jobs.e2e.needs).toBe('code_paths')
    expect(prWorkflow.jobs.e2e.if).toBe("needs.code_paths.outputs.e2e_should_run == 'true'")
    expect(prWorkflow.jobs.code_paths.outputs.e2e_should_run).toBe(
      '${{ steps.e2e_filter.outputs.should_run }}'
    )
    expect(prWorkflow.jobs.code_paths.outputs.test_files).toBe(
      '${{ steps.e2e_filter.outputs.test_files }}'
    )
    expect(prWorkflow.jobs.e2e.with.ref).toBe('${{ github.event.pull_request.head.sha }}')
    expect(prWorkflow.jobs.e2e.with.test_files).toBe('${{ needs.code_paths.outputs.test_files }}')
  })

  it('enforces every job verify depends on', () => {
    // Why: derive from verify.needs rather than hardcoding, so adding a required
    // job without adding it to the strict loop fails here instead of silently
    // leaving that job unenforced. This is what caught GIT_COMPATIBILITY and
    // SHELL_CONTRACTS being absent from an earlier hardcoded list.
    const successMarker = '# Require success when the PR has code-relevant changes'
    const successLoop = verifyStep.run.slice(verifyStep.run.indexOf(successMarker))
    expect(successLoop.length).toBeGreaterThan(0)
    expect(verifyStep.run).toContain('"$CODE_PATHS" != "success"')
    for (const job of prWorkflow.jobs.verify.needs) {
      const envVar = job.replaceAll('-', '_').toUpperCase()
      expect(verifyStep.env[envVar]).toBe(`\${{ needs.${job}.result }}`)
      if (job === 'code_paths') {
        continue
      }
      expect(successLoop).toContain(`"$${envVar}"`)
      expect(verifyStep.env[`${envVar}_SHOULD_RUN`]).toBe(`\${{ needs.code_paths.outputs.${job} }}`)
    }
  })

  it('selects modified Playwright specs without running deleted tests', () => {
    expect(filterStep.run).toContain('--diff-filter=AMCR')
    expect(filterStep.run).toContain('config/scripts/pr-e2e-source-routing.mjs')
    expect(filterStep.run).not.toContain('tests/playwright\\.')
    expect(
      selectPrE2eSpecs([
        'tests/e2e/active-view-restart-restore.spec.ts',
        'tests/e2e/deleted.spec.ts.bak',
        'tests/e2e/global-teardown.unit.test.ts'
      ])
    ).toEqual(['tests/e2e/active-view-restart-restore.spec.ts'])
  })

  it('uses one runner for changed specs and keeps full runs sharded', () => {
    expect(e2eWorkflow.jobs.e2e.if).toBe("inputs.test_files == ''")
    expect(e2eWorkflow.jobs['changed-e2e'].if).toBe("inputs.test_files != ''")
    expect(e2eWorkflow.jobs['changed-e2e'].strategy).toBeUndefined()
    expect(e2eWorkflow.jobs.e2e.strategy.matrix.include).toEqual(
      Array.from({ length: 14 }, (_, index) => ({
        shard: `${index + 1}/14`,
        shard_name: `${index + 1}-of-14`
      }))
    )
    const changedRun = e2eWorkflow.jobs['changed-e2e'].steps.find(
      (step) => step.name === 'Run changed E2E specs'
    )
    expect(changedRun.env.TEST_FILES_JSON).toBe('${{ inputs.test_files }}')
    expect(changedRun.run).toContain('if [ "${#TEST_FILES[@]}" -eq 0 ]')
    expect(changedRun.run).toContain('grep -l \'@headful\' "${TEST_FILES[@]}"')
    expect(changedRun.run).toContain('E2E_PROJECT_ARGS+=(--project=electron-headful)')
    expect(changedRun.run).toContain(
      'pnpm run test:e2e "${TEST_FILES[@]}" --workers=1 "${E2E_PROJECT_ARGS[@]}"'
    )
    expect(playwrightConfig).toContain('retries: 0')
    const steps = e2eWorkflow.jobs.e2e.steps.filter((step) =>
      step.run?.includes('tests/e2e/worktree-switch-first-paint.spec.ts')
    )
    expect(steps).toHaveLength(1)
    expect(steps[0].if).toBe("matrix.shard == '1/14'")
    expect(steps[0].run).toContain('xvfb-run --auto-servernum')
    expect(steps[0].run).toContain('--project=electron-headful --workers=1')
  })

  it('reuses the composite install action instead of duplicating pnpm setup', () => {
    const installFor = (jobName) =>
      e2eWorkflow.jobs[jobName].steps.find(
        (step) => step.uses === './.github/actions/install-node-dependencies'
      )

    expect(installFor('build').with['native-runtime']).toBe('node')
    for (const jobName of ['e2e', 'changed-e2e']) {
      expect(installFor(jobName).with['native-runtime'], jobName).toBe('electron')
    }
  })

  it('installs zsh in every Linux lane that can run paired startup readiness', () => {
    for (const jobName of ['e2e', 'changed-e2e']) {
      const installStep = e2eWorkflow.jobs[jobName].steps.find((step) =>
        step.name.startsWith('Install native build')
      )
      expect(installStep.run, jobName).toMatch(/\bzsh\b/)
    }
  })

  it('keeps dedicated E2E workflows from self-triggering on pull requests', () => {
    // Why this still holds for terminal-ime-e2e.yml now that pr.yml runs it: pr.yml reaches it
    // through workflow_call, behind the path filter. A pull_request trigger here would run a
    // real ibus session on every PR, which is the cost the filter exists to avoid.
    const dedicatedWorkflows = [
      'golden-e2e-experiment.yml',
      'linux-wayland-gpu-sandbox.yml',
      'terminal-ime-e2e.yml',
      'win-crash-survival-e2e.yml',
      'windows-terminal-restart-e2e.yml'
    ]

    for (const file of dedicatedWorkflows) {
      const workflow = parseYaml(readFileSync(join(projectDir, '.github/workflows', file), 'utf8'))
      expect(workflow.on.pull_request, file).toBeUndefined()
    }
  })

  it('scopes detection to the PR range so base drift cannot false-trigger', () => {
    expect(filterStep.run).toMatch(/diff-base\.mjs "\$BASE"[\s\S]*"\$DIFF_BASE" HEAD/)
    expect(filterStep.run).toContain('set -euo pipefail')
  })

  it('routes P0 sentinels from their causal sources', () => {
    const cases = [
      [
        'src/renderer/src/components/tab-bar/TabBarQuickCommandsMenu.tsx',
        'tests/e2e/terminal-quick-command-pre-bind-recovery.spec.ts'
      ]
    ]
    for (const [source, spec] of cases) {
      expect(selectPrE2eSpecs([source]), source).toEqual([spec])
      expect(selectPrE2eSpecs([source.replace(/\.tsx?$/, '.test.ts')]), source).toEqual([])
      expect(existsSync(join(projectDir, spec)), spec).toBe(true)
    }
    const parkedSplitSpec = 'tests/e2e/terminal-parked-cli-split.spec.ts'
    for (const source of [
      'src/main/window/attach-main-window-services.ts',
      'src/preload/api/ui-command-event-api.ts',
      'src/preload/index.ts',
      'src/renderer/src/components/terminal-pane/terminal-pane-split-request-routing.ts',
      'src/renderer/src/components/terminal-pane/use-terminal-pane-lifecycle.ts',
      'src/renderer/src/components/terminal-pane/use-terminal-tab-cold-parking.ts',
      'src/renderer/src/hooks/ipc-events/terminal-ui-routing-ipc-bridge.ts'
    ]) {
      expect(selectPrE2eSpecs([source]), source).toContain(parkedSplitSpec)
      expect(selectPrE2eSpecs([source.replace(/\.ts$/, '.test.ts')]), source).not.toContain(
        parkedSplitSpec
      )
    }
    expect(existsSync(join(projectDir, parkedSplitSpec)), parkedSplitSpec).toBe(true)

    const quickCommandSpec = 'tests/e2e/terminal-quick-command-pre-bind-recovery.spec.ts'
    for (const source of [
      'src/renderer/src/components/terminal-pane/pty-connection.ts',
      'src/renderer/src/components/terminal-pane/pty-connection/connect-pane-pty.ts',
      'src/renderer/src/components/terminal-pane/pty-connection/fresh-spawn-start.ts',
      'src/renderer/src/components/terminal-pane/pty-connection/pane-pty-visibility-bind.ts',
      'src/renderer/src/components/terminal-pane/pty-connection/pty-input-recovery.ts'
    ]) {
      expect(selectPrE2eSpecs([source]), source).toContain(quickCommandSpec)
      expect(selectPrE2eSpecs([source.replace(/\.ts$/, '.test.ts')]), source).not.toContain(
        quickCommandSpec
      )
    }
  })

  it('puts the real-IME lane on the PR gate behind the IME source filter', () => {
    // Why a whole lane and not a spec in changed-e2e: the harness is an ibus-daemon, an xfwm4
    // session, and an X11 display; the generic lane has none of them and the spec would skip.
    expect(nativeImeWorkflow.on.workflow_call).toBeDefined()
    expect(prWorkflow.jobs.terminal_ime_native.uses).toBe(
      './.github/workflows/terminal-ime-e2e.yml'
    )
    expect(prWorkflow.jobs.terminal_ime_native.needs).toBe('code_paths')
    expect(prWorkflow.jobs.terminal_ime_native.if).toBe(
      "needs.code_paths.outputs.native_ime_source_changed == 'true'"
    )
    expect(prWorkflow.jobs.code_paths.outputs.native_ime_source_changed).toBe(
      '${{ steps.e2e_filter.outputs.native_ime_source_changed }}'
    )
    expect(filterStep.run).toContain('pr-e2e-source-routing.mjs --native-ime-source')
    expect(filterStep.run).toContain('native_ime_source_changed=$NATIVE_IME_SOURCE_CHANGED')

    // Why: continue-on-error would report the lane green and hide every failure it exists to
    // surface. Advisory here means "absent from verify.needs", not "always passes".
    expect(prWorkflow.jobs.terminal_ime_native['continue-on-error']).toBeUndefined()
    expect(prWorkflow.jobs.verify.needs).not.toContain('terminal_ime_native')
    expect(verifyStep.env.TERMINAL_IME_NATIVE).toBeUndefined()

    for (const id of NATIVE_IME_SOURCE_ROUTE_IDS) {
      expect(
        PR_E2E_SOURCE_ROUTES.map((route) => route.id),
        id
      ).toContain(id)
    }
  })

  it('triggers the real-IME lane from every surface an input method can judge', () => {
    for (const file of [
      'src/renderer/src/components/terminal-pane/terminal-ime-composition-route.ts',
      'src/renderer/src/components/terminal-pane/terminal-ime-native-text-forwarder.ts',
      'src/renderer/src/components/terminal-pane/terminal-ios-hangul-preedit.ts',
      'src/renderer/src/components/terminal-pane/xterm-bypass-policy.ts',
      'src/renderer/src/lib/pane-manager/terminal-ime-anchor.ts',
      'src/shared/terminal-unicode-provider.ts',
      // The xterm fork owns the helper textarea the IME attaches to; no file here says "ime".
      'config/patches/@xterm__xterm@6.1.0-beta.287.patch',
      'config/patches/xterm-src/browser/Terminal.ts',
      // The harness is source too: breaking the runner or a probe is how the lane goes blind.
      'config/scripts/run-terminal-ibus-hangul-e2e.mjs',
      'config/scripts/terminal-ime-engagement-receipt.mjs',
      'tests/e2e/terminal-ime-boundary-probe.ts',
      'tests/e2e/terminal-ime-byte-reader.ts',
      'tests/e2e/terminal-ime-engagement-receipt.ts',
      'tests/e2e/terminal-ibus-hangul-native.spec.ts'
    ]) {
      expect(hasNativeImeSourceChange([file]), file).toBe(true)
    }

    // Why: a real ibus session on a Git or tab-bar edit is the cost the filter exists to avoid,
    // and a unit test beside the source must not summon a three-and-a-half-minute lane.
    for (const file of [
      'src/main/git/git-status.ts',
      'src/renderer/src/components/tab-bar/BrowserTab.tsx',
      'src/main/terminal/pty-manager.ts',
      'docs/STYLEGUIDE.md',
      'src/renderer/src/components/terminal-pane/terminal-ime-composition-route.test.ts',
      'src/renderer/src/lib/pane-manager/terminal-ime-anchor.test.ts'
    ]) {
      expect(hasNativeImeSourceChange([file]), file).toBe(false)
    }
  })

  it('gives every input-method-gated spec a lane that runs it, or an honest exemption', () => {
    // Why this shape: a spec gated on a native-IME env var that no runner sets is a skip that
    // reports as a pass. This repo already carries such specs; the point is that they are named
    // as gaps rather than counted as coverage.
    const nativeGateExpression = /ORCA_E2E_NATIVE_(?:IBUS_HANGUL|MACOS_KOREAN)\s*[!=]==\s*['"]1['"]/
    const nativeGatedSpecs = readdirSync(join(projectDir, 'tests/e2e'))
      .filter((file) => file.endsWith('.spec.ts'))
      .map((file) => `tests/e2e/${file}`)
      .filter((spec) => nativeGateExpression.test(readFileSync(join(projectDir, spec), 'utf8')))
    expect(nativeGatedSpecs.length).toBeGreaterThan(0)

    // The macOS spec needs a native input source; PR and scheduled IME lanes use Linux.
    const unreachableSpecs = new Set(['tests/e2e/terminal-macos-2set-korean-native.spec.ts'])
    const unclaimed = nativeGatedSpecs.filter(
      (spec) => !unreachableSpecs.has(spec) && !nativeImeRunner.includes(spec)
    )
    expect(
      unclaimed,
      `Native-IME-gated specs claimed by no lane runner: ${unclaimed.join(', ')}`
    ).toEqual([])

    for (const spec of unreachableSpecs) {
      expect(nativeGatedSpecs, spec).toContain(spec)
      expect(nativeImeRunner.includes(spec), `${spec} is exempt but still invoked`).toBe(false)
    }
  })

  it('requires proof an input method engaged before the lane may report success', () => {
    // Why this is the assertion that matters: every other check in this file protects a job from
    // not running. This one protects a job that ran from having exercised nothing.
    expect(nativeImeRunner).toContain('verifyImeEngagementReceipts')
    expect(nativeImeRunner).toContain(`[IME_ENGAGEMENT_RECEIPT_ENV]: receiptPath`)
    expect(nativeImeSpec).toContain('appendImeEngagementReceipt(testInfo.title, trace)')

    // Why: the synthetic CDP step runs first in the same job. Under the default success()
    // condition its failure skipped the real-IME step, so the half that needs an input method
    // reported nothing on exactly the changes that broke IME code.
    const nativeStep = nativeImeWorkflow.jobs['linux-x11'].steps.find(
      (step) => step.name === 'Run native IBus Hangul exact-byte tests'
    )
    expect(nativeStep.if).toBe('!cancelled()')

    // Why a literal comparison: the spec cannot import the .mjs module, so the env var name is
    // written twice and would otherwise drift into a receipt nobody reads.
    const specSideReceipt = readFileSync(
      join(projectDir, 'tests/e2e/terminal-ime-engagement-receipt.ts'),
      'utf8'
    )
    expect(specSideReceipt).toContain(`'${IME_ENGAGEMENT_RECEIPT_ENV}'`)

    // Why pin the titles: the runner requires one receipt per name, so a rename that nobody
    // mirrored here would fail the lane loudly instead of quietly halving it.
    const nativeDigitSpec = readFileSync(
      join(projectDir, 'tests/e2e/terminal-hangul-terminating-digit-native.spec.ts'),
      'utf8'
    )
    expect(nativeDigitSpec).toContain('appendImeEngagementReceipt(testInfo.title, trace)')
    for (const title of EXPECTED_NATIVE_IME_TESTS) {
      expect(nativeImeSpec + nativeDigitSpec, title).toContain(title)
    }
  })

  it('keeps the native IME spec out of the lane that would silently skip it', () => {
    const changedRun = e2eWorkflow.jobs['changed-e2e'].steps.find(
      (step) => step.name === 'Run changed E2E specs'
    )
    expect(changedRun.run).toContain('. != "tests/e2e/terminal-ibus-hangul-native.spec.ts"')
    // Why it still has to be routed: the dedicated lane is selected by the same route, so the
    // spec appearing in test_files is how a spec-only edit reaches the real-IME lane at all.
    expect(selectPrE2eSpecs(['src/shared/terminal-unicode-provider.ts'])).toContain(
      'tests/e2e/terminal-ibus-hangul-native.spec.ts'
    )
  })

  it('keeps source-routed sentinels registered to their reliability gates', () => {
    const routedGateIds = ['terminal-startup.quick-command-pre-bind-recovery']
    for (const gateId of routedGateIds) {
      const route = PR_E2E_SOURCE_ROUTES.find((candidate) => candidate.id === gateId)
      const gate = reliabilityManifest.gates.find((candidate) => candidate.id === gateId)
      expect(route, gateId).toBeDefined()
      expect(gate, gateId).toMatchObject({ maturity: 'experimental', protection: 'partial' })
      for (const spec of route.specs) {
        expect(gate.testFiles, gateId).toContain(spec)
        expect(
          gate.commands.some((command) => command.includes(spec)),
          gateId
        ).toBe(true)
      }
    }
  })
})
