import type { RuntimeSkillCommandHost } from './runtime-skill-command-surface'
import type {
  BundledSkillExecuteRequest,
  BundledSkillInstallResult,
  BundledSkillPlan,
  BundledSkillPlanRequest
} from '../../shared/bundled-skill-plan'
import { executeLocalBundledSkills, planLocalBundledSkills } from './runtime-bundled-skill-install'
import {
  createSkillInstallAuthority,
  folderExecutionHostId,
  resolveSkillProviderRoots
} from './runtime-skill-install-authority'

export const SKILL_SSH_UNAVAILABLE = 'skill-install-ssh-relay-unavailable'

export class RuntimeSkillInstallCommands {
  constructor(protected readonly host: RuntimeSkillCommandHost) {}

  protected userDataPath(): string {
    return this.host.getUserDataPath()
  }
  protected roots(destination: Parameters<typeof resolveSkillProviderRoots>[1]) {
    return resolveSkillProviderRoots(this.host, destination)
  }
  protected authority() {
    return createSkillInstallAuthority(this.host)
  }
  protected folderExecutionHostId(folder: Parameters<typeof folderExecutionHostId>[0]) {
    return folderExecutionHostId(folder)
  }
  planLocalBundledSkills(request: BundledSkillPlanRequest): Promise<BundledSkillPlan> {
    return planLocalBundledSkills(this.host, request)
  }
  executeLocalBundledSkills(
    request: BundledSkillExecuteRequest
  ): Promise<BundledSkillInstallResult> {
    return executeLocalBundledSkills(this.host, request)
  }
}
