import type { ProviderRateLimits } from '../../../../shared/rate-limit-types'
import type { GlobalSettings } from '../../../../shared/global-settings-types'

export type UsageProviderSettings = Pick<
  GlobalSettings,
  | 'codexManagedAccounts'
  | 'claudeManagedAccounts'
  | 'opencodeSessionCookie'
  | 'geminiCliOAuthEnabled'
> & {
  // Why: Antigravity has no separate persisted usage credential in Orca. The
  // checked status-bar item is the durable user signal; StatusBar only sets
  // this after PATH detection says the agent is available. Durability further
  // requires geminiCliOAuthEnabled — the snapshot mirrors the Gemini fetch,
  // which never yields data while that opt-in is off.
  antigravityUsageConfigured: boolean
  // Why: MiniMax/Grok sign-in live on disk, not in settings; main sets these each poll.
  minimaxCookieConfigured: boolean
  minimaxApiKeyConfigured: boolean
  // Why: the OpenCode Go key can live in OPENCODE_API_KEY or in OpenCode's own
  // store, neither of which the renderer can see; main reports presence.
  opencodeGoApiKeyConfigured: boolean
  grokAuthConfigured: boolean
  cursorAuthConfigured: boolean
}

type UsageProviderSnapshots = {
  claude: ProviderRateLimits | null | undefined
  codex: ProviderRateLimits | null | undefined
  gemini: ProviderRateLimits | null | undefined
  opencodeGo: ProviderRateLimits | null | undefined
  kimi: ProviderRateLimits | null | undefined
  antigravity: ProviderRateLimits | null | undefined
  minimax: ProviderRateLimits | null | undefined
  grok: ProviderRateLimits | null | undefined
  cursor: ProviderRateLimits | null | undefined
  zcode?: ProviderRateLimits | null
}

type UsageProviderId = ProviderRateLimits['provider']

function hasUsageData(provider: ProviderRateLimits): boolean {
  return Boolean(
    provider.session ||
    provider.weekly ||
    provider.fableWeekly ||
    provider.monthly ||
    (provider.buckets && provider.buckets.length > 0)
  )
}

// Why: only Claude is fed locally; main reports `null` for it (and every other provider) until a statusline post
// lands, so `null` is a settled "no data". Pending means the renderer has no payload yet or an optimistic refresh.
function isClaudeSnapshotPending(provider: ProviderRateLimits | null | undefined): boolean {
  return provider === undefined || (provider?.status === 'fetching' && !hasUsageData(provider))
}

// Why: a provider that returns `unavailable` is explicitly not configured
// (Gemini OAuth off, OpenCode Go cookie unset, Claude on API-key billing). Its
// fetch object is non-null, so a bare `!== null` check still renders a "--"
// bar for a provider the user never set up. `error` is kept visible on purpose
// — that's a *configured* provider failing transiently, and hiding it would
// make the bar flap on every refresh hiccup.
export function isProviderConfigured(
  provider: ProviderRateLimits | null | undefined
): provider is ProviderRateLimits {
  // Why: renderer HMR can briefly run against an older main process whose rate-limit
  // payload predates newer provider keys, so missing snapshots arrive as undefined.
  if (provider == null || provider.status === 'unavailable') {
    return false
  }
  if (provider.status === 'fetching' && !hasUsageData(provider)) {
    return false
  }
  return true
}

export function hasUsageProviderSettings(
  settings: Partial<UsageProviderSettings> | null | undefined
): boolean {
  return Boolean(
    (settings?.codexManagedAccounts?.length ?? 0) > 0 ||
    (settings?.claudeManagedAccounts?.length ?? 0) > 0 ||
    settings?.geminiCliOAuthEnabled === true ||
    Boolean(settings?.opencodeSessionCookie?.trim()) ||
    settings?.opencodeGoApiKeyConfigured === true ||
    // Antigravity's durable signal requires geminiCliOAuthEnabled, so it is
    // already covered by the gemini term above.
    settings?.minimaxCookieConfigured === true ||
    settings?.minimaxApiKeyConfigured === true ||
    settings?.grokAuthConfigured === true ||
    settings?.cursorAuthConfigured === true
  )
}

export function hasUsageProviderSettingsForProvider(
  providerId: UsageProviderId,
  settings: Partial<UsageProviderSettings> | null | undefined
): boolean {
  if (!settings) {
    return false
  }
  if (providerId === 'claude') {
    return (settings.claudeManagedAccounts?.length ?? 0) > 0
  }
  if (providerId === 'codex') {
    return (settings.codexManagedAccounts?.length ?? 0) > 0
  }
  if (providerId === 'gemini') {
    return settings.geminiCliOAuthEnabled === true
  }
  if (providerId === 'opencode-go') {
    return (
      Boolean(settings.opencodeSessionCookie?.trim()) ||
      settings.opencodeGoApiKeyConfigured === true
    )
  }
  if (providerId === 'antigravity') {
    // Why: the Antigravity snapshot mirrors the Gemini fetch, which stays
    // 'unavailable' until the user opts into Gemini CLI OAuth. Without that
    // gate the default-on checked item would pin a permanently dead bar.
    return settings.antigravityUsageConfigured === true && settings.geminiCliOAuthEnabled === true
  }
  if (providerId === 'minimax') {
    return settings.minimaxCookieConfigured === true || settings.minimaxApiKeyConfigured === true
  }
  if (providerId === 'grok') {
    return settings.grokAuthConfigured === true
  }
  if (providerId === 'cursor') {
    return settings.cursorAuthConfigured === true
  }
  return false
}

// Why: a skeleton would never resolve until a statusline post arrives, so a configured-but-silent Claude reads "no data".
function createNoDataClaudeSnapshot(): ProviderRateLimits {
  return {
    provider: 'claude',
    session: null,
    weekly: null,
    updatedAt: 0,
    error: null,
    status: 'unavailable'
  }
}

export function getVisibleUsageProvider(
  providerId: UsageProviderId,
  provider: ProviderRateLimits | null | undefined,
  settings: Partial<UsageProviderSettings> | null | undefined
): ProviderRateLimits | null {
  if (isProviderConfigured(provider)) {
    return provider
  }
  // Why: only Claude is fed locally (statusline hook); every other provider is never fetched, so a pending
  // skeleton for it would never resolve.
  if (providerId !== 'claude' || !hasUsageProviderSettingsForProvider(providerId, settings)) {
    return null
  }
  return provider ?? createNoDataClaudeSnapshot()
}

export function isUsageEmptyState(
  providers: UsageProviderSnapshots,
  settings: Partial<UsageProviderSettings> | null | undefined
): boolean {
  // Why: settings are the durable source for managed accounts. Until they
  // hydrate, avoid showing a setup CTA that can contradict connected accounts.
  if (!settings) {
    return false
  }
  // Why: a system-default Claude has no persisted account row; wait for its first snapshot before teaching the
  // user to connect one. Every other provider is never fetched, so its null snapshot is already settled.
  if (isClaudeSnapshotPending(providers.claude)) {
    return false
  }
  return (
    !hasUsageProviderSettings(settings) &&
    !isProviderConfigured(providers.claude) &&
    !isProviderConfigured(providers.codex) &&
    !isProviderConfigured(providers.gemini) &&
    !isProviderConfigured(providers.opencodeGo) &&
    !isProviderConfigured(providers.kimi) &&
    !isProviderConfigured(providers.antigravity) &&
    !isProviderConfigured(providers.minimax) &&
    !isProviderConfigured(providers.grok) &&
    !isProviderConfigured(providers.cursor) &&
    !isProviderConfigured(providers.zcode)
  )
}
