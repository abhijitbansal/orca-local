import type { ProviderRateLimits } from '../../../shared/rate-limit-types'
import type { ClaudeRuntimeAuthPreparation } from '../../claude-accounts/runtime-auth-service'
import type { ClaudeAccountSelectionTarget } from '../../claude-accounts/runtime-selection'

export type {
  ClaudeAccountSelectionTarget,
  NormalizedClaudeAccountSelectionTarget
} from '../../claude-accounts/runtime-selection'
export { normalizeClaudeAccountSelectionTarget } from '../../claude-accounts/runtime-selection'
export type {
  CodexAccountSelectionTarget,
  NormalizedCodexAccountSelectionTarget
} from '../../codex-accounts/runtime-selection'
export { normalizeCodexAccountSelectionTarget } from '../../codex-accounts/runtime-selection'

export type InactiveCodexAccountInfo = {
  id: string
  resolveHome: () => { kind: 'ready'; managedHomePath: string } | { kind: 'skip' }
}

export type ClaudeAuthPreparationResolver = (
  target?: ClaudeAccountSelectionTarget
) => Promise<ClaudeRuntimeAuthPreparation>

// Why: statusline posts arrive on every turn; skip renderer pushes for identical windows so streaming sessions don't spam state updates.
export const LIVE_CLAUDE_INGEST_DEDUPE_MS = 30 * 1000

export type InternalRateLimitState = {
  claude: ProviderRateLimits | null
  codex: ProviderRateLimits | null
  gemini: ProviderRateLimits | null
  opencodeGo: ProviderRateLimits | null
  kimi: ProviderRateLimits | null
  antigravity: ProviderRateLimits | null
  minimax: ProviderRateLimits | null
  grok: ProviderRateLimits | null
  cursor: ProviderRateLimits | null
  zcode: ProviderRateLimits | null
}

export function normalizeClaudeConfigDir(dir: string | null | undefined): string | null {
  // Why: normalize mixed Windows separators for path attribution; preserve Linux case sensitivity.
  const trimmed = dir?.trim().replace(/\\/g, '/').replace(/\/+$/, '')
  return trimmed || null
}

export function isSameUsageWindow(
  a: ProviderRateLimits['session'],
  b: ProviderRateLimits['session']
): boolean {
  if (!a || !b) {
    return a === b
  }
  return a.usedPercent === b.usedPercent && a.resetsAt === b.resetsAt
}
