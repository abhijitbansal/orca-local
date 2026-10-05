import { z } from 'zod'

export const RuntimeAccessEndpointSchema = z.object({
  id: z.string().min(1),
  kind: z.literal('websocket'),
  label: z.string().min(1),
  endpoint: z.string().min(1),
  deviceToken: z.string().min(1),
  publicKeyB64: z.string().min(1)
})

export const PublicRuntimeAccessEndpointSchema = RuntimeAccessEndpointSchema.omit({
  deviceToken: true,
  publicKeyB64: true
})

export type PublicRuntimeAccessEndpoint = z.infer<typeof PublicRuntimeAccessEndpointSchema>

export const RuntimeEnvironmentSourceSchema = z.enum(['manual', 'ephemeral-vm'])
export type RuntimeEnvironmentSource = z.infer<typeof RuntimeEnvironmentSourceSchema>

export const KnownRuntimeEnvironmentSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  createdAt: z.number().finite(),
  updatedAt: z.number().finite(),
  pairingRevision: z.number().finite().optional(),
  pairedDeviceId: z.string().min(1).optional(),
  lastUsedAt: z.number().finite().nullable(),
  runtimeId: z.string().min(1).nullable(),
  source: RuntimeEnvironmentSourceSchema.optional(),
  connectionDependency: z.literal('ssh-tunnel').optional(),
  endpoints: z.array(RuntimeAccessEndpointSchema).min(1),
  preferredEndpointId: z.string().min(1)
})

export type KnownRuntimeEnvironment = z.infer<typeof KnownRuntimeEnvironmentSchema>

export type PublicKnownRuntimeEnvironment = Omit<KnownRuntimeEnvironment, 'endpoints'> & {
  endpoints: PublicRuntimeAccessEndpoint[]
}

export function redactRuntimeEnvironment(
  environment: KnownRuntimeEnvironment
): PublicKnownRuntimeEnvironment {
  return {
    ...environment,
    endpoints: environment.endpoints.map(
      ({ deviceToken: _deviceToken, publicKeyB64: _key, ...rest }) => rest
    )
  }
}

export const RuntimeEnvironmentStoreSchema = z.object({
  version: z.literal(1),
  environments: z.array(KnownRuntimeEnvironmentSchema)
})

export type RuntimeEnvironmentStore = z.infer<typeof RuntimeEnvironmentStoreSchema>

export function isEphemeralVmRuntimeEnvironment(
  environment: Pick<PublicKnownRuntimeEnvironment, 'source'>
): boolean {
  return environment.source === 'ephemeral-vm'
}

export function isUserManagedRuntimeEnvironment(
  environment: Pick<PublicKnownRuntimeEnvironment, 'source'>
): boolean {
  return !isEphemeralVmRuntimeEnvironment(environment)
}
