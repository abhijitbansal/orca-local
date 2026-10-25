import { extname } from 'node:path'
import type { DocPreviewFileFailureReason } from '../../shared/doc-preview-scheme'
import { FONT_FILE_MIME_TYPES } from '../../shared/font-file-extensions'
import { SSH_HOST_NOT_SERVED_MESSAGE } from '../providers/ssh-host-not-served-error'
import {
  resolveDocPreviewCandidatePath,
  resolveDocPreviewTargetPath,
  type DocPreviewGrant
} from './doc-preview-grant-registry'

// Reject clamped text rather than rendering a partial document.
const TRUNCATED_PREVIEW_MESSAGE = 'This document is too large for the server to send in full.'

const RUNTIME_TOO_LARGE_ERROR = 'file_too_large'

function isTooLargeReadError(error: unknown): boolean {
  return error instanceof Error && error.message === RUNTIME_TOO_LARGE_ERROR
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
  ...FONT_FILE_MIME_TYPES
}

export function docPreviewContentType(relativePath: string): string {
  return (
    DOC_PREVIEW_CONTENT_TYPES[extname(relativePath).toLowerCase()] ?? 'application/octet-stream'
  )
}

function notFoundOutcome(message = 'Not found'): DocPreviewReadOutcome {
  return { ok: false, status: 404, reason: 'unreadable', message }
}

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
  try {
    if (grant.owner.kind === 'ssh') {
      return notFoundOutcome(SSH_HOST_NOT_SERVED_MESSAGE)
    }
    // Why: a runtime-owned grant names a paired server's filesystem, which this build can never read.
    return notFoundOutcome('unsupported_in_local_build: remote Orca runtimes were removed')
  } catch (error) {
    return isTooLargeReadError(error)
      ? { ok: false, status: 413, reason: 'too-large', message: TRUNCATED_PREVIEW_MESSAGE }
      : notFoundOutcome(error instanceof Error ? error.message : undefined)
  }
}
