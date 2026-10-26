import { defineMethod, defineStreamingMethod, type RpcContext } from '../core'
import { rpcCallerOperationKey } from '../rpc-caller-identity'
import { HostAccountSignInFlows } from '../../host-account-sign-in-flows'
import type { OrcaRuntimeService } from '../../orca-runtime'
import {
  AccountsUnsubscribeParams,
  AddClaudeFromConfigDirParams,
  BeginClaudeSignInParams,
  FinishClaudeSignInParams,
  AddCodexFromHomeParams,
  ListAccountsParams,
  RemoveAccountParams,
  SelectAccountParams,
  SelectCodexAccountForTargetParams,
  HostAccountSignInStartParams,
  HostAccountSignInWaitParams,
  HostAccountSignInFlowParams,
  HostAccountSignInCodeParams
} from '../../../../shared/rpc-contract/accounts-params'
import { HostAccountLaunchEnvParams } from '../../../../shared/host-account-launch-env'

// Why: monotonically increasing per-process counter avoids the Date.now()
// collision that fired when two near-simultaneous accounts.subscribe calls
// collided on the same millisecond and one evicted the other through
// registerSubscriptionCleanup's existing-key eviction path.
let accountsSubscriptionSeq = 0

const hostSignIns = new WeakMap<OrcaRuntimeService, HostAccountSignInFlows>()
function hostSignInFlows(runtime: OrcaRuntimeService): HostAccountSignInFlows {
  let flows = hostSignIns.get(runtime)
  if (!flows) {
    flows = new HostAccountSignInFlows((provider, channel) =>
      runtime.runHostAccountSignIn(provider, channel)
    )
    hostSignIns.set(runtime, flows)
  }
  return flows
}

/** The caller a sign-in belongs to, as its transport proved it; one it can't name gets none. */
function signInOwner({ caller }: Pick<RpcContext, 'caller'>): string {
  if (!caller) {
    throw new Error('This client cannot add accounts on this host.')
  }
  return rpcCallerOperationKey(caller)
}

export const ACCOUNT_METHODS = [
  // Why runtime clients only: the desktop that owns this host's accounts (a WSL host) pushes them.
  defineMethod({
    name: 'accounts.setHostLaunchEnv',
    permission: 'accounts-admin',
    params: HostAccountLaunchEnvParams,
    handler: async (params, { runtime, clientKind }) => {
      if (clientKind === 'mobile') {
        throw new Error('Only the Orca desktop that owns this host can set its accounts.')
      }
      runtime.setHostAccountLaunchEnv(params)
      return {}
    }
  }),
  defineMethod({
    name: 'accounts.list',
    permission: 'workspace',
    params: ListAccountsParams,
    // Why: `refreshUsage` stays in the schema for older clients; there is no vendor usage to refresh.
    handler: async (_params, { runtime }) => runtime.getAccountsSnapshot()
  }),
  defineMethod({
    name: 'accounts.selectClaude',
    permission: 'accounts-admin',
    params: SelectAccountParams,
    handler: async (params, { runtime }) => runtime.selectClaudeAccount(params.accountId)
  }),
  defineMethod({
    name: 'accounts.selectCodex',
    permission: 'accounts-admin',
    params: SelectAccountParams,
    handler: async (params, { runtime }) => runtime.selectCodexAccount(params.accountId)
  }),
  defineMethod({
    // Why: old hosts silently strip unknown target fields from selectCodex.
    // A distinct RPC makes version skew fail before it can clear the host slot.
    name: 'accounts.selectCodexForTarget',
    permission: 'accounts-admin',
    params: SelectCodexAccountForTargetParams,
    handler: async (params, { runtime }) =>
      runtime.selectCodexAccountForTarget(params.accountId, params.target)
  }),
  defineMethod({
    name: 'accounts.removeClaude',
    permission: 'accounts-admin',
    params: RemoveAccountParams,
    handler: async (params, { runtime }) => runtime.removeClaudeAccount(params.accountId)
  }),
  defineMethod({
    name: 'accounts.removeCodex',
    permission: 'accounts-admin',
    params: RemoveAccountParams,
    handler: async (params, { runtime }) => runtime.removeCodexAccount(params.accountId)
  }),
  defineMethod({
    name: 'accounts.addClaudeFromConfigDir',
    permission: 'accounts-admin',
    params: AddClaudeFromConfigDirParams,
    handler: async () => {
      throw new Error(
        'Update the Orca CLI to add accounts. Importing Claude logins is no longer supported.'
      )
    }
  }),
  defineMethod({
    name: 'accounts.beginClaudeSignIn',
    permission: 'accounts-admin',
    params: BeginClaudeSignInParams,
    handler: async (params, { runtime, clientKind }) => {
      if (clientKind !== undefined) {
        throw new Error('Sign in on the Orca execution host.')
      }
      return runtime.beginClaudeSignIn(params)
    }
  }),
  defineMethod({
    name: 'accounts.finishClaudeSignIn',
    permission: 'accounts-admin',
    params: FinishClaudeSignInParams,
    handler: async (params, { runtime, clientKind }) => {
      if (clientKind !== undefined) {
        throw new Error('Sign in on the Orca execution host.')
      }
      return runtime.finishClaudeSignIn(params)
    }
  }),
  defineMethod({
    name: 'accounts.cancelClaudeSignIn',
    permission: 'accounts-admin',
    params: FinishClaudeSignInParams,
    handler: async (params, { runtime, clientKind }) => {
      if (clientKind !== undefined) {
        throw new Error('Sign in on the Orca execution host.')
      }
      await runtime.cancelClaudeSignIn(params)
      return {}
    }
  }),
  defineMethod({
    name: 'accounts.addCodexFromHome',
    permission: 'accounts-admin',
    params: AddCodexFromHomeParams,
    handler: async (params, { runtime, clientKind }) => {
      if (clientKind !== undefined) {
        throw new Error('Adding Codex accounts is only available on the Orca host runtime.')
      }
      return runtime.addCodexAccountFromHome(params.sourceHome, {
        runtime: params.runtime,
        wslDistro: params.wslDistro ?? null
      })
    }
  }),
  // Why: the login runs here and its credentials never leave; the caller opens the page and relays
  // the code it shows (#20009).
  defineMethod({
    name: 'accounts.hostSignInStart',
    permission: 'accounts-admin',
    params: HostAccountSignInStartParams,
    handler: async ({ provider }, ctx) =>
      hostSignInFlows(ctx.runtime).start(signInOwner(ctx), provider)
  }),
  defineMethod({
    name: 'accounts.hostSignInWait',
    permission: 'accounts-admin',
    params: HostAccountSignInWaitParams,
    handler: async ({ flowId, afterRevision }, ctx) =>
      hostSignInFlows(ctx.runtime).wait(signInOwner(ctx), flowId, afterRevision, ctx.signal)
  }),
  defineMethod({
    name: 'accounts.hostSignInSubmitCode',
    permission: 'accounts-admin',
    params: HostAccountSignInCodeParams,
    handler: async ({ flowId, code }, ctx) =>
      hostSignInFlows(ctx.runtime).submitCode(signInOwner(ctx), flowId, code)
  }),
  defineMethod({
    name: 'accounts.hostSignInCancel',
    permission: 'accounts-admin',
    params: HostAccountSignInFlowParams,
    handler: async ({ flowId }, ctx) =>
      hostSignInFlows(ctx.runtime).cancel(signInOwner(ctx), flowId)
  }),
  // Why: streaming counterpart so mobile usage bars refresh in place when the
  // desktop's 5-minute rate-limit poll completes or when the user switches
  // accounts on either side. Mirrors the notifications.subscribe pattern.
  defineStreamingMethod({
    name: 'accounts.subscribe',
    permission: 'workspace',
    params: null,
    handler: async (_params, { runtime, connectionId }, emit) => {
      await new Promise<void>((resolve) => {
        const unsubscribe = runtime.onAccountsChanged((snapshot) => {
          emit({ type: 'snapshot', snapshot })
        })

        // Why: scope the id by connectionId so two sockets from the same
        // device (host + accounts screen) cannot evict each other through
        // registerSubscriptionCleanup's "existing key" branch, and append a
        // per-process counter so two concurrent subscribes on the same
        // socket also can't collide.
        const seq = ++accountsSubscriptionSeq
        const subscriptionId = `accounts-${connectionId ?? 'inproc'}-${seq}`
        runtime.registerSubscriptionCleanup(
          subscriptionId,
          () => {
            unsubscribe()
            emit({ type: 'end' })
            resolve()
          },
          connectionId
        )

        emit({ type: 'ready', subscriptionId, snapshot: runtime.getAccountsSnapshot() })
      })
    }
  }),
  defineMethod({
    name: 'accounts.unsubscribe',
    permission: 'workspace',
    params: AccountsUnsubscribeParams,
    handler: async (params, { runtime }) => {
      runtime.cleanupSubscription(params.subscriptionId)
      return { unsubscribed: true }
    }
  })
]
