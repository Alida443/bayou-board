import { app } from 'electron'
import { readFileSync } from 'node:fs'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import type { AppData } from '../shared/types'
import { PALETTE } from '../shared/types'

let cache: AppData | null = null
let saveTimer: ReturnType<typeof setTimeout> | null = null

export type DataListener = (data: AppData) => void
const listeners = new Set<DataListener>()

export function onData(fn: DataListener): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

export function emitData(): void {
  const data = snapshot()
  for (const fn of listeners) fn(data)
}

const DEFAULTS: AppData = {
  friends: [],
  snapshots: [],
  settings: {
    refreshMinutes: 30,
    autoRefresh: true,
    mmrAlertThreshold: 0
  }
}

function filePath(): string {
  return join(app.getPath('userData'), 'data.json')
}

export function load(): AppData {
  if (cache) return cache
  let parsed: Partial<AppData> = {}
  try {
    const raw = readFileSync(filePath(), 'utf-8')
    parsed = JSON.parse(raw) as Partial<AppData>
  } catch {
    parsed = {}
  }
  cache = {
    friends: Array.isArray(parsed.friends) ? parsed.friends : [],
    snapshots: Array.isArray(parsed.snapshots) ? parsed.snapshots : [],
    settings: { ...DEFAULTS.settings, ...(parsed.settings ?? {}) }
  }
  return cache
}

export function persist(): void {
  if (!cache) return
  if (saveTimer) {
    clearTimeout(saveTimer)
    saveTimer = null
  }
  const write = async (): Promise<void> => {
    try {
      await fs.mkdir(app.getPath('userData'), { recursive: true })
      const tmp = filePath() + '.tmp'
      await fs.writeFile(tmp, JSON.stringify(cache, null, 2), 'utf-8')
      await fs.rename(tmp, filePath())
    } catch (err) {
      console.error('[bayou-board] failed to persist data:', err)
    }
  }
  saveTimer = setTimeout(() => {
    void write()
  }, 250)
}

export function mutate(fn: (d: AppData) => void): AppData {
  const d = load()
  fn(d)
  persist()
  emitData()
  return d
}

export function snapshot(): AppData {
  return JSON.parse(JSON.stringify(load())) as AppData
}

export function nextColor(existing: string[]): string {
  const used = new Set(existing)
  const free = PALETTE.find((c) => !used.has(c))
  return free ?? PALETTE[Math.floor(Math.random() * PALETTE.length)]
}
