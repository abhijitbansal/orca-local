import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, describe, expect, it } from 'vitest'
import { gitExecFileAsync } from './git/runner'
import { detectRepoIcon, detectRepoIconAndUpstream } from './repo-icon-autodetect'

const PNG_1X1_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII='

const tempDirs: string[] = []

async function makeTempRepoDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'orca-repo-icon-'))
  tempDirs.push(dir)
  return dir
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

describe('detectRepoIcon', () => {
  it('uses a small repo-local favicon PNG first', async () => {
    const repoPath = await makeTempRepoDir()
    await writeFile(join(repoPath, 'favicon.png'), Buffer.from(PNG_1X1_BASE64, 'base64'))
    await writeFile(
      join(repoPath, 'package.json'),
      JSON.stringify({ homepage: 'https://example.com' })
    )

    await expect(detectRepoIcon({ repoPath, executionHostId: 'local' })).resolves.toEqual({
      type: 'image',
      src: `data:image/png;base64,${PNG_1X1_BASE64}`,
      source: 'file',
      label: 'favicon.png'
    })
  })

  it('detects Tauri bundle icons under src-tauri/icons', async () => {
    const repoPath = await makeTempRepoDir()
    await mkdir(join(repoPath, 'src-tauri', 'icons'), { recursive: true })
    await writeFile(
      join(repoPath, 'src-tauri', 'icons', 'icon.png'),
      Buffer.from(PNG_1X1_BASE64, 'base64')
    )

    await expect(detectRepoIcon({ repoPath, executionHostId: 'local' })).resolves.toEqual({
      type: 'image',
      src: `data:image/png;base64,${PNG_1X1_BASE64}`,
      source: 'file',
      label: 'src-tauri/icons/icon.png'
    })
  })

  it('detects public WebP icons used by CLI tools', async () => {
    const repoPath = await makeTempRepoDir()
    const webpBase64 = 'UklGRhoAAABXRUJQVlA4IA4AAAAwAQCdASoBAAEAAQIlSkwAAA=='
    await mkdir(join(repoPath, 'public'), { recursive: true })
    await writeFile(join(repoPath, 'public', 'icon.webp'), Buffer.from(webpBase64, 'base64'))

    await expect(detectRepoIcon({ repoPath, executionHostId: 'local' })).resolves.toEqual({
      type: 'image',
      src: `data:image/webp;base64,${webpBase64}`,
      source: 'file',
      label: 'public/icon.webp'
    })
  })

  it('resolves declared icon hrefs from project source files', async () => {
    const repoPath = await makeTempRepoDir()
    await writeFile(join(repoPath, 'index.html'), '<link rel="icon" href="/brand/icon.png">')
    await mkdir(join(repoPath, 'public', 'brand'), { recursive: true })
    await writeFile(
      join(repoPath, 'public', 'brand', 'icon.png'),
      Buffer.from(PNG_1X1_BASE64, 'base64')
    )

    await expect(detectRepoIcon({ repoPath, executionHostId: 'local' })).resolves.toEqual({
      type: 'image',
      src: `data:image/png;base64,${PNG_1X1_BASE64}`,
      source: 'file',
      label: 'public/brand/icon.png'
    })
  })

  it('resolves relative declared icon hrefs from nested source files', async () => {
    const repoPath = await makeTempRepoDir()
    await mkdir(join(repoPath, 'src', 'routes', 'brand'), { recursive: true })
    await writeFile(
      join(repoPath, 'src', 'routes', '__root.tsx'),
      'export const links = () => [{ rel: "icon", href: "./brand/icon.png" }]'
    )
    await writeFile(
      join(repoPath, 'src', 'routes', 'brand', 'icon.png'),
      Buffer.from(PNG_1X1_BASE64, 'base64')
    )

    await expect(detectRepoIcon({ repoPath, executionHostId: 'local' })).resolves.toEqual({
      type: 'image',
      src: `data:image/png;base64,${PNG_1X1_BASE64}`,
      source: 'file',
      label: 'src/routes/brand/icon.png'
    })
  })

  it('skips oversized source files when looking for declared icon hrefs', async () => {
    const repoPath = await makeTempRepoDir()
    await writeFile(
      join(repoPath, 'index.html'),
      `${'x'.repeat(256 * 1024 + 1)}<link rel="icon" href="/brand/icon.png">`
    )
    await mkdir(join(repoPath, 'public', 'brand'), { recursive: true })
    await writeFile(
      join(repoPath, 'public', 'brand', 'icon.png'),
      Buffer.from(PNG_1X1_BASE64, 'base64')
    )

    await expect(detectRepoIcon({ repoPath, executionHostId: 'local' })).resolves.toBeUndefined()
  })

  it('does not resolve declared icon hrefs outside the repo', async () => {
    const parentPath = await makeTempRepoDir()
    const repoPath = join(parentPath, 'repo')
    await mkdir(repoPath)
    await writeFile(join(parentPath, 'outside.png'), Buffer.from(PNG_1X1_BASE64, 'base64'))
    await writeFile(join(repoPath, 'index.html'), '<link rel="icon" href="../outside.png">')

    await expect(detectRepoIcon({ repoPath, executionHostId: 'local' })).resolves.toBeUndefined()
  })

  it('returns no icon for an SSH-hosted repo whose filesystem provider is missing', async () => {
    // Why: the same path exists on the client machine — reading it would hand
    // back the local repository's icon for a remote repo.
    const repoPath = await makeTempRepoDir()
    await writeFile(join(repoPath, 'favicon.png'), Buffer.from(PNG_1X1_BASE64, 'base64'))
    await writeFile(
      join(repoPath, 'package.json'),
      JSON.stringify({ homepage: 'https://app.example.com/docs' })
    )

    await expect(
      detectRepoIcon({ repoPath, executionHostId: 'ssh:not-connected' })
    ).resolves.toBeUndefined()
  })

  it('still detects local icons for a repo on this machine', async () => {
    const repoPath = await makeTempRepoDir()
    await writeFile(join(repoPath, 'favicon.png'), Buffer.from(PNG_1X1_BASE64, 'base64'))

    await expect(detectRepoIcon({ repoPath, executionHostId: 'local' })).resolves.toMatchObject({
      source: 'file',
      label: 'favicon.png'
    })
  })

  it('reads nothing for a runtime host even when its nested SSH target is registered here', async () => {
    // Why: a `runtime:` repo row's `connectionId` names a target in that server's namespace. Both
    // spellings of the incumbent shape are wrong here — a null one reads this machine's copy of
    // the path, and the nested id dials a same-named box of ours.
    const repoPath = await makeTempRepoDir()
    await writeFile(join(repoPath, 'favicon.png'), Buffer.from(PNG_1X1_BASE64, 'base64'))

    await expect(
      detectRepoIcon({ repoPath, executionHostId: 'runtime:env-a' })
    ).resolves.toBeUndefined()
  })

  it('does not fetch a GitHub owner avatar for GitHub repos', async () => {
    const repoPath = await makeTempRepoDir()
    await gitExecFileAsync(['init'], { cwd: repoPath })
    await gitExecFileAsync(['remote', 'add', 'origin', 'git@github.com:stablyai/orca.git'], {
      cwd: repoPath
    })

    await expect(detectRepoIcon({ repoPath, executionHostId: 'local' })).resolves.toBeUndefined()
  })

  it('stores a null upstream marker for git repos without a resolved fork parent', async () => {
    const repoPath = await makeTempRepoDir()
    await gitExecFileAsync(['init'], { cwd: repoPath })

    await expect(
      detectRepoIconAndUpstream({ repoPath, kind: 'git', executionHostId: 'local' })
    ).resolves.toEqual({
      upstream: null
    })
  })

  it('records the remote identity of a fork without resolving its upstream', async () => {
    const repoPath = await makeTempRepoDir()
    await gitExecFileAsync(['init'], { cwd: repoPath })
    await gitExecFileAsync(['remote', 'add', 'origin', 'git@github.com:tmchow/orca.git'], {
      cwd: repoPath
    })
    await gitExecFileAsync(['remote', 'add', 'upstream', 'git@github.com:stablyai/orca.git'], {
      cwd: repoPath
    })

    await expect(
      detectRepoIconAndUpstream({ repoPath, kind: 'git', executionHostId: 'local' })
    ).resolves.toEqual({
      gitRemoteIdentity: {
        canonicalKey: 'github.com/stablyai/orca',
        remoteName: 'upstream',
        remoteUrl: 'git@github.com:stablyai/orca.git'
      },
      // Why: no forge lookup runs, so fork parents are never resolved and no avatar is derived.
      upstream: null
    })
  })

  it('records the upstream remote identity of a renamed fork without an avatar', async () => {
    const repoPath = await makeTempRepoDir()
    await gitExecFileAsync(['init'], { cwd: repoPath })
    await gitExecFileAsync(['remote', 'add', 'origin', 'git@github.com:acme/rocket-pro.git'], {
      cwd: repoPath
    })
    await gitExecFileAsync(
      ['remote', 'add', 'upstream', 'git@github.com:upstream-org/rocket.git'],
      {
        cwd: repoPath
      }
    )

    await expect(
      detectRepoIconAndUpstream({ repoPath, kind: 'git', executionHostId: 'local' })
    ).resolves.toEqual({
      gitRemoteIdentity: {
        canonicalKey: 'github.com/upstream-org/rocket',
        remoteName: 'upstream',
        remoteUrl: 'git@github.com:upstream-org/rocket.git'
      },
      upstream: null
    })
  })

  it('detects a provider-neutral git remote identity for non-GitHub remotes', async () => {
    const repoPath = await makeTempRepoDir()
    await gitExecFileAsync(['init'], { cwd: repoPath })
    await gitExecFileAsync(
      ['remote', 'add', 'origin', 'git@git.company.test:platform/tools/sample-app.git'],
      { cwd: repoPath }
    )

    await expect(
      detectRepoIconAndUpstream({ repoPath, kind: 'git', executionHostId: 'local' })
    ).resolves.toMatchObject({
      gitRemoteIdentity: {
        canonicalKey: 'git.company.test/platform/tools/sample-app',
        remoteName: 'origin',
        remoteUrl: 'git@git.company.test:platform/tools/sample-app.git'
      },
      upstream: null
    })
  })
})
