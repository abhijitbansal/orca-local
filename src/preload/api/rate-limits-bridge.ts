import { ipcRenderer } from 'electron'
import type { RateLimitRuntimeTarget, RateLimitState } from '../../shared/rate-limit-types'
import type { PreloadApi } from '../api-types'

export const rateLimitsApi = {
  get: (): Promise<RateLimitState> => ipcRenderer.invoke('rateLimits:get'),
  refreshCodexForTarget: (target: RateLimitRuntimeTarget): Promise<RateLimitState> =>
    ipcRenderer.invoke('rateLimits:refreshCodexForTarget', target),
  refreshClaudeForTarget: (target: RateLimitRuntimeTarget): Promise<RateLimitState> =>
    ipcRenderer.invoke('rateLimits:refreshClaudeForTarget', target),
  onUpdate: (callback: (state: RateLimitState) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, state: RateLimitState) => callback(state)
    ipcRenderer.on('rateLimits:update', listener)
    return () => ipcRenderer.removeListener('rateLimits:update', listener)
  }
} satisfies PreloadApi['rateLimits']
