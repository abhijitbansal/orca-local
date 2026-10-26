import { translate } from '@/i18n/i18n'
import type { NativeChatComposerNotice } from './native-chat-composer-notice'
import type { NativeChatHostOutage } from './use-native-chat-host-outage'

// Why: no reconnect action — explicit remote-host connect is removed in this build.
export function useNativeChatHostOutageNotice(
  outage: NativeChatHostOutage | null
): NativeChatComposerNotice | null {
  if (!outage) {
    return null
  }
  const offline = outage.kind === 'offline'
  return {
    key: 'host-outage',
    kind: 'host',
    tone: offline ? 'warning' : 'muted',
    text: offline
      ? translate('components.native-chat.hostOutage.offline', '{{hostName}} is offline', {
          hostName: outage.hostLabel
        })
      : translate(
          'components.native-chat.hostOutage.reconnecting',
          '{{hostName}} is reconnecting…',
          {
            hostName: outage.hostLabel
          }
        )
  }
}
