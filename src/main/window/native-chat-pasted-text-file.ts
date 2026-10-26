// Pasted text uses the execution host's ordinary attachment store so sends claim it with the chat.
import { randomUUID } from 'node:crypto'
import {
  agentSessionPastedTextName,
  type AgentSessionAttachmentClipboardTarget
} from '../../shared/agent-session-attachments'
import { assertClipboardTextWithinLimit } from '../../shared/clipboard-text'
import type { AgentSessionAttachmentStore } from '../native-chat/agent-session-attachments/agent-session-attachment-store'

export type SavePastedTextAsFileArgs = {
  text: string
  /** With `agentSessionAttachment`: the paired server whose chat stores the file. */
  runtimeEnvironmentId?: string | null
  agentSessionAttachment?: AgentSessionAttachmentClipboardTarget
}

export async function savePastedTextAsFile(
  args: SavePastedTextAsFileArgs,
  localStore?: () => Promise<AgentSessionAttachmentStore | null>
): Promise<string> {
  if (typeof args?.text !== 'string') {
    throw new Error('Pasted text is missing.')
  }
  assertClipboardTextWithinLimit(args.text)
  const buffer = Buffer.from(args.text, 'utf8')
  const name = agentSessionPastedTextName(Date.now(), randomUUID())
  const runtimeEnvironmentId = args.runtimeEnvironmentId?.trim()
  if (runtimeEnvironmentId && args.agentSessionAttachment) {
    throw new Error('unsupported_in_local_build: remote Orca runtimes were removed from this build')
  }
  const store = await localStore?.()
  if (!store) {
    throw new Error('The chat attachment store is not ready.')
  }
  return store.storeFile(name, buffer)
}
