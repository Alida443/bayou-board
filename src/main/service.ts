import { app, dialog, Notification } from 'electron'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import type { AppData, Friend, ManualSnapshotInput, PlayerSnapshot } from '../shared/types'
import { VALID_STEAM_ID } from '../shared/types'
import { load, mutate, nextColor, persist, snapshot } from './store'
import bayouLedgerProvider from './providers/bayouLedger'
import { generateDemoData } from './providers/sample'

export interface AddFriendResult {
  ok: boolean
  error?: string
  friend?: Friend
}

export function listFriends(): Friend[] {
  return load().friends
}

export function addFriend(steamIdRaw: string, nameRaw?: string): AddFriendResult {
  const steamId = steamIdRaw.trim()
  if (!VALID_STEAM_ID.test(steamId)) {
    return { ok: false, error: 'Steam IDs are 15-17 digits, e.g. 76561198034167345.' }
  }
  const existing = load().friends.find((f) => f.steamId === steamId)
  if (existing) return { ok: false, error: `"${existing.name}" is already on the board.` }

  const friend: Friend = {
    steamId,
    name: nameRaw?.trim() || steamId,
    color: nextColor(load().friends.map((f) => f.color)),
    addedAt: new Date().toISOString()
  }
  mutate((d) => d.friends.push(friend))

  // Fire the first fetch in the background.
  void pollFriend(friend.steamId)
  return { ok: true, friend }
}

export function removeFriend(steamId: string): void {
  mutate((d) => {
    d.friends = d.friends.filter((f) => f.steamId !== steamId)
    d.snapshots = d.snapshots.filter((s) => s.steamId !== steamId)
  })
}

export function renameFriend(steamId: string, name: string): void {
  const trimmed = name.trim()
  if (!trimmed) return
  mutate((d) => {
    const f = d.friends.find((x) => x.steamId === steamId)
    if (f) f.name = trimmed
  })
}

export function setFriendColor(steamId: string, color: string): void {
  const c = color.trim().toLowerCase()
  if (!/^#[0-9a-f]{6}$/.test(c)) return
  mutate((d) => {
    const f = d.friends.find((x) => x.steamId === steamId)
    if (f) f.color = c
  })
}

export function clearFriendSnapshots(steamId: string): void {
  mutate((d) => {
    d.snapshots = d.snapshots.filter((s) => s.steamId !== steamId)
  })
}

function sameStats(a: PlayerSnapshot, b: PlayerSnapshot): boolean {
  if (a.lastStatChangeAt && b.lastStatChangeAt) return a.lastStatChangeAt === b.lastStatChangeAt
  return (
    a.mmr === b.mmr &&
    a.kd === b.kd &&
    a.kills === b.kills &&
    a.deaths === b.deaths &&
    a.bounty === b.bounty &&
    a.banishes === b.banishes
  )
}

export function ingestSnapshot(snap: PlayerSnapshot): boolean {
  const d = load()
  const last = [...d.snapshots].reverse().find((s) => s.steamId === snap.steamId)
  if (last && sameStats(last, snap)) return false
  mutate((data) => data.snapshots.push(snap))
  return true
}

function applyFriendFetchResult(steamId: string, autoName?: string, error?: string): void {
  mutate((d) => {
    const f = d.friends.find((x) => x.steamId === steamId)
    if (!f) return
    f.lastFetchedAt = new Date().toISOString()
    if (error) {
      f.lastError = error
    } else {
      delete f.lastError
    }
    if (autoName && autoName !== f.autoName) {
      f.autoName = autoName
    }
  })
}

export async function pollFriend(steamId: string): Promise<{ ok: boolean; found: boolean; message: string }> {
  const friend = load().friends.find((f) => f.steamId === steamId)
  if (!friend) return { ok: false, found: false, message: 'Friend not found.' }
  if (friend.demo) return { ok: false, found: false, message: 'Demo friends have sample data only.' }

  setPolling()
  const previous = [...load().snapshots].reverse().find((s) => s.steamId === steamId)
  const result = await bayouLedgerProvider.fetchPlayer(steamId)
  applyFriendFetchResult(steamId, result.autoName, result.error)

  if (!result.ok) {
    const message = `Could not fetch "${friend.name}": ${result.error}`
    setPollError(message)
    return { ok: false, found: false, message }
  }
  if (!result.found || !result.snapshot) {
    const message = `"${friend.name}" ${result.error ?? 'has no stats on the Bayou Ledger.'}`
    setPollError(message)
    return { ok: false, found: false, message }
  }

  const ingested = ingestSnapshot(result.snapshot)
  if (ingested) maybeNotifyMmrJump(friend.name, previous, result.snapshot)
  const message = ingested
    ? `Updated "${friend.name}" - new stats recorded.`
    : `Checked "${friend.name}" - stats unchanged.`
  setPollDone()
  return { ok: true, found: true, message }
}

function maybeNotifyMmrJump(name: string, previous: PlayerSnapshot | undefined, next: PlayerSnapshot): void {
  const threshold = load().settings.mmrAlertThreshold
  if (!threshold || threshold <= 0) return
  if (previous?.mmr === undefined || next.mmr === undefined) return
  const diff = next.mmr - previous.mmr
  if (Math.abs(diff) < threshold) return
  const sign = diff > 0 ? '+' : ''
  const notif = new Notification({
    title: 'MMR change',
    body: `"${name}" went ${previous.mmr} → ${next.mmr} (${sign}${diff})`
  })
  notif.show()
}

export interface ExportResult {
  ok: boolean
  canceled?: boolean
  error?: string
  path?: string
}

export async function exportData(): Promise<ExportResult> {
  const res = await dialog.showSaveDialog({
    title: 'Export Bayou Board data',
    defaultPath: join(app.getPath('documents'), 'bayou-board-backup.json'),
    filters: [{ name: 'JSON', extensions: ['json'] }]
  })
  if (res.canceled || !res.filePath) return { ok: false, canceled: true }
  try {
    await fs.writeFile(res.filePath, JSON.stringify(snapshot(), null, 2), 'utf-8')
    return { ok: true, path: res.filePath }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
}

export interface ImportResult {
  ok: boolean
  canceled?: boolean
  error?: string
  count?: { friends: number; snapshots: number }
}

export async function importData(): Promise<ImportResult> {
  const res = await dialog.showOpenDialog({
    title: 'Import Bayou Board data',
    filters: [{ name: 'JSON', extensions: ['json'] }],
    properties: ['openFile']
  })
  if (res.canceled || res.filePaths.length === 0) return { ok: false, canceled: true }
  try {
    const raw = await fs.readFile(res.filePaths[0], 'utf-8')
    const parsed = JSON.parse(raw) as Partial<AppData>
    if (!Array.isArray(parsed.friends) || !Array.isArray(parsed.snapshots) || !parsed.settings) {
      return { ok: false, error: 'Not a valid Bayou Board backup file.' }
    }
    const friends = parsed.friends.filter(
      (f): f is Friend =>
        !!f &&
        typeof f.steamId === 'string' &&
        typeof f.name === 'string' &&
        typeof f.color === 'string' &&
        typeof f.addedAt === 'string'
    )
    const snapshots = parsed.snapshots.filter(
      (s): s is PlayerSnapshot =>
        !!s && typeof s.steamId === 'string' && typeof s.capturedAt === 'string'
    )
    mutate((d) => {
      d.friends = friends
      d.snapshots = snapshots
      d.settings = { ...d.settings, ...parsed.settings, pollStatus: undefined }
    })
    return { ok: true, count: { friends: friends.length, snapshots: snapshots.length } }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof SyntaxError ? 'Not a valid JSON file.' : String(err)
    }
  }
}

export async function pollAll(): Promise<void> {
  const friends = load().friends
  if (friends.length === 0) {
    setPollError('No friends on the board yet - add a Steam ID first.')
    return
  }
  setPolling(`Checking ${friends.length} friends...`)
  for (const friend of friends) {
    if (friend.demo) continue
    await pollFriend(friend.steamId)
    await delay(400)
  }
  setPollDone()
}

export function addManualSnapshot(steamId: string, input: ManualSnapshotInput): { ok: boolean; error?: string } {
  const friend = load().friends.find((f) => f.steamId === steamId)
  if (!friend) return { ok: false, error: 'Friend not found.' }
  const snap: PlayerSnapshot = {
    steamId,
    capturedAt: new Date().toISOString(),
    source: 'manual',
    mmr: input.mmr ?? undefined,
    kills: input.kills ?? undefined,
    deaths: input.deaths ?? undefined,
    bounty: input.bounty ?? undefined,
    moneyExtracted: input.moneyExtracted ?? undefined,
    bountyTokens: input.bountyTokens ?? undefined
  }
  const kills = snap.kills ?? 0
  const deaths = snap.deaths ?? 0
  if (kills > 0 || deaths > 0) {
    snap.kd = Number((kills / Math.max(1, deaths)).toFixed(2))
  }
  mutate((d) => d.snapshots.push(snap))
  return { ok: true }
}

export function loadDemoData(): AppData {
  const { friends, snapshots } = generateDemoData()
  mutate((d) => {
    d.friends = d.friends.filter((f) => !f.demo)
    d.snapshots = d.snapshots.filter((s) => s.source !== 'demo')
    d.friends.push(...friends)
    d.snapshots.push(...snapshots)
  })
  return snapshot()
}

export function clearDemoData(): AppData {
  mutate((d) => {
    d.friends = d.friends.filter((f) => !f.demo)
    d.snapshots = d.snapshots.filter((s) => s.source !== 'demo')
  })
  return snapshot()
}

export function updateSettings(patch: Partial<import('../shared/types').Settings>): AppData {
  mutate((d) => {
    d.settings = { ...d.settings, ...patch }
    const min = Math.max(2, Math.round(Number(patch.refreshMinutes) || d.settings.refreshMinutes))
    d.settings.refreshMinutes = min
  })
  return snapshot()
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function setPolling(message?: string): void {
  mutate((d) => {
    d.settings.pollStatus = {
      state: 'polling',
      message,
      lastPollAt: d.settings.pollStatus?.lastPollAt
    }
  })
}

function setPollDone(): void {
  mutate((d) => {
    d.settings.pollStatus = {
      state: 'idle',
      message: 'Up to date.',
      lastPollAt: new Date().toISOString()
    }
  })
}

function setPollError(error: string): void {
  mutate((d) => {
    d.settings.pollStatus = {
      state: 'error',
      message: error,
      lastError: error,
      lastPollAt: new Date().toISOString()
    }
  })
}

export function clearPollError(): void {
  mutate((d) => {
    if (d.settings.pollStatus) d.settings.pollStatus.state = 'idle'
  })
}

export function ensureFreshSettings(): void {
  persist()
}
