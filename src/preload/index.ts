import { contextBridge, ipcRenderer } from 'electron'
import type {
  AppData,
  Friend,
  ManualSnapshotInput,
  PollStatus,
  Settings
} from '../shared/types'

const api = {
  getData: (): Promise<AppData> => ipcRenderer.invoke('data:get'),

  addFriend: (steamId: string, name?: string): Promise<{ ok: boolean; error?: string; friend?: Friend }> =>
    ipcRenderer.invoke('friends:add', steamId, name),
  removeFriend: (steamId: string): Promise<void> => ipcRenderer.invoke('friends:remove', steamId),
  renameFriend: (steamId: string, name: string): Promise<void> =>
    ipcRenderer.invoke('friends:rename', steamId, name),
  setFriendColor: (steamId: string, color: string): Promise<void> =>
    ipcRenderer.invoke('friends:setColor', steamId, color),

  refreshOne: (steamId: string): Promise<{ ok: boolean; found: boolean; message: string }> =>
    ipcRenderer.invoke('friends:refreshOne', steamId),
  refreshAll: (): Promise<void> => ipcRenderer.invoke('friends:refreshAll'),

  updateSettings: (patch: Partial<Settings>): Promise<AppData> =>
    ipcRenderer.invoke('settings:update', patch),
  addManualSnapshot: (steamId: string, input: ManualSnapshotInput): Promise<{ ok: boolean; error?: string }> =>
    ipcRenderer.invoke('snapshots:addManual', steamId, input),
  clearFriendSnapshots: (steamId: string): Promise<void> =>
    ipcRenderer.invoke('snapshots:clear', steamId),

  loadDemo: (): Promise<AppData> => ipcRenderer.invoke('demo:load'),
  clearDemo: (): Promise<AppData> => ipcRenderer.invoke('demo:clear'),

  openDataFolder: (): Promise<string> => ipcRenderer.invoke('app:openDataFolder'),

  getVersion: (): Promise<string> => ipcRenderer.invoke('app:version'),

  exportData: (): Promise<{ ok: boolean; canceled?: boolean; error?: string; path?: string }> =>
    ipcRenderer.invoke('data:export'),
  importData: (): Promise<{ ok: boolean; canceled?: boolean; error?: string; count?: { friends: number; snapshots: number } }> =>
    ipcRenderer.invoke('data:import'),

  getLoginItem: (): Promise<boolean> => ipcRenderer.invoke('app:getLoginItem'),
  setLoginItem: (open: boolean): Promise<boolean> => ipcRenderer.invoke('app:setLoginItem', open),

  onData: (cb: (data: AppData) => void): (() => void) => {
    const listener = (_e: unknown, data: AppData): void => cb(data)
    ipcRenderer.on('event:data', listener)
    return () => {
      ipcRenderer.removeListener('event:data', listener)
    }
  },

  onPoll: (cb: (status: PollStatus) => void): (() => void) => {
    const listener = (_e: unknown, data: AppData): void => {
      if (data.settings.pollStatus) cb(data.settings.pollStatus)
    }
    ipcRenderer.on('event:data', listener)
    return () => {
      ipcRenderer.removeListener('event:data', listener)
    }
  }
}

export type Api = typeof api

contextBridge.exposeInMainWorld('api', api)
