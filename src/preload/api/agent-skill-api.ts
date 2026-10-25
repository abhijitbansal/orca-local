import type { SkillDiscoveryResult, SkillDiscoveryTarget } from '../../shared/skills'
import type {
  SkillBundleInstallPreviewInput,
  SkillBundleInstallPreviewOperation,
  SkillInstallPreviewInput,
  SkillInstallPreviewOperation,
  ManagedSkillInstallListOperation,
  SkillRemoveInput,
  SkillRemoveOperation
} from '../../shared/skill-sharing-contract'
import type {
  BundledSkillExecuteRequest,
  BundledSkillInstallResult,
  BundledSkillPlan,
  BundledSkillPlanRequest
} from '../../shared/bundled-skill-plan'

import type {
  SkillDeletePlan,
  SkillDeleteRequest,
  SkillDeleteResult
} from '../../shared/skill-delete-contract'

export type SkillsApi = {
  discover: (target?: SkillDiscoveryTarget) => Promise<SkillDiscoveryResult>
  /** This machine's plan for Orca's installed skills; paired hosts plan over RPC. */
  bundledPlan: (request?: BundledSkillPlanRequest) => Promise<BundledSkillPlan>
  bundledExecute: (request: BundledSkillExecuteRequest) => Promise<BundledSkillInstallResult>
  previewInstall: (input: SkillInstallPreviewInput) => Promise<SkillInstallPreviewOperation>
  previewBundleInstall: (
    input: SkillBundleInstallPreviewInput
  ) => Promise<SkillBundleInstallPreviewOperation>
  removeInstall: (input: SkillRemoveInput) => Promise<SkillRemoveOperation>
  /** Always true on desktop; web clients may use a server predating skill deletion. */
  deleteSupported: () => Promise<boolean>
  previewDelete: (request: SkillDeleteRequest) => Promise<SkillDeletePlan>
  delete: (request: SkillDeleteRequest) => Promise<SkillDeleteResult>
  listManagedInstalls: (environmentId?: string) => Promise<ManagedSkillInstallListOperation>
  listWslDistros: (environmentId?: string) => Promise<string[]>
}
