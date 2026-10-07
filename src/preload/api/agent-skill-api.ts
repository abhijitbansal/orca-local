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
import type { SkillFreshnessInventory } from '../../shared/skill-freshness'

import type {
  SkillDeletePlan,
  SkillDeleteRequest,
  SkillDeleteResult
} from '../../shared/skill-delete-contract'

export type SkillsApi = {
  discover: (target?: SkillDiscoveryTarget) => Promise<SkillDiscoveryResult>
  freshnessInventory: () => Promise<SkillFreshnessInventory>
  previewInstall: (input: SkillInstallPreviewInput) => Promise<SkillInstallPreviewOperation>
  previewBundleInstall: (
    input: SkillBundleInstallPreviewInput
  ) => Promise<SkillBundleInstallPreviewOperation>
  removeInstall: (input: SkillRemoveInput) => Promise<SkillRemoveOperation>
  /** Whether the host answering `previewDelete`/`delete` supports them. Always
   *  true on desktop; on web the "local" host is a remote server that updates
   *  independently and may predate the capability. */
  deleteSupported: () => Promise<boolean>
  previewDelete: (request: SkillDeleteRequest) => Promise<SkillDeletePlan>
  delete: (request: SkillDeleteRequest) => Promise<SkillDeleteResult>
  listManagedInstalls: (environmentId?: string) => Promise<ManagedSkillInstallListOperation>
  listWslDistros: (environmentId?: string) => Promise<string[]>
}
