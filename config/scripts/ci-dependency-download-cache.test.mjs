import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'
import { classifyPrJobs } from './pr-code-change-scope.mjs'
import { WINDOWS_BOUNDARY_TESTS } from './pr-package-test-paths.mjs'

const read = (path) => parse(readFileSync(path, 'utf8'))
const workflow = (name) => read(`.github/workflows/${name}.yml`)
const action = read('.github/actions/install-node-dependencies/action.yml')

describe('CI dependency download caches', () => {
  it('scopes desktop stores to the root lockfile', () => {
    expect(action.inputs['cache-dependency-path'].default).toBe('pnpm-lock.yaml')
    for (const step of action.runs.steps.filter((step) => step.uses === 'actions/setup-node@v6')) {
      expect(step.with['cache-dependency-path']).toBe('${{ inputs.cache-dependency-path }}')
      expect(step.with['package-manager-cache']).toBe(false)
    }
    const install = action.runs.steps.find((step) => step.name === 'Install dependencies')
    expect(install.if).toBeUndefined()
    expect(install.run).toContain('pnpm install --frozen-lockfile --ignore-scripts')
    expect(install.run).toContain(
      'diff --exit-code -- package.json pnpm-lock.yaml pnpm-workspace.yaml'
    )
    expect(mobile.with['cache-pnpm-store']).toBe('false')
  })

  it('restores PR stores with setup-node keys without registering a post-job save', () => {
    const resolve = action.runs.steps.find((step) => step.id === 'pnpm-store')
    const restore = action.runs.steps.find(
      (step) => step.name === 'Restore pnpm download store without saving'
    )
    expect(restore.uses).toBe('actions/cache/restore@v5')
    expect(restore.with.path).toBe('${{ steps.pnpm-store.outputs.path }}')
    expect(restore.with.key).toBe(
      'node-cache-${{ runner.os }}-${{ steps.pnpm-store.outputs.arch }}-pnpm-${{ hashFiles(inputs.cache-dependency-path) }}'
    )
    expect(restore.with['restore-keys']).toBeUndefined()
    expect(resolve.env.LOCKFILE_HASH).toBe('${{ hashFiles(inputs.cache-dependency-path) }}')
    expect(action.runs.steps.indexOf(resolve)).toBeLessThan(action.runs.steps.indexOf(restore))
    expect(action.runs.steps.indexOf(restore)).toBeLessThan(
      action.runs.steps.findIndex((step) => step.name === 'Install dependencies')
    )
    const saves = action.runs.steps.filter((step) => step.uses === 'actions/cache/save@v5')
    expect(saves).toHaveLength(1)
    expect(saves[0].name).toBe('Save pnpm verification record on main')
    expect(saves[0].if).toContain("github.ref == 'refs/heads/main'")
    expect(saves[0].if).toContain("github.event_name != 'pull_request'")
    expect(saves[0].with.path).toBe('${{ steps.verification-cache.outputs.path }}')
  })

  it('keeps PR warmer validation within the workflow family that runs it', () => {
    const shared = workflow('ci-cache-warmup')
    const platforms = workflow('ci-cache-warmup-platforms')
    expect(shared.on.pull_request.paths).toEqual([
      '.github/workflows/ci-cache-warmup.yml',
      '.github/actions/prepare-headless-compiler/**',
      'config/scripts/headless-detector-compiler-cache.mjs',
      '.github/actions/prepare-wayland-clipboard/**'
    ])
    expect(platforms.on.pull_request.paths).toEqual([
      '.github/workflows/ci-cache-warmup-platforms.yml',
      '.github/workflows/ci-cache-warmup-platform-jobs.yml'
    ])
    expect(platforms.concurrency).toEqual({
      group: 'ci-cache-warmup-platforms-${{ github.event.pull_request.number || github.ref }}',
      'cancel-in-progress': "${{ github.event_name == 'pull_request' }}"
    })
    expect(shared.jobs['warm-platforms'].uses).toBe(platforms.jobs['warm-platforms'].uses)
    expect(shared.on.schedule).toEqual([{ cron: '41 */6 * * *' }])
    expect(shared.on).toHaveProperty('workflow_dispatch')
    for (const producer of [shared, platforms]) {
      expect(producer.on.push.branches).toEqual(['main'])
      expect(producer.on.push.paths).toEqual(
        expect.arrayContaining([
          '.github/workflows/ci-cache-warmup.yml',
          '.github/workflows/ci-cache-warmup-platforms.yml',
          '.github/workflows/ci-cache-warmup-platform-jobs.yml',
          '.github/actions/install-node-dependencies/**',
          '.github/actions/prepare-native-runtime/**',
          'native/windows-security/**',
          'pnpm-lock.yaml'
        ])
      )
    }
  })

  it.each([
    ['pull_request', false, true, false, false],
    ['pull_request', true, false, false, false],
    ['push', false, true, true, false],
    ['schedule', false, true, true, true],
    ['workflow_dispatch', false, true, true, true]
  ])(
    'retains eligible cache producers and Windows validation on %s (draft %s)',
    (event, draft, admitted, armRuns, sharedPlatforms) => {
      const shared = workflow('ci-cache-warmup')
      const platformWorkflow = workflow('ci-cache-warmup-platforms')
      const platforms = read(platformWorkflow.jobs['warm-platforms'].uses)
      const contextFor = (isDraft) => ({
        github: {
          event_name: event,
          event: event === 'pull_request' ? { pull_request: { draft: isDraft } } : {}
        }
      })
      const context = contextFor(draft)
      expect(runInNewContext(platforms.jobs['warm-linux-runtime'].if, context)).toBe(armRuns)
      expect(runInNewContext(shared.jobs['warm-platforms'].if, context)).toBe(sharedPlatforms)
      for (const guard of [shared.jobs.warm.if, platformWorkflow.jobs['warm-platforms'].if]) {
        expect(runInNewContext(guard, context)).toBe(admitted)
        expect(runInNewContext(guard, contextFor(!draft))).toBe(event !== 'pull_request' || draft)
      }
      expect(platforms.jobs['warm-windows'].if).toBeUndefined()
      expect(platforms.jobs['warm-windows'].strategy.matrix.os).toEqual([
        'windows-2022',
        'windows-11-arm',
        'windows-2025'
      ])
    }
  )

  it.each([
    ['windows-2022', 'X64', true],
    ['windows-11-arm', 'ARM64', false],
    ['windows-2025', 'X64', false]
  ])('warms native addons without unused CLI builds on %s', (os, arch, cli) => {
    const platforms = read(workflow('ci-cache-warmup-platforms').jobs['warm-platforms'].uses)
    const warm = platforms.jobs['warm-windows']
    const context = { runner: { arch }, matrix: { os } }
    for (const name of ['Cache Windows CLI launcher', 'Build the Windows native executables']) {
      const step = warm.steps.find((step) => step.name === name)
      expect(step, name).toBeDefined()
      expect(runInNewContext(step.if, context)).toBe(cli)
    }
    const consumer = workflow('wsl-orcad-e2e').jobs.wsl2
    const installer = './.github/actions/install-node-dependencies'
    expect(consumer['runs-on']).toBe('windows-2025')
    expect(warm.steps.find((step) => step.uses === installer).with['native-runtime']).toBe(
      consumer.steps.find((step) => step.uses === installer).with['native-runtime']
    )
  })

  it('validates the omitted Linux warmer preparation in the real PR consumers', () => {
    const platforms = read(workflow('ci-cache-warmup-platforms').jobs['warm-platforms'].uses)
    const warm = platforms.jobs['warm-linux-runtime']
    const pr = workflow('pr')
    const units = workflow('unit-tests').jobs.test
    const installer = './.github/actions/install-node-dependencies'
    const warmInstall = warm.steps.find((step) => step.uses === installer)
    const unitInstall = units.steps.find((step) => step.uses === installer)
    expect(warm['runs-on']).toBe('${{ matrix.runner }}')
    expect(warm.strategy.matrix.runner).toEqual([
      'blacksmith-4vcpu-ubuntu-2404-arm',
      pr.jobs.test.with.runner
    ])
    expect(pr.jobs.preflight['runs-on']).toBe('blacksmith-8vcpu-ubuntu-2404')
    expect(pr.jobs.test.with.runner).toBe('blacksmith-8vcpu-ubuntu-2404')
    expect(units['runs-on']).toBe('${{ inputs.runner }}')
    expect(JSON.parse(pr.jobs.test.with.node_versions)).toEqual(['24'])
    expect(warmInstall.if).toBeUndefined()
    expect(unitInstall.if).toBeUndefined()
    expect(warmInstall.with['native-runtime']).toBe('node')
    expect(unitInstall.with['native-runtime']).toBe(warmInstall.with['native-runtime'])
    expect(warmInstall.with['node-version']).toBe('24')
    expect(unitInstall.with['node-version']).toBe('${{ matrix.node }}')
    expect(unitInstall.with['cache-electron-package']).toBe(
      warmInstall.with['cache-electron-package']
    )
    const preflightInstalls = pr.jobs.preflight.steps.filter((step) => step.uses === installer)
    expect(preflightInstalls.map((step) => step.if)).toEqual([
      "needs.code_paths.outputs.mobile_dependencies != 'true'",
      "needs.code_paths.outputs.mobile_dependencies == 'true'"
    ])
    for (const step of preflightInstalls) {
      expect(step.with['native-runtime']).toBe('node')
      expect(step.with['node-version']).toBe('24')
    }
    const populate = 'node config/scripts/install-electron-package-binary.mjs'
    const unitPopulate = units.steps.find((step) => step.run === populate)
    expect(unitPopulate.if).toBeUndefined()
    expect(warm.steps.map((step) => step.uses ?? step.run)).toEqual([
      'actions/checkout@v6',
      installer,
      populate,
      'node config/scripts/ensure-native-runtime.mjs --check-only'
    ])
    const native = read('.github/actions/prepare-native-runtime/action.yml')
    const identity = native.runs.steps.find((step) => step.id === 'native-cache-scope')
    const inputs = [...identity.env.NATIVE_SOURCE_HASH.matchAll(/'([^']+)'/g)].map(
      (match) => match[1]
    )
    for (const path of [
      ...inputs,
      '.github/actions/install-node-dependencies/action.yml',
      ...workflow('ci-cache-warmup-platforms').on.pull_request.paths,
      '.github/workflows/ci-cache-warmup.yml'
    ]) {
      expect(classifyPrJobs([path], { allowMobileCiTools: true }), path).toMatchObject({
        static_analysis: true,
        typecheck: true,
        test: true,
        mobile_ci_tools: false
      })
    }
  })

  it('restores Windows packaging downloads from the release cache without a PR upload', () => {
    const packaging = workflow('pr').jobs.package_windows
    const restore = packaging.steps.find((step) => step.name === 'Cache electron-builder downloads')
    const release = workflow('release-cut').jobs.build
    const windows = release.strategy.matrix.include.find((entry) => entry.platform === 'win')
    const save = release.steps.find((step) => step.name === 'Cache electron-builder downloads')

    expect(packaging['runs-on']).toBe(windows.os)
    expect(restore.uses).toBe('actions/cache/restore@v5')
    // Cache versions include the path list, so matching key strings alone cannot prove reuse.
    expect(restore.with.path).toBe(windows.eb_cache_path)
    expect(restore.with.key).toBe(save.with.key.replace('${{ matrix.platform }}', 'win'))
    expect(restore.with['restore-keys']).toBe(
      save.with['restore-keys'].replace('${{ matrix.platform }}', 'win')
    )
    expect(save.uses).toBe('actions/cache@v5')
    expect(save.with.path).toBe('${{ matrix.eb_cache_path }}')
    for (const name of ['dev-channel-win-build', 'windows-signing-rehearsal']) {
      const writer = Object.values(workflow(name).jobs)
        .flatMap((job) => job.steps ?? [])
        .find((step) => step.name === 'Cache electron-builder downloads')
      expect(writer.uses, name).toBe('actions/cache@v5')
      expect(writer.with.path, name).toBe(restore.with.path)
      expect(writer.with.key, name).toBe(restore.with.key)
      expect(writer.with['restore-keys'], name).toBe(restore.with['restore-keys'])
    }
  })

  it('shares Linux PR downloads with main x64 release builds across runner pools', () => {
    const packaging = workflow('pr').jobs.package
    const consumer = packaging.steps.find(
      (step) => step.name === 'Cache electron-builder downloads'
    )
    const release = workflow('release-cut').jobs.build
    const combined = release.steps.find((step) => step.name === 'Cache electron-builder downloads')
    const writer = release.steps.find(
      (step) => step.name === 'Seed shared Linux packaging downloads'
    )
    const linux = release.strategy.matrix.include.find((entry) => entry.platform === 'linux-x64')

    expect([linux.os, 'blacksmith-4vcpu-ubuntu-2404']).toContain(packaging['runs-on'])
    expect(writer.if).toBe("matrix.platform == 'linux-x64' && github.ref == 'refs/heads/main'")
    expect(writer.uses).toBe('actions/cache@v5')
    expect(writer.with.path).toBe(consumer.with.path)
    expect(writer.with.key).toBe(consumer.with.key)
    expect(writer.with['restore-keys']).toBeUndefined()
    expect(writer.with['lookup-only']).toBe(true)
    expect(release.steps.indexOf(writer)).toBeGreaterThan(release.steps.indexOf(combined))
    expect(consumer.uses).toBe('actions/cache/restore@v5')
    expect(consumer.with['restore-keys'].trim()).toBe('electron-builder-linux-')
    expect(combined.uses).toBe('actions/cache@v5')
    expect(linux.eb_cache_path.trim().split('\n')).toEqual([
      '~/.cache/electron',
      '~/.cache/electron-builder'
    ])
  })
})

it('shares Electron archives with PRs without uploading PR-local copies', () => {
  const save = action.runs.steps.find((step) => step.name === 'Cache Electron package archive')
  const restore = action.runs.steps.find(
    (step) => step.name === 'Restore Electron package archive without saving'
  )
  expect(save.if).toContain("github.event_name != 'pull_request' || runner.os != 'Linux'")
  expect(restore.if).toContain("github.event_name == 'pull_request' && runner.os == 'Linux'")
  expect(save.if).toContain("steps.electron-package-cache.outputs.version != ''")
  expect(restore.if).toContain("steps.electron-package-cache.outputs.version != ''")
  expect(save.uses).toBe('actions/cache@v5')
  expect(restore.uses).toBe('actions/cache/restore@v5')
  expect(restore.with).toEqual(save.with)
})

describe('release install targets', () => {
  const macCpuFlag = '--cpu=current,x64,arm64'
  // Both shapes: `run:` steps and steps wrapped in nick-fields/retry (`with.command`).
  const installCommand = (step) => step.with?.command ?? step.run
  const installSteps = (name) =>
    Object.values(workflow(name).jobs)
      .flatMap((job) => job.steps ?? [])
      .filter((step) => installCommand(step)?.includes('pnpm install '))
  const installCommands = (name) => installSteps(name).map(installCommand)

  it.each(['adhoc-mac-build', 'daily-mac-build', 'hourly-mac-build', 'release-mac-build'])(
    '%s installs both mac CPU variants for the x64+arm64 package config',
    (name) => {
      const installs = installCommands(name)
      expect(installs.length).toBeGreaterThan(0)
      expect(installs.some((command) => command.includes(macCpuFlag))).toBe(true)
    }
  )

  // A transient `read ECONNRESET` fetching this Node version's headers for
  // native/windows-registry's node-gyp rebuild failed a blocking golden gate and the cut.
  it('retries every release-cut install so one transient download cannot fail a cut', () => {
    const installs = installSteps('release-cut')
    expect(installs.length).toBeGreaterThan(0)
    for (const step of installs) {
      expect(step.uses).toBe('nick-fields/retry@v4')
      expect(step.with.max_attempts).toBeGreaterThan(1)
    }
  })

  it.each(['release-cut', 'dev-channel-win-build', 'windows-signing-rehearsal'])(
    '%s keeps installs scoped to the runner host',
    (name) => {
      const installs = installCommands(name)
      expect(installs.length).toBeGreaterThan(0)
      for (const command of installs) {
        expect(command).not.toContain('--os=')
        expect(command).not.toContain('--cpu=')
      }
    }
  )

  it('offers the mac CPU targets for local packaging without touching the lockfile', () => {
    const script = JSON.parse(readFileSync('package.json', 'utf8')).scripts['install:release']
    expect(script).toContain('--frozen-lockfile')
    expect(script).toContain(macCpuFlag)
  })

  it('keeps installed Windows addon checks in the Windows CI lane', () => {
    const steps = Object.values(workflow('pr').jobs).flatMap((job) => job.steps ?? [])
    const test = steps.find((step) => step.name === 'Test Windows-specific boundaries')
    expect(test.run).toContain('config/scripts/pr-package-test-paths.mjs')
    expect(WINDOWS_BOUNDARY_TESTS).toEqual(
      expect.arrayContaining([
        'config/scripts/windows-process-tree-gyp-path.test.mjs',
        'config/scripts/windows-process-tree-gyp-rebuild.test.mjs',
        'config/scripts/package-electron-runtime-contract.test.mjs',
        'config/scripts/electron-builder-runtime-resources.test.mjs'
      ])
    )
  })
})
