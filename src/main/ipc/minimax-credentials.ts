import { ipcMain } from 'electron'
import {
  clearMiniMaxSessionCookie,
  getMiniMaxSessionCookieProtection,
  hasMiniMaxSessionCookie,
  saveMiniMaxSessionCookie
} from '../minimax/minimax-cookie-store'
import {
  clearMiniMaxApiKey,
  getMiniMaxApiKeyProtection,
  hasMiniMaxApiKey,
  saveMiniMaxApiKey
} from '../minimax/minimax-api-key-store'
import type { SecretAtRestProtection } from '../../shared/secret-at-rest-protection'

export type MiniMaxCredentialsStatus = {
  configured: boolean
  cookieConfigured: boolean
  apiKeyConfigured: boolean
  /** How each stored credential sits on disk, so Settings can warn when it is unsealed. */
  cookieProtection: SecretAtRestProtection | null
  apiKeyProtection: SecretAtRestProtection | null
}

function getMiniMaxCredentialsStatus(): MiniMaxCredentialsStatus {
  const cookieConfigured = hasMiniMaxSessionCookie()
  const apiKeyConfigured = hasMiniMaxApiKey()
  return {
    configured: cookieConfigured || apiKeyConfigured,
    cookieConfigured,
    apiKeyConfigured,
    cookieProtection: cookieConfigured ? getMiniMaxSessionCookieProtection() : null,
    apiKeyProtection: apiKeyConfigured ? getMiniMaxApiKeyProtection() : null
  }
}

export function registerMiniMaxCredentialsHandlers(): void {
  ipcMain.handle('minimaxCredentials:getStatus', () => getMiniMaxCredentialsStatus())
  ipcMain.handle('minimaxCredentials:saveCookie', (_event, cookie: string) => {
    // Validate the IPC argument in the main process; the renderer-declared type
    // is compile-time only and the value arrives as unknown over IPC.
    if (typeof cookie !== 'string') {
      throw new Error('MiniMax session cookie must be a string')
    }
    saveMiniMaxSessionCookie(cookie)
    return getMiniMaxCredentialsStatus()
  })
  ipcMain.handle('minimaxCredentials:clearCookie', () => {
    clearMiniMaxSessionCookie()
    return getMiniMaxCredentialsStatus()
  })
  ipcMain.handle('minimaxCredentials:saveApiKey', (_event, key: string) => {
    if (typeof key !== 'string') {
      throw new Error('MiniMax API key must be a string')
    }
    saveMiniMaxApiKey(key)
    return getMiniMaxCredentialsStatus()
  })
  ipcMain.handle('minimaxCredentials:clearApiKey', () => {
    clearMiniMaxApiKey()
    return getMiniMaxCredentialsStatus()
  })
}
