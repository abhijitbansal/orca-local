// Why: parking a paired PTY needs a host advertising bounded snapshot restore, and this build can
// never pair with a host, so no environment is ever eligible.
const NO_PARKING_ENVIRONMENT_IDS: ReadonlySet<string> = new Set()

export function selectPairedRuntimeParkingEnvironmentIds(
  _statuses?: ReadonlyMap<string, unknown>
): ReadonlySet<string> {
  return NO_PARKING_ENVIRONMENT_IDS
}

export function selectPairedRuntimeParkingEnvironmentIdsFromState(_state: {
  runtimeStatusByEnvironmentId: ReadonlyMap<string, unknown>
}): ReadonlySet<string> {
  return NO_PARKING_ENVIRONMENT_IDS
}
