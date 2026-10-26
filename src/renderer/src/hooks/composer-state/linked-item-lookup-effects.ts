// Local-only stub: linked GitHub items are never looked up, and there is no SSH reconnect to wait on.
export function useLinkedItemLookupEffects(_input: unknown) {
  return { canPrefetchSelectedRepoWorkItems: false, prefetchSshConnectedGeneration: 0 }
}
