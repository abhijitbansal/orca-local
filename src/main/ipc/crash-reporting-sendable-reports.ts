import type { CrashReportStore } from '../crash-reporting/crash-report-store'

export async function getLatestPendingReport(
  store: CrashReportStore
): Promise<Awaited<ReturnType<CrashReportStore['getLatestPending']>>> {
  const reports = await store.listRecent()
  return reports.find((report) => report.status === 'pending') ?? null
}

export async function getLatestSendableReport(
  store: CrashReportStore
): Promise<Awaited<ReturnType<CrashReportStore['getLatestPending']>>> {
  const reports = await store.listRecent()
  return (
    reports.find((report) => report.status === 'pending' || report.status === 'dismissed') ?? null
  )
}

export async function getRequestedCrashReport(
  store: CrashReportStore,
  args?: { reportId?: string }
): Promise<Awaited<ReturnType<CrashReportStore['getLatestPending']>>> {
  if (args?.reportId) {
    return store.getById(args.reportId)
  }
  // An explicit uncaptured report must not be replaced by a later pending crash.
  return args ? null : getLatestPendingReport(store)
}
