import React from 'react'
import { ExternalLink, LoaderCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import CommentMarkdown from '@/components/sidebar/CommentMarkdown'
import type { PRCheckDetail, PRCheckRunDetails } from '../../../../shared/github/check-types'
import { translate } from '@/i18n/i18n'
import { formatCheckRunOutputForClipboard } from './check-run-clipboard-text'
import { CheckRunAnnotations } from './CheckRunAnnotations'
import { CheckRunJobs } from './CheckRunJobs'
import { CheckRunCopyButton } from './CheckRunCopyButton'

function formatCheckTimestamp(value: string | null | undefined): string | null {
  if (!value) {
    return null
  }
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return value
  }
  return parsed.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  })
}

type CheckStatusLike = {
  status: PRCheckDetail['status'] | (string & {}) | null | undefined
  conclusion: PRCheckDetail['conclusion'] | (string & {}) | null | undefined
}

function getCheckStatusLabel(check: CheckStatusLike): string {
  const conclusion = check.conclusion ?? 'pending'
  switch (conclusion) {
    case 'success':
      return translate('auto.components.editor.CheckRunDetailsPanel.8f2d0f5a91', 'Passed')
    case 'failure':
      return translate('auto.components.editor.CheckRunDetailsPanel.4c8e1b2d73', 'Failed')
    case 'cancelled':
      return translate('auto.components.editor.CheckRunDetailsPanel.91a4c7e2b0', 'Cancelled')
    case 'timed_out':
      return translate('auto.components.editor.CheckRunDetailsPanel.2f6d8a1c45', 'Timed out')
    case 'action_required':
      return translate(
        'auto.components.editor.CheckRunDetailsPanel.actionRequired',
        'Action required'
      )
    case 'skipped':
      return translate('auto.components.editor.CheckRunDetailsPanel.7b3e9d4f12', 'Skipped')
    case 'neutral':
      return translate('auto.components.editor.CheckRunDetailsPanel.5a1c8e3d67', 'Neutral')
    case 'pending':
      return translate('auto.components.editor.CheckRunDetailsPanel.3d9f2b8e14', 'Pending')
    default:
      return isFailureState(conclusion)
        ? translate('auto.components.editor.CheckRunDetailsPanel.4c8e1b2d73', 'Failed')
        : translate('auto.components.editor.CheckRunDetailsPanel.3d9f2b8e14', 'Pending')
  }
}

function isFailureState(state: string | null | undefined): boolean {
  return (
    state === 'failure' ||
    state === 'failed' ||
    state === 'action_required' ||
    state === 'cancelled' ||
    state === 'stale' ||
    state === 'startup_failure' ||
    state === 'timed_out'
  )
}

export function CheckRunDetailsPanel({
  check,
  details,
  loading,
  error,
  openUrl,
  worktreeId
}: {
  check: PRCheckDetail
  details: PRCheckRunDetails | null
  loading: boolean
  error: string | null
  openUrl: string | null | undefined
  worktreeId: string | null
}): React.JSX.Element {
  const startedAt = formatCheckTimestamp(details?.startedAt)
  const completedAt = formatCheckTimestamp(details?.completedAt)
  const detailsStatusCheck: CheckStatusLike = {
    ...check,
    status: details?.status ?? check.status,
    conclusion: details?.conclusion ?? check.conclusion
  }
  const failedJobs =
    details?.jobs.filter((job) => {
      const state = job.conclusion ?? job.status
      return isFailureState(state)
    }) ?? []
  const jobs = failedJobs.length > 0 ? failedJobs : (details?.jobs ?? [])
  const hasOutput = Boolean(details?.title || details?.summary || details?.text)
  const hasAnnotations = (details?.annotations.length ?? 0) > 0
  const hasJobs = jobs.length > 0
  const outputClipboardText = details ? formatCheckRunOutputForClipboard(details) : ''

  return (
    <div className="flex h-full min-h-0 flex-col bg-editor-surface">
      <div className="border-b border-border px-5 py-4">
        <div className="flex min-w-0 items-start gap-3">
          <h1 className="min-w-0 flex-1 truncate text-base font-medium text-foreground">
            {check.name}
          </h1>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span>
            {translate('auto.components.editor.CheckRunDetailsPanel.a54ae21c6f', 'Status:')}{' '}
            {details ? getCheckStatusLabel(detailsStatusCheck) : getCheckStatusLabel(check)}
          </span>
          {startedAt && (
            <span>
              {translate('auto.components.editor.CheckRunDetailsPanel.fd46a70f1a', 'Started')}{' '}
              {startedAt}
            </span>
          )}
          {completedAt && (
            <span>
              {translate('auto.components.editor.CheckRunDetailsPanel.00e1c1658a', 'Completed')}{' '}
              {completedAt}
            </span>
          )}
          {check.checkRunId && (
            <span className="font-mono">
              {translate('auto.components.editor.CheckRunDetailsPanel.aa8494ae3c', 'check #')}
              {check.checkRunId}
            </span>
          )}
          {check.workflowRunId && (
            <span className="font-mono">
              {translate('auto.components.editor.CheckRunDetailsPanel.2dd5ddabc4', 'workflow #')}
              {check.workflowRunId}
            </span>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 scrollbar-sleek">
        {loading ? (
          <div
            role="status"
            aria-live="polite"
            className="flex items-center gap-2 py-4 text-sm text-muted-foreground"
          >
            <LoaderCircle className="size-4 animate-spin" />
            {translate(
              'auto.components.editor.CheckRunDetailsPanel.1f2b980522',
              'Loading check details…'
            )}
          </div>
        ) : (
          <div className="grid gap-4">
            {error && (
              <div role="alert" className="min-w-0 break-words text-sm text-destructive">
                {error}
              </div>
            )}

            {hasOutput && (
              <section className="rounded-md border border-border bg-background">
                <div className="flex items-center justify-between border-b border-border px-3 py-2">
                  <div className="text-sm font-medium">
                    {translate('auto.components.editor.CheckRunDetailsPanel.d098e5529a', 'Output')}
                  </div>
                  <CheckRunCopyButton
                    text={outputClipboardText}
                    label={translate(
                      'auto.components.editor.CheckRunDetailsPanel.copyOutput',
                      'Copy output'
                    )}
                  />
                </div>
                <div className="px-3 py-3">
                  {details?.title && (
                    <div className="mb-2 text-sm font-medium text-foreground">{details.title}</div>
                  )}
                  {details?.summary && (
                    <CommentMarkdown
                      content={details.summary}
                      variant="document"
                      className="min-w-0 max-w-full overflow-hidden break-words text-sm leading-relaxed [&_a]:break-all [&_code]:break-words [&_pre]:max-w-full"
                    />
                  )}
                  {details?.text && (
                    <CommentMarkdown
                      content={details.text}
                      variant="document"
                      className="mt-3 min-w-0 max-w-full overflow-hidden break-words text-sm leading-relaxed [&_a]:break-all [&_code]:break-words [&_pre]:max-w-full"
                    />
                  )}
                </div>
              </section>
            )}

            {hasAnnotations && (
              <CheckRunAnnotations annotations={details!.annotations} worktreeId={worktreeId} />
            )}

            {hasJobs && <CheckRunJobs jobs={jobs} hasFailedJobs={failedJobs.length > 0} />}

            {!error && !hasOutput && !hasAnnotations && !hasJobs && (
              <div className="text-sm text-muted-foreground">
                {translate(
                  'auto.components.editor.CheckRunDetailsPanel.07eccfa397',
                  'No details are available for this check.'
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {openUrl && (
        <div className="flex justify-end border-t border-border px-5 py-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => window.api.shell.openUrl(openUrl)}
          >
            {translate('auto.components.editor.CheckRunDetailsPanel.a916648574', 'Open details')}
            <ExternalLink className="size-3.5" />
          </Button>
        </div>
      )}
    </div>
  )
}
