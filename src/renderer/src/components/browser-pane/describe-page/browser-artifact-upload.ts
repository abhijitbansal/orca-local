import { canonicalArtifactFilePath } from '@/lib/file-artifact-source-key'
import { getRuntimePathBasename } from '../../../../../shared/cross-platform-path'

export type ShareableBrowserArtifactFile = {
  fileName: string
  filePath: string
}

export function browserFileUrlToAbsolutePath(url: string): string | null {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'file:') {
      return null
    }
    const hostPrefix =
      parsed.hostname && parsed.hostname !== 'localhost' ? `//${parsed.hostname}` : ''
    const absolutePath = `${hostPrefix}${decodeURIComponent(parsed.pathname)}`
    return canonicalArtifactFilePath(
      /^\/[A-Za-z]:\//.test(absolutePath) ? absolutePath.slice(1) : absolutePath
    )
  } catch {
    return null
  }
}

export function getShareableBrowserArtifactFile(url: string): ShareableBrowserArtifactFile | null {
  const filePath = browserFileUrlToAbsolutePath(url)
  if (!filePath || !/\.html?$/i.test(filePath)) {
    return null
  }
  const fileName = getRuntimePathBasename(filePath)
  return fileName ? { fileName, filePath } : null
}
