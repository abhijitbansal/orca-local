import { isSqliteAvailable } from '../sqlite/sync-database'

/**
 * Whether this Node can hold an index at all.
 *
 * The store is `node:sqlite`, reached through `process.getBuiltinModule`, which
 * neither exists on Node 18. That is not a hypothetical floor: a host without
 * the full reader surface (22.13-22.15 lack backup()) registers no search
 * service at all rather than one that fails at every call.
 */
export function sessionSearchSqliteAvailable(): boolean {
  return isSqliteAvailable()
}
