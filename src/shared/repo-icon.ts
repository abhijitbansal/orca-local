import { validateRasterImageDataUri } from './image-data-uri'

export type RepoIconImageSource = 'upload' | 'file' | 'favicon' | 'github'

export type RepoIcon =
  | { type: 'lucide'; name: string }
  | { type: 'emoji'; emoji: string }
  | { type: 'image'; src: string; source: RepoIconImageSource; label?: string }

export const MAX_REPO_ICON_UPLOAD_BYTES = 256 * 1024
export const MAX_REPO_ICON_DATA_URL_LENGTH = 400 * 1024

const LUCIDE_ICON_NAME_PATTERN = /^[A-Za-z][A-Za-z0-9]*$/
const isRepoIconImageSource = (value: string): value is RepoIconImageSource =>
  value === 'upload' || value === 'file' || value === 'favicon' || value === 'github'

function computeIsSupportedImageSrc(src: string, source: RepoIconImageSource): boolean {
  if (source === 'upload') {
    return (
      /^data:image\/png;base64,[A-Za-z0-9+/=\s]+$/i.test(src) &&
      validateRasterImageDataUri(src) !== null
    )
  }

  if (source === 'file') {
    return (
      /^data:image\/(?:png|webp);base64,[A-Za-z0-9+/=\s]+$/i.test(src) &&
      validateRasterImageDataUri(src) !== null
    )
  }

  // Why: favicon/github icons were remote loads; a local-only renderer never fetches them.
  return false
}

type ImageSrcVerdict = { src: unknown; source: unknown; supported: boolean }

/**
 * Why: `getRepos()` re-hydrates every repo on every call, and validating one inline data URI means
 * scanning a 400 KB string twice with a regex and base64-decoding its header. `hydrateRepo` is
 * handed the *same* persisted `repoIcon` object every time, so the verdict is cached on that object
 * and dies with it — no cap, no eviction, and nothing retained once a repo or an icon is replaced.
 *
 * `src`/`source` are re-checked on a hit, so mutating the persisted icon in place cannot serve a
 * stale verdict. Both are the identical string references in the steady state, so the compare is a
 * pointer check, not a 400 KB scan.
 */
const imageSrcVerdicts = new WeakMap<object, ImageSrcVerdict>()

function isSupportedImageSrc(
  candidate: Record<string, unknown>,
  src: string,
  source: RepoIconImageSource
): boolean {
  const cached = imageSrcVerdicts.get(candidate)
  if (cached && cached.src === candidate.src && cached.source === candidate.source) {
    return cached.supported
  }
  const supported = computeIsSupportedImageSrc(src, source)
  imageSrcVerdicts.set(candidate, { src: candidate.src, source: candidate.source, supported })
  return supported
}

export function sanitizeRepoIcon(value: unknown): RepoIcon | null | undefined {
  if (value === undefined) {
    return undefined
  }
  if (value === null) {
    return null
  }
  if (!value || typeof value !== 'object') {
    return undefined
  }

  const candidate = value as Record<string, unknown>
  if (candidate.type === 'lucide') {
    const name = typeof candidate.name === 'string' ? candidate.name.trim() : ''
    if (!LUCIDE_ICON_NAME_PATTERN.test(name) || name.length > 40) {
      return undefined
    }
    return { type: 'lucide', name }
  }

  if (candidate.type === 'emoji') {
    const emoji = typeof candidate.emoji === 'string' ? candidate.emoji.trim() : ''
    if (!emoji || emoji.length > 16) {
      return undefined
    }
    return { type: 'emoji', emoji }
  }

  if (candidate.type === 'image') {
    const src = typeof candidate.src === 'string' ? candidate.src.trim() : ''
    const source = typeof candidate.source === 'string' ? candidate.source : ''
    if (!isRepoIconImageSource(source) || src.length > MAX_REPO_ICON_DATA_URL_LENGTH) {
      return undefined
    }
    if (!isSupportedImageSrc(candidate, src, source)) {
      return undefined
    }
    const label = typeof candidate.label === 'string' ? candidate.label.trim().slice(0, 80) : ''
    return {
      type: 'image',
      src,
      source: source as RepoIconImageSource,
      ...(label ? { label } : {})
    }
  }

  return undefined
}
