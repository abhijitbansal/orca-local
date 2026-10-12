import type { OrcaRuntimeService } from '../../../../orca-runtime'
import { isTuiAgent } from '../../../../../../shared/tui-agent-config'
import { OrchestrationError } from '../../../../orchestration/orchestration-error'

type WorkerAgentTarget = { repo?: string; worktree?: string }

export async function resolveWorkerConfiguredAgentParams<T extends { agent?: string }>(
  runtime: OrcaRuntimeService,
  params: T,
  resolveTarget: () => Promise<WorkerAgentTarget>
): Promise<T> {
  if (!params.agent || isTuiAgent(params.agent)) {
    return params
  }
  const agent = await runtime.resolveOrchestrationAgentLauncherForTarget(
    params.agent,
    await resolveTarget()
  )
  if (!agent) {
    throw new OrchestrationError(
      'agent_unconfigured',
      'A configured single-executable agent alias is required.'
    )
  }
  return { ...params, agent }
}
