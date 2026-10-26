import { z } from 'zod'

export const ManagedDataAccountProviderParams = z.object({
  provider: z.enum(['opencode', 'devin'])
})
export const AddDataAccountParams = ManagedDataAccountProviderParams.extend({
  sourceDataHome: z.string().min(1),
  label: z.string().trim().min(1).max(120)
})
export const SelectDataAccountParams = ManagedDataAccountProviderParams.extend({
  accountId: z.uuid().nullable()
})
export const RemoveDataAccountParams = ManagedDataAccountProviderParams.extend({
  accountId: z.uuid()
})
export const CodexSelectionTarget = z.discriminatedUnion('runtime', [
  z.object({ runtime: z.literal('host'), wslDistro: z.null() }).strict(),
  z
    .object({
      runtime: z.literal('wsl'),
      // A null distro intentionally means all WSL selection slots.
      wslDistro: z.string().trim().min(1).max(255).nullable()
    })
    .strict()
])

export const SelectAccountParams = z.object({
  accountId: z
    .union([z.string().min(1, 'Missing accountId'), z.null()])
    .transform((v) => (v === null ? null : v))
})

export const SelectCodexAccountForTargetParams = SelectAccountParams.extend({
  target: CodexSelectionTarget
})

export const RemoveAccountParams = z.object({
  accountId: z.string().min(1, 'Missing accountId')
})

export const AddClaudeFromConfigDirParams = z.object({
  configDir: z.string().min(1, 'Missing configDir'),
  runtime: z.enum(['host', 'wsl']).optional(),
  wslDistro: z.string().nullish(),
  previousLegacyCredentialsSha256: z
    .string()
    .regex(/^[a-f0-9]{64}$/, 'Invalid legacy credential digest')
    .nullable()
    .optional()
})

export const AddCodexFromHomeParams = z.object({
  sourceHome: z.string().min(1, 'Missing sourceHome'),
  runtime: z.enum(['host', 'wsl']).optional(),
  wslDistro: z.string().nullish()
})

// Why: `orca account list` prints only emails and the active ids, so it opts out
// of the forced all-provider usage refresh below — that lane bypasses the poll
// throttle and Retry-After gate and costs one serial round-trip per account.
export const ListAccountsParams = z.object({
  refreshUsage: z.boolean().default(true)
})

export const AccountsUnsubscribeParams = z.object({
  subscriptionId: z
    .unknown()
    .transform((value) => (typeof value === 'string' && value.length > 0 ? value : ''))
    .pipe(z.string().min(1, 'Missing subscriptionId'))
})

const ClaudeSignInTarget = {
  runtime: z.enum(['host', 'wsl']).optional(),
  wslDistro: z.string().nullish()
}

export const BeginClaudeSignInParams = z
  .object({ accountId: z.string().min(1).optional(), ...ClaudeSignInTarget })
  .strict()

export const FinishClaudeSignInParams = z
  .object({ accountId: z.string().min(1), ...ClaudeSignInTarget })
  .strict()

export const HostAccountSignInStartParams = z.object({ provider: z.enum(['claude', 'codex']) })

export const HostAccountSignInWaitParams = z.object({
  flowId: z.string().min(1).max(64),
  afterRevision: z.number().int().nonnegative().default(0)
})

export const HostAccountSignInFlowParams = z.object({ flowId: z.string().min(1).max(64) })

export const HostAccountSignInCodeParams = HostAccountSignInFlowParams.extend({
  code: z
    .string()
    .trim()
    .min(1, 'Paste the code from the sign-in page.')
    .max(4_096)
    // Why: the code becomes one line on the login's stdin; a newline inside it would answer twice.
    .regex(/^[^\s\p{Cc}]+$/u, 'That code has spaces or line breaks in it. Copy it again.')
})
