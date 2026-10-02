import { ipcRenderer } from 'electron'
import type { PreloadApi } from '../api-types'

export const developerPermissionsApi = {
  getStatus: () => ipcRenderer.invoke('developerPermissions:getStatus'),
  request: (args: { id: string }) => ipcRenderer.invoke('developerPermissions:request', args),
  openSettings: (args: { id: string }): Promise<void> =>
    ipcRenderer.invoke('developerPermissions:openSettings', args)
} satisfies PreloadApi['developerPermissions']
