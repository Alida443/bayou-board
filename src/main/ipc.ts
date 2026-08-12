import { app, BrowserWindow, ipcMain, shell } from 'electron'
import type { ManualSnapshotInput } from '../shared/types'
import { onData, snapshot } from './store'
import { restartScheduler } from './scheduler'
import * as service from './service'

function broadcast(): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send('event:data', snapshot())
  }
}

function subscribeToStore(): void {
  onData(() => broadcast())
}

export function registerIpc(): void {
  subscribeToStore()

  ipcMain.handle('data:get', () => snapshot())

  ipcMain.handle('friends:add', (_e, steamId: string, name?: string) => service.addFriend(steamId, name))
  ipcMain.handle('friends:remove', (_e, steamId: string) => service.removeFriend(steamId))
  ipcMain.handle('friends:rename', (_e, steamId: string, name: string) => service.renameFriend(steamId, name))
  ipcMain.handle('friends:setColor', (_e, steamId: string, color: string) =>
    service.setFriendColor(steamId, color)
  )

  ipcMain.handle('friends:refreshOne', (_e, steamId: string) => service.pollFriend(steamId))
  ipcMain.handle('friends:refreshAll', () => service.pollAll())

  ipcMain.handle('settings:update', (_e, patch) => {
    const result = service.updateSettings(patch)
    restartScheduler()
    return result
  })

  ipcMain.handle('snapshots:addManual', (_e, steamId: string, input: ManualSnapshotInput) =>
    service.addManualSnapshot(steamId, input)
  )
  ipcMain.handle('snapshots:clear', (_e, steamId: string) => service.clearFriendSnapshots(steamId))

  ipcMain.handle('demo:load', () => service.loadDemoData())
  ipcMain.handle('demo:clear', () => service.clearDemoData())

  ipcMain.handle('app:openDataFolder', async () => shell.openPath(app.getPath('userData')))
  ipcMain.handle('app:version', () => app.getVersion())

  ipcMain.handle('data:export', () => service.exportData())
  ipcMain.handle('data:import', () => service.importData())

  ipcMain.handle('app:getLoginItem', () => app.getLoginItemSettings().openAtLogin)
  ipcMain.handle('app:setLoginItem', (_e, open: boolean) => {
    app.setLoginItemSettings({ openAtLogin: open })
    return app.getLoginItemSettings().openAtLogin
  })
}
