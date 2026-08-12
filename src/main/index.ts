import { app, BrowserWindow, Menu, Tray, shell } from 'electron'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import { registerIpc } from './ipc'
import { restartScheduler } from './scheduler'
import { load } from './store'
import { loadDemoData } from './service'

let mainWin: BrowserWindow | null = null
let tray: Tray | null = null
let quitting = false

async function captureScreenshot(win: BrowserWindow): Promise<void> {
  try {
    const image = await win.webContents.capturePage()
    const dir = process.env['BAYOU_BOARD_CAPTURE_DIR'] ?? join(process.cwd(), 'screenshots')
    const name = process.env['BAYOU_BOARD_CAPTURE_NAME'] ?? 'shot'
    await fs.mkdir(dir, { recursive: true })
    const out = join(dir, `${name}.png`)
    await fs.writeFile(out, image.toPNG())
    console.log(`[bayou-board] capture saved: ${out}`)
  } catch (err) {
    console.error('[bayou-board] capture failed:', err)
  } finally {
    app.quit()
  }
}

function createWindow(): void {
  const capture = Boolean(process.env['BAYOU_BOARD_CAPTURE'])
  const win = new BrowserWindow({
    width: capture ? 1440 : 1360,
    height: capture ? 900 : 880,
    minWidth: 1020,
    minHeight: 660,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#0e0f11',
    title: 'Bayou Board',
    icon: join(__dirname, '../../build/hunt-logo.ico'),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: false
    }
  })
  mainWin = win

  win.on('ready-to-show', () => win.show())
  win.on('close', (e) => {
    if (!quitting) {
      e.preventDefault()
      win.hide()
      if (tray) {
        tray.displayBalloon({
          title: 'Bayou Board',
          content: 'Still tracking in the tray. Click the icon to reopen.'
        })
      }
    }
  })
  win.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    void win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    const view = process.env['BAYOU_BOARD_CAPTURE_VIEW']
    void win.loadFile(join(__dirname, '../renderer/index.html'), view ? { hash: view } : undefined)
  }
}

function createTray(): void {
  tray = new Tray(join(__dirname, '../../build/hunt-logo.ico'))
  tray.setToolTip('Bayou Board')
  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: 'Show Bayou Board',
        click: () => {
          mainWin?.show()
          mainWin?.focus()
        }
      },
      {
        label: 'Quit',
        click: () => {
          quitting = true
          app.quit()
        }
      }
    ])
  )
  tray.on('click', () => {
    mainWin?.show()
    mainWin?.focus()
  })
}

app.whenReady().then(() => {
  if (process.env['BAYOU_BOARD_CAPTURE']) {
    app.setPath('userData', join(app.getPath('temp'), 'bayou-board-screenshots'))
  }
  load()
  registerIpc()
  createWindow()
  createTray()
  restartScheduler()

  if (process.env['BAYOU_BOARD_CAPTURE']) {
    if (load().friends.length === 0) loadDemoData()
    const win = mainWin
    if (win) {
      setTimeout(() => {
        void captureScreenshot(win)
      }, 2000)
    }
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('before-quit', () => {
  quitting = true
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin' && !tray) app.quit()
})
