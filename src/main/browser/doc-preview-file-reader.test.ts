import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  callRuntimeEnvironment: vi.fn()
}))

vi.mock('../persistence', () => ({
  getCanonicalUserDataPath: () => '/user-data'
}))

import { docPreviewContentType, readDocPreviewFile } from './doc-preview-file-reader'
import {
  authorizeDocPreviewDirectory,
  mintDocPreviewGrant,
  revokeAllDocPreviewGrants
} from './doc-preview-grant-registry'

// Preapprove directories to isolate transport behavior; entry-only authorization is tested separately.
function sshGrant(): ReturnType<typeof mintDocPreviewGrant> {
  const grant = mintDocPreviewGrant({
    owner: { kind: 'ssh', connectionId: 'ssh-1' },
    root: '/home/alice/docs',
    entryRelativePath: 'index.html',
    browserPageId: 'page-1'
  })
  authorizeDocPreviewDirectory(grant.id, grant.entryRelativePath)
  return grant
}

function runtimeGrant(root = '/srv/repo/docs'): ReturnType<typeof mintDocPreviewGrant> {
  const grant = mintDocPreviewGrant({
    owner: {
      kind: 'runtime',
      environmentId: 'env-1',
      worktreeSelector: 'id:wt-1',
      worktreeRoot: '/srv/repo'
    },
    root,
    entryRelativePath: 'index.html',
    browserPageId: 'page-1'
  })
  authorizeDocPreviewDirectory(grant.id, grant.entryRelativePath)
  return grant
}

beforeEach(() => {
  vi.clearAllMocks()
  revokeAllDocPreviewGrants()
})

describe('docPreviewContentType', () => {
  it('maps document and asset extensions, defaulting to octet-stream', () => {
    expect(docPreviewContentType('index.html')).toBe('text/html; charset=utf-8')
    expect(docPreviewContentType('assets/app.CSS')).toBe('text/css; charset=utf-8')
    expect(docPreviewContentType('assets/logo.png')).toBe('image/png')
    expect(docPreviewContentType('data.bin')).toBe('application/octet-stream')
  })
})

describe('readDocPreviewFile — ssh owner', () => {
  it('404s with the not-served message instead of reading anything', async () => {
    const grant = sshGrant()

    await expect(readDocPreviewFile(grant, 'index.html')).resolves.toMatchObject({
      ok: false,
      status: 404,
      message: 'SSH remotes are not supported in this build.'
    })
    expect(mocks.callRuntimeEnvironment).not.toHaveBeenCalled()
  })
})

describe('readDocPreviewFile — paired runtime owner', () => {
  it('fails closed without contacting any runtime, since this build cannot reach a paired server', async () => {
    const outcome = await readDocPreviewFile(runtimeGrant(), 'index.html')

    expect(outcome).toMatchObject({ ok: false, status: 404, reason: 'unreadable' })
    expect(mocks.callRuntimeEnvironment).not.toHaveBeenCalled()
  })
})
