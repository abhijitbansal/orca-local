import { z } from 'zod'
import { requiredString } from './rpc-param-primitives'

export const RepoSelector = z.object({
  repo: requiredString('Missing repo selector')
})
