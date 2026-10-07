import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  readDocPreviewFile: vi.fn(),
  requireSshFilesystemProvider: vi.fn()
}))

vi.mock('../providers/ssh-filesystem-dispatch', () => ({
  requireSshFilesystemProvider: mocks.requireSshFilesystemProvider
}))

import { docPreviewContentType, readDocPreviewFile } from './doc-preview-file-reader'
import {
  authorizeDocPreviewDirectory,
  mintDocPreviewGrant,
  revokeAllDocPreviewGrants
} from './doc-preview-grant-registry'

// Why the fixtures approve the document directory up front: these tests exercise the transport
// half of a read — an entry-only grant's approval flow is pinned in its own test below.
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
  mocks.requireSshFilesystemProvider.mockReturnValue({
    readDocPreviewFile: mocks.readDocPreviewFile
  })
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
  it('reads text through the SSH filesystem provider', async () => {
    mocks.readDocPreviewFile.mockResolvedValue({ content: '<h1>hi</h1>', isBinary: false })

    const outcome = await readDocPreviewFile(sshGrant(), 'index.html')

    expect(mocks.requireSshFilesystemProvider).toHaveBeenCalledWith('ssh-1')
    expect(mocks.readDocPreviewFile).toHaveBeenCalledWith({
      boundaryPath: '/home/alice/docs',
      entryPath: '/home/alice/docs/index.html',
      implicitRootPath: null,
      authorizedRootPaths: ['/home/alice/docs'],
      targetPath: '/home/alice/docs/index.html',
      maxTextBytes: 10 * 1024 * 1024,
      maxBinaryBytes: 10 * 1024 * 1024
    })
    expect(outcome).toEqual({
      ok: true,
      bytes: Buffer.from('<h1>hi</h1>', 'utf8'),
      contentType: 'text/html; charset=utf-8'
    })
  })

  it('decodes a base64 binary asset', async () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47])
    mocks.readDocPreviewFile.mockResolvedValue({ content: png.toString('base64'), isBinary: true })

    const outcome = await readDocPreviewFile(sshGrant(), 'assets/logo.png')

    expect(outcome).toEqual({ ok: true, bytes: png, contentType: 'image/png' })
  })

  // Why: the SSH reader rejects an over-cap file rather than clamping it, so a completed read is
  // always whole and needs no truncation flag.
  it('serves a whole SSH read that carries no truncation flag', async () => {
    mocks.readDocPreviewFile.mockResolvedValue({ content: '<h1>whole</h1>', isBinary: false })

    expect(await readDocPreviewFile(sshGrant(), 'index.html')).toMatchObject({ ok: true })
  })

  // Why: the SSH read path only serves images and PDFs as bytes, so a font is refused there by
  // design — the failure must name the file type, not a stale server.
  it('reports a file type the host will not send as unsupported-asset', async () => {
    mocks.readDocPreviewFile.mockResolvedValue({ content: '', isBinary: true })

    const outcome = await readDocPreviewFile(sshGrant(), 'assets/font.woff2')

    expect(outcome).toMatchObject({ ok: false, status: 415, reason: 'unsupported-asset' })
  })

  // Why: a host that still named the type read a 0-byte file, so 0 bytes is the honest answer —
  // reporting it as a refused format would be a failure the workspace never reported.
  it('serves an empty file the host still typed instead of calling it unsupported', async () => {
    mocks.readDocPreviewFile.mockResolvedValue({
      content: '',
      isBinary: true,
      mimeType: 'image/png'
    })

    const outcome = await readDocPreviewFile(sshGrant(), 'assets/logo.png')

    expect(outcome).toEqual({ ok: true, bytes: Buffer.alloc(0), contentType: 'image/png' })
  })

  it('404s when the host cannot canonicalize the path at all', async () => {
    mocks.readDocPreviewFile.mockRejectedValue(new Error('no such file'))

    expect(await readDocPreviewFile(sshGrant(), 'index.html')).toMatchObject({
      ok: false,
      status: 404
    })
    expect(mocks.readDocPreviewFile).toHaveBeenCalledOnce()
  })

  it('404s a path outside the grant root without touching the provider', async () => {
    const outcome = await readDocPreviewFile(sshGrant(), '../../etc/passwd')

    expect(outcome).toMatchObject({ ok: false, status: 404 })
    expect(mocks.requireSshFilesystemProvider).not.toHaveBeenCalled()
  })

  it('requires approval for a sibling directory before touching the SSH provider', async () => {
    const grant = mintDocPreviewGrant({
      owner: { kind: 'ssh', connectionId: 'ssh-1' },
      requestBase: '/home/alice',
      root: '/home/alice/docs',
      entryRelativePath: 'docs/index.html',
      browserPageId: 'page-1'
    })

    await expect(readDocPreviewFile(grant, 'assets/logo.png')).resolves.toMatchObject({
      ok: false,
      status: 403,
      reason: 'authorization-required'
    })
    expect(mocks.requireSshFilesystemProvider).not.toHaveBeenCalled()

    authorizeDocPreviewDirectory(grant.id, 'assets/logo.png')
    mocks.readDocPreviewFile.mockResolvedValue({ content: 'logo', isBinary: false })

    await expect(readDocPreviewFile(grant, 'assets/logo.png')).resolves.toMatchObject({ ok: true })
    expect(mocks.readDocPreviewFile).toHaveBeenCalledWith(
      expect.objectContaining({
        boundaryPath: '/home/alice',
        implicitRootPath: '/home/alice/docs',
        authorizedRootPaths: ['/home/alice/assets'],
        targetPath: '/home/alice/assets/logo.png'
      })
    )
  })

  it('reports an over-cap SSH file as too large rather than unreadable', async () => {
    mocks.readDocPreviewFile.mockRejectedValue(new Error('file_too_large'))

    expect(await readDocPreviewFile(sshGrant(), 'huge.html')).toMatchObject({
      ok: false,
      status: 413
    })
  })

  it('404s when the provider read fails', async () => {
    mocks.readDocPreviewFile.mockRejectedValue(new Error('no such file'))

    expect(await readDocPreviewFile(sshGrant(), 'missing.html')).toMatchObject({
      ok: false,
      status: 404
    })
  })
})

describe('readDocPreviewFile — paired runtime owner', () => {
  it('fails closed without reading anything, since this build cannot reach a paired server', async () => {
    const outcome = await readDocPreviewFile(runtimeGrant(), 'index.html')

    expect(outcome).toMatchObject({ ok: false, status: 404, reason: 'unreadable' })
    expect(mocks.requireSshFilesystemProvider).not.toHaveBeenCalled()
  })
})
