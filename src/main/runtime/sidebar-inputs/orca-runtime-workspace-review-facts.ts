import { OrcaRuntimeWithWorkspaceActivityFacts } from './orca-runtime-workspace-activity-facts'

// Review (PR) facts need a provider API; the local-only build publishes none.
export abstract class OrcaRuntimeWithWorkspaceReviewFacts extends OrcaRuntimeWithWorkspaceActivityFacts {}
