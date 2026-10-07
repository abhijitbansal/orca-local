import {
  findKilledPlugin,
  type PluginKillList,
  type PluginKillListEntry
} from '../../shared/plugins/plugin-kill-list'
import { PluginKillListStore } from './plugin-kill-list-store'

export class PluginKillListService {
  private readonly store: PluginKillListStore
  private currentList: PluginKillList | null = null
  private loadPromise: Promise<void> | null = null

  constructor(options: { pluginsDataDir: string; store?: PluginKillListStore }) {
    this.store = options.store ?? new PluginKillListStore(options.pluginsDataDir)
  }

  async initialize(): Promise<void> {
    this.loadPromise ??= this.store
      .read()
      .then((killList) => {
        this.currentList = killList
      })
      .catch((error) => {
        // Why: an unusable cache must not prevent Orca from starting.
        console.warn('[plugins] ignoring invalid cached plugin safety list:', error)
        this.currentList = null
      })
    await this.loadPromise
  }

  find(pluginKey: string): PluginKillListEntry | null {
    return this.currentList ? findKilledPlugin(this.currentList, pluginKey) : null
  }

  reason(pluginKey: string): string | null {
    return this.find(pluginKey)?.reason ?? null
  }

  snapshot(): PluginKillList | null {
    return this.currentList
  }
}
