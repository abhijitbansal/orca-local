import { globSync, readFileSync } from 'node:fs'
import { parse } from 'yaml'
import { describe, expect, it } from 'vitest'
import { UNIT_EXCLUDE } from './ci-unit-files.mjs'

const workflow = parse(readFileSync('.github/workflows/pr.yml', 'utf8'))
const prTestLocWorkflow = parse(readFileSync('.github/workflows/pr-test-loc.yml', 'utf8'))
const releasePolicyWorkflow = parse(readFileSync('.github/workflows/release-policy.yml', 'utf8'))
const issueLabelWorkflow = parse(readFileSync('.github/workflows/issue-os-labeler.yaml', 'utf8'))
const unitTestWorkflow = parse(readFileSync('.github/workflows/unit-tests.yml', 'utf8'))
const nodeNextWorkflow = parse(readFileSync('.github/workflows/node-next-compat.yml', 'utf8'))
const shellContractFiles = [
  'src/main/daemon/repro-13767-shell-ready-marker-lost-to-exec.test.ts',
  'src/main/daemon/shell-ready.test.ts',
  'src/main/providers/local-pty-shell-ready-zsh-launch-environment.test.ts',
  'src/main/providers/__tests__/shell-ready-framework-example.test.ts',
  'src/main/pty/omp-shell-wrapper-alias-safety.test.ts',
  'src/main/pty/omp-shell-wrapper.node-pty.test.ts',
  'src/main/shell-startup-feature-channel.test.ts',
  'src/main/zsh-scoped-histfile.live-shell.test.ts',
  'src/main/zsh-startup-hook-user-config-equivalence.live-shell.test.ts',
  'src/main/runtime/structured-session-cli-login-shell.live-shell.test.ts',
  'src/shared/posix-command-path-lookup.test.ts'
]
const patchedNodePtyContractFiles = [
  'src/main/daemon/node-pty-fd-leak.test.ts',
  'src/shared/fish-query-reply-child-stdin.node-pty.test.ts'
]
const nativeShellContractFiles = [...shellContractFiles, ...patchedNodePtyContractFiles]

describe('PR workflow parallelism', () => {
  it('keeps lightweight orchestration jobs on the free slim runner', () => {
    expect(workflow.jobs.code_paths['runs-on']).toBe('ubuntu-slim')
    expect(workflow.jobs.typecheck['runs-on']).toBe('ubuntu-24.04-arm')
    expect(workflow.jobs.verify['runs-on']).toBe('ubuntu-slim')
    expect(prTestLocWorkflow.jobs.loc['runs-on']).toBe('ubuntu-slim')
    expect(releasePolicyWorkflow.jobs.enforce['runs-on']).toBe('ubuntu-slim')
    expect(issueLabelWorkflow.jobs['apply-os-label']['runs-on']).toBe('ubuntu-slim')
  })

  it('cancels superseded runs for the same pull request', () => {
    expect(workflow.concurrency.group).toBe('pr-checks-${{ github.event.pull_request.number }}')
    expect(workflow.concurrency['cancel-in-progress']).toBe(true)
    expect(workflow.jobs.test.if).toContain('!cancelled()')
    expect(workflow.jobs.test.if).not.toContain('always()')
    expect(workflow.jobs.verify.if).toBe('${{ !cancelled() }}')
  })

  it('grants the PR workflow read-only repository access', () => {
    expect(workflow.permissions).toEqual({ contents: 'read' })
  })

  it('runs PR shards on ARM and both Node versions on x86 daily', () => {
    const sharedTest = unitTestWorkflow.jobs.test
    const testStep = sharedTest.steps.find((step) => step.name === 'Test shard')
    const installStep = sharedTest.steps.find(
      (step) => step.uses === './.github/actions/install-node-dependencies'
    )
    const staticInstall = workflow.jobs.static_analysis.steps.find(
      (step) => step.uses === './.github/actions/install-node-dependencies'
    )
    const nodeNextPrimerInstall = nodeNextWorkflow.jobs.test_native_cache.steps.find(
      (step) => step.uses === './.github/actions/install-node-dependencies'
    )

    expect(workflow.jobs.test.uses).toBe('./.github/workflows/unit-tests.yml')
    expect(JSON.parse(workflow.jobs.test.with.node_versions)).toEqual(['24'])
    expect(nodeNextWorkflow.jobs.test.uses).toBe('./.github/workflows/unit-tests.yml')
    expect(JSON.parse(nodeNextWorkflow.jobs.test.with.node_versions)).toEqual(['24', '26'])
    expect(workflow.jobs.test.with.runner).toBe('ubuntu-24.04-arm')
    expect(workflow.jobs.static_analysis['runs-on']).toBe('ubuntu-24.04-arm')
    expect(sharedTest['runs-on']).toBe('${{ inputs.runner }}')
    expect(unitTestWorkflow.on.workflow_call.inputs.runner.default).toBe('ubuntu-latest')
    expect(nodeNextWorkflow.jobs.test.with.runner).toBeUndefined()
    expect(nodeNextWorkflow.jobs.test_native_cache['runs-on']).toBe('ubuntu-latest')
    expect(nodeNextWorkflow.jobs.test_native_cache.strategy.matrix.node).toEqual(['24', '26'])
    expect(unitTestWorkflow.jobs.relay_integration).toBeUndefined()
    expect(nodeNextWorkflow.on.schedule).toHaveLength(1)
    expect(nodeNextWorkflow.on.workflow_dispatch).toBeNull()
    expect(sharedTest.strategy.matrix.node).toBe('${{ fromJSON(inputs.node_versions) }}')
    expect(sharedTest.strategy.matrix.shard).toBe('${{ fromJSON(inputs.shards) }}')
    // PR planning overlaps typecheck; the daily suite keeps its separate planner.
    expect(sharedTest.needs).toBeUndefined()
    expect(unitTestWorkflow.jobs.plan).toBeUndefined()
    expect(unitTestWorkflow.on.workflow_call.inputs.shards.required).toBe(true)
    expect(installStep.with['node-version']).toBe('${{ matrix.node }}')
    expect(installStep.with['cache-electron-package']).toBe('true')
    expect(testStep.run).toContain('--shard=${{ matrix.shard.index }}/${{ matrix.shard.count }}')
    for (const testFile of nativeShellContractFiles) {
      expect(UNIT_EXCLUDE).toContain(testFile)
    }
    expect(staticInstall.with['native-runtime']).toBe('node')
    expect(staticInstall.with['node-version']).toBe('24')
    expect(workflow.jobs.test.needs).toContain('static_analysis')
    expect(workflow.jobs.test_native_cache).toBeUndefined()
    expect(nodeNextPrimerInstall.with['native-runtime']).toBe('node')
    expect(nodeNextPrimerInstall.with['node-version']).toBe('${{ matrix.node }}')
    expect(nodeNextWorkflow.jobs.test.needs).toEqual(['test_native_cache', 'unit_plan'])
  })

  it('runs real-shell coverage once outside the general shards', () => {
    const shellStep = workflow.jobs.shell_contracts.steps.find(
      (step) => step.name === 'Test real shell contracts'
    )
    const shellInstall = workflow.jobs.shell_contracts.steps.find(
      (step) => step.uses === './.github/actions/install-node-dependencies'
    )
    // Why parsed rather than substring-matched: the step name changes as shells are
    // added, and `includes('fish')` would also match a comment or a longer package.
    const aptPackages = (step) =>
      (step.run?.match(/apt-get install[^\n]*/)?.[0] ?? '')
        .split(/\s+/)
        .filter((token) => !['apt-get', 'install', 'sudo', ''].includes(token))
        .filter((token) => !token.startsWith('-'))
    const requiredShells = ['zsh', 'fish']
    const jobsInstallingShells = Object.entries(workflow.jobs)
      .filter(([, job]) =>
        (job.steps ?? []).some((step) =>
          aptPackages(step).some((packageName) => requiredShells.includes(packageName))
        )
      )
      .map(([name]) => name)

    expect(shellStep).toBeDefined()
    expect(shellInstall).toBeDefined()
    expect(shellStep.run.split(/\s+/)).toContain('--maxWorkers=1')
    // Why the whole workflow, not just the general shards: any other lane installing
    // these shells would silently start running the real-shell tests twice.
    expect(jobsInstallingShells).toEqual(['shell_contracts'])
    // Why each shell is asserted: the live tests skip themselves when the binary is
    // missing, so a dropped package silently empties this lane instead of failing it.
    const shellPackages = workflow.jobs.shell_contracts.steps.flatMap(aptPackages)
    for (const shell of requiredShells) {
      expect(shellPackages).toContain(shell)
    }
    expect(shellInstall.with['native-runtime']).toBe('node')
    for (const testFile of nativeShellContractFiles) {
      expect(shellStep.run).toContain(testFile)
    }
  })

  it('refreshes the apt index once while adding the fish PPA', () => {
    const installStep = workflow.jobs.shell_contracts.steps.find(
      (step) => step.name === 'Install zsh and fish'
    )
    // Comment lines mention both commands by name, so count the executed ones only.
    const commands = installStep.run
      .split('\n')
      .filter((line) => !line.trim().startsWith('#'))
      .join('\n')
    const updates = commands.match(/apt-get update/g) ?? []
    // Anchored to the start of a line so the retry message that names the command in
    // prose is not mistaken for an invocation of it.
    const addRepoCalls = commands
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => /^(sudo\s+)?add-apt-repository\b/.test(line))

    // add-apt-repository refreshes every configured repo unless told not to, so an
    // update on each side of it made this step pay for three full passes.
    expect(updates).toHaveLength(1)
    expect(addRepoCalls.length).toBeGreaterThan(0)
    for (const call of addRepoCalls) {
      expect(call.split(/\s+/)).toContain('-n')
    }
    // The one remaining update has to come after the PPA is on the list, or the fish
    // index it exists to fetch would not be there yet.
    expect(commands.lastIndexOf('add-apt-repository')).toBeLessThan(
      commands.indexOf('apt-get update')
    )
  })

  it('bounds the shell lane so a stalled apt mirror cannot hold the run open', () => {
    const job = workflow.jobs.shell_contracts
    // A passing run of this job takes ~4.5 minutes, almost all of it package download.
    // Without a job bound a stalled mirror runs to GitHub's 6h default, and because this
    // is a required check it holds the whole run open and blocks `gh run rerun --failed`.
    expect(job['timeout-minutes']).toBeGreaterThan(0)
    expect(job['timeout-minutes']).toBeLessThanOrEqual(30)

    const installStep = job.steps.find((step) => step.name === 'Install zsh and fish')
    // apt applies no wall-clock bound to a stalled mirror on its own. These turn an
    // unbounded hang into a bounded, retried, legible failure.
    expect(installStep.run).toMatch(/Acquire::http::Timeout/)
    expect(installStep.run).toMatch(/Acquire::https::Timeout/)
    expect(installStep.run).toMatch(/Acquire::Retries/)
    // Retries multiply: a first attempt at 30s x 3 retries across every index file turned
    // a dead mirror into a ~15 minute stall. One attempt, then move on.
    expect(installStep.run).toMatch(/Acquire::Retries "1"/)
    // Acquire timeouts are per-connection, so they cannot bound the command as a whole.
    // Only a wall-clock bound can, and both apt invocations need one.
    expect(installStep.run).toMatch(/timeout \d+ sudo apt-get update/)
    expect(installStep.run).toMatch(/timeout \d+ sudo apt-get install/)
  })

  it('overlaps bundles with independent output directories', () => {
    const buildStep = workflow.jobs.package.steps.find(
      (step) => step.name === 'Build package inputs'
    )

    expect(buildStep.run).toContain('scripts=(build:wsl-guest build:electron-vite:parallel)')
    expect(buildStep.run).toContain('pnpm run "$script" &')
  })

  it('uses the repository package-manager version for every direct pnpm setup', () => {
    const directSetups = globSync('.github/workflows/*.yml').flatMap((workflowPath) => {
      const parsed = parse(readFileSync(workflowPath, 'utf8'))
      return Object.values(parsed.jobs ?? {}).flatMap((job) =>
        (job.steps ?? [])
          .filter((step) => step.uses === 'pnpm/setup@v2')
          .map((step) => ({ workflowPath, step }))
      )
    })

    expect(directSetups.length).toBeGreaterThan(0)
    for (const { workflowPath, step } of directSetups) {
      expect(step.with?.version, workflowPath).toBeUndefined()
      expect(step.with?.install, workflowPath).toBe(false)
    }
  })

  it('restores Electron downloads before preparing the package runtime', () => {
    const steps = workflow.jobs.package.steps
    const cacheIndex = steps.findIndex((step) => step.name === 'Cache electron-builder downloads')
    const installIndex = steps.findIndex(
      (step) => step.uses === './.github/actions/install-node-dependencies'
    )

    expect(cacheIndex).toBeGreaterThanOrEqual(0)
    expect(installIndex).toBeGreaterThanOrEqual(0)
    expect(cacheIndex).toBeLessThan(installIndex)
  })

  it('reuses native preparation after the dependency action gate', () => {
    const buildStep = workflow.jobs.package.steps.find(
      (step) => step.name === 'Build package inputs'
    )
    const packageStep = workflow.jobs.package.steps.find(
      (step) => step.name === 'Package unpacked app'
    )

    expect(buildStep.run).not.toContain('ensure:electron-runtime')
    expect(packageStep.env.ORCA_REUSE_PREPARED_NATIVE_RUNTIME).toBe('1')
  })

  it('reuses TypeScript incremental state across typecheck runs', () => {
    const steps = workflow.jobs.typecheck.steps
    const cacheIndex = steps.findIndex((step) => step.name === 'Cache TypeScript incremental state')
    const checkIndex = steps.findIndex((step) => step.run === 'pnpm run typecheck')

    expect(cacheIndex).toBeGreaterThanOrEqual(0)
    expect(cacheIndex).toBeLessThan(checkIndex)
    expect(steps[cacheIndex].with.path).toBe('config/*.tsbuildinfo')
    // Why restore-keys matter here: the base SHA key is shared by every commit in a PR,
    // but actions/cache keeps the first successful graph until the base or config changes.
    expect(steps[cacheIndex].with['restore-keys']).toBeTruthy()
    // The buildinfo is only reusable while the compiler options that produced it hold.
    expect(steps[cacheIndex].with.key).toContain(
      "hashFiles('pnpm-lock.yaml', 'config/tsconfig*.json')"
    )
    expect(steps[cacheIndex].with.key).toContain('github.event.pull_request.base.sha')
    expect(steps[cacheIndex].with['restore-keys']).not.toContain('tsbuildinfo-${{ runner.os }}-\n')
  })

  it('checks out full history without historical blobs', () => {
    const fullHistoryCheckouts = Object.values(workflow.jobs)
      .flatMap((job) => job.steps ?? [])
      .filter(
        (step) => step.uses?.startsWith('actions/checkout@') && step.with?.['fetch-depth'] === 0
      )

    for (const checkout of fullHistoryCheckouts) {
      expect(checkout.with.filter).toBe('blob:none')
    }
  })

  it('keeps advisory unit-selection evidence off the gate', () => {
    // It is continue-on-error, so it can never fail a PR. Living inside unit-tests.yml made a
    // caller's `needs: test` wait for it anyway, holding verify ~36s past the last shard. Pinned
    // here so it cannot drift back onto the critical path.
    const evidence = workflow.jobs.unit_selection_evidence
    expect(evidence.uses).toBe('./.github/workflows/unit-selection-evidence.yml')
    expect(evidence.needs).toEqual(['test'])
    expect(workflow.jobs.verify.needs).not.toContain('unit_selection_evidence')
    expect(unitTestWorkflow.jobs.selection_evidence).toBeUndefined()
    const evidenceWorkflow = parse(
      readFileSync('.github/workflows/unit-selection-evidence.yml', 'utf8')
    )
    const job = evidenceWorkflow.jobs.selection_evidence
    expect(job['continue-on-error']).toBe(true)
  })

  it('keeps verify as the aggregate required check', () => {
    expect(workflow.jobs.verify.needs).toEqual([
      'code_paths',
      'static_analysis',
      'typecheck',
      'git_compatibility',
      'codex_index_heal_contract',
      'xterm_patch_sync',
      'shell_contracts',
      'test',
      'package',
      'package_windows'
    ])
  })
})
