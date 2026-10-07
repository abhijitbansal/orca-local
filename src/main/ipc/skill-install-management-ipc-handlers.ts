import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { SkillBundleInstallPreviewRequestSchema } from '../../shared/skill-bundle-install-contract'
import {
  SkillInstallDestinationSchema,
  SkillPackageIdentitySchema
} from '../../shared/skill-install-contract'
import type { OrcaRuntimeService } from '../runtime/orca-runtime'
import { listWslDistrosAsync } from '../wsl'
import { handleMainWindowSkillIpc } from './skill-ipc-main-window'

const environmentIdSchema = z.string().min(1).max(128)
const skillNameSchema = z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/)
const installPreviewSchema = z
  .object({
    environmentId: environmentIdSchema.optional(),
    package: SkillPackageIdentitySchema,
    name: skillNameSchema,
    destination: SkillInstallDestinationSchema
  })
  .strict()
const removeSchema = z
  .object({
    environmentId: environmentIdSchema.optional(),
    name: skillNameSchema,
    destination: SkillInstallDestinationSchema,
    conflictResolution: z.enum(['replace-and-discard-local', 'cancel']).optional()
  })
  .strict()

// Why: a skill install on a paired Orca server needs a connection this build can never open.
function assertNoRemoteEnvironment(environmentId: string | undefined): void {
  if (environmentId) {
    throw new Error('skill-install-remote-unsupported')
  }
}

export function registerSkillInstallManagementIpcHandlers(runtime: OrcaRuntimeService): void {
  handleMainWindowSkillIpc('skills:listWslDistros', async (_event, environmentIdValue: unknown) => {
    assertNoRemoteEnvironment(environmentIdSchema.optional().parse(environmentIdValue))
    return listWslDistrosAsync()
  })
  handleMainWindowSkillIpc('skills:previewInstall', async (_event, value: unknown) => {
    const input = installPreviewSchema.parse(value)
    assertNoRemoteEnvironment(input.environmentId)
    const request = { package: input.package, name: input.name, destination: input.destination }
    return {
      status: 'ok' as const,
      value: await runtime.previewSharedSkillInstallRequest(request)
    }
  })
  handleMainWindowSkillIpc('skills:previewBundleInstall', async (_event, value: unknown) => {
    const parsed = z
      .object({
        environmentId: environmentIdSchema.optional(),
        package: SkillBundleInstallPreviewRequestSchema.shape.package,
        selectedSkills: SkillBundleInstallPreviewRequestSchema.shape.selectedSkills,
        destination: SkillInstallDestinationSchema
      })
      .strict()
      .parse(value)
    assertNoRemoteEnvironment(parsed.environmentId)
    return {
      status: 'ok' as const,
      value: await runtime.previewSharedSkillBundleInstallRequest(parsed)
    }
  })
  handleMainWindowSkillIpc('skills:removeInstall', async (_event, value: unknown) => {
    const input = removeSchema.parse(value)
    assertNoRemoteEnvironment(input.environmentId)
    const request = {
      operationId: randomUUID(),
      name: input.name,
      destination: input.destination,
      conflictResolution: input.conflictResolution
    }
    return {
      status: 'ok' as const,
      value: await runtime.removeSharedSkillInstallRequest(request)
    }
  })
  handleMainWindowSkillIpc(
    'skills:listManagedInstalls',
    async (_event, environmentIdValue: unknown) => {
      assertNoRemoteEnvironment(environmentIdSchema.optional().parse(environmentIdValue))
      return { status: 'ok' as const, value: await runtime.listManagedSkillInstalls() }
    }
  )
}
