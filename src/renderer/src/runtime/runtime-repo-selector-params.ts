export function mapRepoPathArg(args: unknown): unknown {
  if (!args || typeof args !== 'object' || !('repoPath' in args)) {
    return args
  }
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: args is a non-null object (checked above); each field is read as unknown and narrowed.
  const record = args as Record<string, unknown>
  const repoId = typeof record.repoId === 'string' && record.repoId.trim() ? record.repoId : null
  return {
    ...record,
    // Why: duplicate checked-out repos make path/name selectors ambiguous; prefer the explicit repo id the renderer passes.
    repo: repoId ? `id:${repoId}` : record.repoPath
  }
}
