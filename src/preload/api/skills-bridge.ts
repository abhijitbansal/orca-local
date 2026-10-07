import { ipcRenderer } from 'electron'
import type {
  SkillDeletePlan,
  SkillDeleteRequest,
  SkillDeleteResult
} from '../../shared/skill-delete-contract'
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
import type { PreloadApi } from '../api-types'

export const skillsApi = {
  discover: (target?: SkillDiscoveryTarget): Promise<SkillDiscoveryResult> =>
    ipcRenderer.invoke('skills:discover', target),
  freshnessInventory: (): Promise<SkillFreshnessInventory> =>
    ipcRenderer.invoke('skills:freshnessInventory'),
  previewInstall: (input: SkillInstallPreviewInput): Promise<SkillInstallPreviewOperation> =>
    ipcRenderer.invoke('skills:previewInstall', input),
  previewBundleInstall: (
    input: SkillBundleInstallPreviewInput
  ): Promise<SkillBundleInstallPreviewOperation> =>
    ipcRenderer.invoke('skills:previewBundleInstall', input),
  removeInstall: (input: SkillRemoveInput): Promise<SkillRemoveOperation> =>
    ipcRenderer.invoke('skills:removeInstall', input),
  // Desktop always registers the delete IPC handlers in its own main process.
  deleteSupported: (): Promise<boolean> => Promise.resolve(true),
  previewDelete: (request: SkillDeleteRequest): Promise<SkillDeletePlan> =>
    ipcRenderer.invoke('skills:previewDelete', request),
  delete: (request: SkillDeleteRequest): Promise<SkillDeleteResult> =>
    ipcRenderer.invoke('skills:delete', request),
  listManagedInstalls: (environmentId?: string): Promise<ManagedSkillInstallListOperation> =>
    ipcRenderer.invoke('skills:listManagedInstalls', environmentId),
  listWslDistros: (environmentId?: string): Promise<string[]> =>
    ipcRenderer.invoke('skills:listWslDistros', environmentId)
} satisfies PreloadApi['skills']
