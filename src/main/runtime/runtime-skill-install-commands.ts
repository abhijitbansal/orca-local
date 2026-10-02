import type { RuntimeSkillCommandHost } from './runtime-skill-command-surface'
import {
  createSkillInstallAuthority,
  folderExecutionHostId,
  resolveSkillProviderRoots
} from './runtime-skill-install-authority'

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
}
