import { extname } from 'node:path'
import type { DocPreviewFileFailureReason } from '../../shared/doc-preview-scheme'
import { requireSshFilesystemProvider } from '../providers/ssh-filesystem-dispatch'
import {
  resolveDocPreviewAuthorityPaths,
  resolveDocPreviewCandidatePath,
  resolveDocPreviewTargetPath,
  type DocPreviewGrant
} from './doc-preview-grant-registry'

const DIRECT_SSH_DOC_PREVIEW_TEXT_MAX_BYTES = 10 * 1024 * 1024
const DIRECT_SSH_DOC_PREVIEW_BINARY_MAX_BYTES = 10 * 1024 * 1024

/** Why not "needs a newer server": the SSH read path only ever serves images and PDFs as bytes, so
 *  a font is refused there by design, not by version. Name the file type, not the host's age. */
const UNSERVABLE_ASSET_PREVIEW_MESSAGE = 'This workspace cannot send this file type to a preview.'

/** `files.read` clamps text at the host's cap and reports it; serving the clamped bytes would
 *  render a silently half-finished document. */
const TRUNCATED_PREVIEW_MESSAGE = 'This document is too large for the server to send in full.'

/** A provider reports an over-cap file with this message. */
const TOO_LARGE_ERROR_MESSAGE = 'file_too_large'

function isTooLargeReadError(error: unknown): boolean {
  return error instanceof Error && error.message === TOO_LARGE_ERROR_MESSAGE
}

export type DocPreviewReadOutcome =
  | { ok: true; bytes: Buffer; contentType: string }
  | { ok: false; status: number; reason: DocPreviewFileFailureReason; message: string }

const DOC_PREVIEW_CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
  '.csv': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
  '.ico': 'image/x-icon',
  '.pdf': 'application/pdf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf'
}

export function docPreviewContentType(relativePath: string): string {
  return (
    DOC_PREVIEW_CONTENT_TYPES[extname(relativePath).toLowerCase()] ?? 'application/octet-stream'
  )
}

type PreviewFileBytes = {
  content: string
  isBinary: boolean
  truncated?: boolean
  /** Set by every owner that agreed to serve the bytes, so it also survives a 0-byte file. */
  mimeType?: string
}

function toOutcome(source: PreviewFileBytes, contentType: string): DocPreviewReadOutcome {
  if (source.truncated) {
    return { ok: false, status: 413, reason: 'too-large', message: TRUNCATED_PREVIEW_MESSAGE }
  }
  if (!source.isBinary) {
    return { ok: true, bytes: Buffer.from(source.content, 'utf8'), contentType }
  }
  if (source.content) {
    return { ok: true, bytes: Buffer.from(source.content, 'base64'), contentType }
  }
  // Why: an empty binary body is two different answers. A host that still named the file's type
  // read a 0-byte file, and 0 bytes is what it should serve; a host that named no type declined
  // the format outright and has nothing to send.
  return source.mimeType
    ? { ok: true, bytes: Buffer.alloc(0), contentType }
    : {
        ok: false,
        status: 415,
        reason: 'unsupported-asset',
        message: UNSERVABLE_ASSET_PREVIEW_MESSAGE
      }
}

function notFoundOutcome(message = 'Not found'): DocPreviewReadOutcome {
  return { ok: false, status: 404, reason: 'unreadable', message }
}

/** Reads one in-grant path over the same channel the editor uses for that owner. */
export async function readDocPreviewFile(
  grant: DocPreviewGrant,
  relativePath: string
): Promise<DocPreviewReadOutcome> {
  const candidatePath = resolveDocPreviewCandidatePath(grant, relativePath)
  if (!candidatePath) {
    return notFoundOutcome()
  }
  const absolutePath = resolveDocPreviewTargetPath(grant, relativePath)
  if (!absolutePath) {
    return {
      ok: false,
      status: 403,
      reason: 'authorization-required',
      message: 'This file needs permission before the preview can read it.'
    }
  }
  const contentType = docPreviewContentType(relativePath)
  try {
    if (grant.owner.kind === 'ssh') {
      const provider = requireSshFilesystemProvider(grant.owner.connectionId)
      const authority = resolveDocPreviewAuthorityPaths(grant)
      if (!authority.entryPath || !provider.readDocPreviewFile) {
        return notFoundOutcome()
      }
      return toOutcome(
        await provider.readDocPreviewFile({
          boundaryPath: grant.requestBase,
          entryPath: authority.entryPath,
          implicitRootPath: authority.implicitRootPath,
          authorizedRootPaths: authority.authorizedRootPaths,
          targetPath: absolutePath,
          maxTextBytes: DIRECT_SSH_DOC_PREVIEW_TEXT_MAX_BYTES,
          maxBinaryBytes: DIRECT_SSH_DOC_PREVIEW_BINARY_MAX_BYTES
        }),
        contentType
      )
    }
    // Why: a runtime-owned grant names a paired server's filesystem, which this build can never read.
    return notFoundOutcome('unsupported_in_local_build: remote Orca runtimes were removed')
  } catch (error) {
    return isTooLargeReadError(error)
      ? { ok: false, status: 413, reason: 'too-large', message: TRUNCATED_PREVIEW_MESSAGE }
      : notFoundOutcome(error instanceof Error ? error.message : undefined)
  }
}
