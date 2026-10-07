import { Eye, FileText, Loader2, X } from 'lucide-react'
import type {
  DiagnosticsBundlePayload,
  DiagnosticsStatusPayload
} from '../../../../preload/api-types'
import { Button } from '../ui/button'
import { translate } from '@/i18n/i18n'

export function PrivacyDiagnosticBundleControls({
  status,
  bundle,
  collecting,
  openingPreview,
  discarding,
  onCollect,
  onOpenPreview,
  onDiscard
}: {
  readonly status: DiagnosticsStatusPayload | null
  readonly bundle: DiagnosticsBundlePayload | null
  readonly collecting: boolean
  readonly openingPreview: boolean
  readonly discarding: boolean
  readonly onCollect: () => Promise<void>
  readonly onOpenPreview: () => Promise<void>
  readonly onDiscard: () => Promise<void>
}): React.JSX.Element {
  if (bundle) {
    return (
      <>
        <Button
          variant="outline"
          size="sm"
          disabled={openingPreview}
          onClick={() => void onOpenPreview()}
        >
          <ActionIcon busy={openingPreview} icon={<Eye className="size-3.5" />} />
          {translate(
            'auto.components.settings.PrivacyDiagnosticBundleControls.798b6f0be5',
            'Open review file'
          )}
        </Button>
        <Button variant="ghost" size="sm" disabled={discarding} onClick={() => void onDiscard()}>
          <ActionIcon busy={discarding} icon={<X className="size-3.5" />} />
          {translate(
            'auto.components.settings.PrivacyDiagnosticBundleControls.a5acaffdb6',
            'Discard'
          )}
        </Button>
      </>
    )
  }

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={!status?.bundleEnabled || collecting}
      onClick={() => void onCollect()}
    >
      <ActionIcon busy={collecting} icon={<FileText className="size-3.5" />} />
      {translate(
        'auto.components.settings.PrivacyDiagnosticBundleControls.dc8404a930',
        'Create diagnostic file'
      )}
    </Button>
  )
}

export function getDiagnosticBundleDescription({
  bundle,
  previewOpened
}: {
  readonly bundle: DiagnosticsBundlePayload | null
  readonly previewOpened: boolean
}): string {
  if (bundle) {
    const size = formatBytes(bundle.bytes)
    if (previewOpened) {
      return translate(
        'auto.components.settings.PrivacyDiagnosticBundleControls.acc0367609',
        'You opened the review file ({{value0}}). Keep it, or discard it.',
        { value0: size }
      )
    }
    return translate(
      'auto.components.settings.PrivacyDiagnosticBundleControls.f843e0e41a',
      'Your review file is ready ({{value0}}). Open it to see what was collected.',
      { value0: size }
    )
  }
  return translate(
    'auto.components.settings.PrivacyDiagnosticBundleControls.1605b02b28',
    'Collects recent app activity and errors into a redacted file you can review. It stays on this machine.'
  )
}

function ActionIcon({ busy, icon }: { readonly busy: boolean; readonly icon: React.ReactNode }) {
  return busy ? <Loader2 className="size-3.5 animate-spin" /> : icon
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`
  }
  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
