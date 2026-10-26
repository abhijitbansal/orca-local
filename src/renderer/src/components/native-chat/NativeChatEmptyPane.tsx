import type { AgentType } from '../../../../shared/agent-status-types'
import { NativeChatEmptyState } from './NativeChatEmptyState'

/** The pane of a chat with no messages: the Start-a-chat copy. */
export function NativeChatEmptyPane(props: { agent: AgentType }): React.JSX.Element {
  return <NativeChatEmptyState kind="empty" agent={props.agent} />
}
