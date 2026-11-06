import type { PlayerSnapshot } from '../../shared/types'
import type { ProviderFetchResult, StatsProvider } from './types'

const BASE_URL = 'https://bayouledger.com'
const USER_AGENT = 'BayouBoard/1.0 (personal Hunt: Showdown stats tracker)'
const TIMEOUT_MS = 15000
const MAX_REDIRECTS = 3

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

// ---------------------------------------------------------------------------
// SvelteKit / devalue decoding
// ---------------------------------------------------------------------------

/** Placeholder for a streamed (deferred) promise that is filled in by a later chunk line. */
class PendingPromise {
  constructor(public readonly id: number) {}
}

/**
 * Decodes devalue's flat `data` array (used by SvelteKit's `__data.json`).
 * Every value inside objects/arrays is an index into `data`; negative indices
 * are special constants. Handles Date/Set/Map/BigInt/RegExp/null-prototype
 * objects and SvelteKit's streamed `Promise` markers.
 */
function unflatten(data: unknown[]): unknown {
  const hydrated = new Map<number, unknown>()

  const hydrate = (idx: number): unknown => {
    if (idx === -1) return undefined
    if (idx === -2) return undefined // hole
    if (idx === -3) return NaN
    if (idx === -4) return Infinity
    if (idx === -5) return -Infinity
    if (idx === -6) return -0
    if (idx < 0) return undefined
    if (hydrated.has(idx)) return hydrated.get(idx)

    const el = data[idx]
    if (el === null || typeof el !== 'object') {
      hydrated.set(idx, el)
      return el
    }

    if (Array.isArray(el)) {
      if (typeof el[0] === 'string') {
        const type = el[0]
        switch (type) {
          case 'Date': {
            hydrated.set(idx, el[1])
            return el[1]
          }
          case 'Set': {
            const out: unknown[] = []
            hydrated.set(idx, out)
            for (let i = 1; i < el.length; i++) out.push(hydrate(el[i] as number))
            return out
          }
          case 'Map': {
            const out: Record<string, unknown> = {}
            hydrated.set(idx, out)
            for (let i = 1; i < el.length; i += 2) {
              out[String(hydrate(el[i] as number))] = hydrate(el[i + 1] as number)
            }
            return out
          }
          case 'null': {
            const out: Record<string, unknown> = {}
            hydrated.set(idx, out)
            for (let i = 1; i < el.length; i += 2) out[String(el[i])] = hydrate(el[i + 1] as number)
            return out
          }
          case 'BigInt': {
            const n = Number(el[1])
            hydrated.set(idx, n)
            return n
          }
          case 'Object':
          case 'RegExp':
          case 'URL': {
            hydrated.set(idx, el[1])
            return el[1]
          }
          case 'Promise': {
            const p = new PendingPromise(Number(el[1]))
            hydrated.set(idx, p)
            return p
          }
          default: {
            // Unknown custom reducer: keep the raw payload.
            const out = el.length === 2 ? hydrate(el[1] as number) : el.slice(1)
            hydrated.set(idx, out)
            return out
          }
        }
      }
      const out: unknown[] = []
      hydrated.set(idx, out)
      for (const item of el) out.push(typeof item === 'number' ? hydrate(item) : item)
      return out
    }

    const out: Record<string, unknown> = {}
    hydrated.set(idx, out)
    for (const [key, value] of Object.entries(el as Record<string, unknown>)) {
      out[key] = typeof value === 'number' && Number.isInteger(value) ? hydrate(value) : value
    }
    return out
  }

  if (!Array.isArray(data) || data.length === 0) return undefined
  return hydrate(0)
}

/** Replaces PendingPromise placeholders with the data from streamed chunks. */
function fillPromises(value: unknown, chunks: Map<number, unknown>, seen = new Set<unknown>()): unknown {
  if (value instanceof PendingPromise) {
    return chunks.has(value.id) ? fillPromises(chunks.get(value.id), chunks, seen) : undefined
  }
  if (value === null || typeof value !== 'object' || seen.has(value)) return value
  seen.add(value)
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) value[i] = fillPromises(value[i], chunks, seen)
  } else {
    const obj = value as Record<string, unknown>
    for (const key of Object.keys(obj)) obj[key] = fillPromises(obj[key], chunks, seen)
  }
  return value
}

interface DataDocument {
  type?: string
  location?: string
  error?: unknown
  nodes?: unknown[]
}

/**
 * Parses a `__data.json` body. Newer SvelteKit versions may stream the
 * response as newline-delimited JSON: the first line is the document, the
 * following lines are `{type:"chunk", id, data}` entries for deferred data.
 */
function parseDataResponse(text: string): { doc: DataDocument; chunks: Map<number, unknown> } {
  const trimmed = text.trim()
  const chunks = new Map<number, unknown>()
  let doc: DataDocument | undefined

  try {
    doc = JSON.parse(trimmed) as DataDocument
  } catch {
    const lines = trimmed.split('\n').filter((l) => l.trim().length > 0)
    if (lines.length === 0) throw new Error('Bayou Ledger returned an empty response')
    try {
      doc = JSON.parse(lines[0]) as DataDocument
    } catch {
      throw new Error('Bayou Ledger returned data we could not parse')
    }
    for (const line of lines.slice(1)) {
      try {
        const chunk = JSON.parse(line) as { type?: string; id?: number; data?: unknown[] }
        if (chunk.type === 'chunk' && typeof chunk.id === 'number' && Array.isArray(chunk.data)) {
          chunks.set(chunk.id, unflatten(chunk.data))
        }
      } catch {
        // ignore malformed chunk lines
      }
    }
  }

  if (!isPlainObject(doc)) throw new Error('Bayou Ledger returned data we could not parse')
  return { doc, chunks }
}

// ---------------------------------------------------------------------------
// Ledger data model
// ---------------------------------------------------------------------------

interface LedgerPlayer {
  steam_id?: string
  name?: string
  skill_rating?: number
  skill_variance?: number
  clash_skill_rating?: number
  rank?: number
  prestige?: number
  player_kills?: number
  killed_by_player?: number
  player_kill_assists?: number
  kd_ratio?: number
  kda_ratio?: number
  total_bounty?: number
  targets_banished?: number
  hunt_playtime_minutes?: number
  last_stat_change_at?: unknown
  last_change_at?: unknown
}

interface LedgerNode {
  steamId?: string
  subjectName?: string
  player?: LedgerPlayer | null
  snapshotCount?: number
  lastSnapshotAt?: unknown
  firstSnapshotAt?: unknown
  historyGated?: boolean
}

const PLAYER_KEYS = ['skill_rating', 'player_kills', 'killed_by_player', 'kd_ratio', 'total_bounty']

function looksLikePlayer(value: unknown): value is LedgerPlayer {
  return isPlainObject(value) && PLAYER_KEYS.some((k) => k in value)
}

function looksLikeLedgerNode(value: unknown): value is LedgerNode {
  return isPlainObject(value) && ('player' in value || 'subjectName' in value || 'snapshotCount' in value)
}

/** Finds the page data among all SvelteKit nodes (layouts + page), wherever it sits. */
function findLedgerNode(nodes: unknown[], chunks: Map<number, unknown>): LedgerNode | undefined {
  const decoded: Record<string, unknown>[] = []
  for (const node of nodes) {
    if (!isPlainObject(node)) continue // null / {type:"skip"}
    if (node.type !== undefined && node.type !== 'data') continue
    if (!Array.isArray(node.data)) continue
    const value = fillPromises(unflatten(node.data), chunks)
    if (isPlainObject(value)) decoded.push(value)
  }

  // Prefer the deepest node (the page) over layouts.
  for (const value of decoded.slice().reverse()) {
    if (looksLikeLedgerNode(value)) {
      if (looksLikePlayer(value.player) || value.player === null || value.player === undefined) {
        return value
      }
    }
  }

  // Fallback: page data may have been nested (e.g. `{ profile: {...} }`) or
  // the player object exposed directly.
  for (const value of decoded.slice().reverse()) {
    for (const inner of Object.values(value)) {
      if (looksLikeLedgerNode(inner)) return inner
    }
    if (looksLikePlayer(value)) return { player: value, subjectName: (value as LedgerPlayer).name }
    for (const inner of Object.values(value)) {
      if (looksLikePlayer(inner)) return { ...(value as Record<string, unknown>), player: inner } as LedgerNode
    }
  }

  return undefined
}

function toIso(value: unknown): string | undefined {
  if (typeof value === 'string' || typeof value === 'number') {
    const d = new Date(value)
    return Number.isNaN(d.getTime()) ? undefined : d.toISOString()
  }
  return undefined
}

function num(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) return Number(value)
  return undefined
}

function buildSnapshot(steamId: string, node: LedgerNode, capturedAt: string): PlayerSnapshot {
  const p = node.player
  const skill = num(p?.skill_rating)
  const mmr = skill !== undefined ? Math.round(skill * 100) : undefined
  return {
    steamId,
    capturedAt,
    source: 'bayou',
    mmr,
    kd: num(p?.kd_ratio),
    kda: num(p?.kda_ratio),
    kills: num(p?.player_kills),
    deaths: num(p?.killed_by_player),
    assists: num(p?.player_kill_assists),
    bounty: num(p?.total_bounty),
    banishes: num(p?.targets_banished),
    playtimeMinutes: num(p?.hunt_playtime_minutes),
    level: num(p?.rank),
    prestige: num(p?.prestige),
    ledgerSnapshotCount: num(node.snapshotCount),
    lastStatChangeAt: toIso(p?.last_stat_change_at ?? p?.last_change_at)
  }
}

function dataUrlFor(pathname: string): string {
  const clean = pathname.replace(/\/__data\.json$/, '').replace(/\/+$/, '')
  return `${BASE_URL}${clean}/__data.json`
}

async function fetchLedgerNode(steamId: string): Promise<LedgerNode> {
  let url = dataUrlFor(`/p/${steamId}`)

  for (let attempt = 0; attempt <= MAX_REDIRECTS; attempt++) {
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json, */*;q=0.8' },
      signal: AbortSignal.timeout(TIMEOUT_MS)
    })
    if (res.status === 404) {
      return { player: null }
    }
    if (!res.ok) {
      throw new Error(`Bayou Ledger returned HTTP ${res.status}`)
    }
    const text = await res.text()
    if (/^\s*</.test(text)) {
      throw new Error('Bayou Ledger returned an HTML page instead of data (site blocked the request or changed)')
    }

    const { doc, chunks } = parseDataResponse(text)

    if (doc.type === 'redirect' && typeof doc.location === 'string') {
      const target = new URL(doc.location, BASE_URL)
      if (target.origin !== BASE_URL) throw new Error('Bayou Ledger redirected to an unexpected site')
      url = dataUrlFor(target.pathname)
      continue
    }

    if (doc.type === 'error') {
      const err = doc.error
      const status = isPlainObject(err) && typeof err.status === 'number' ? err.status : undefined
      if (status === 404) return { player: null }
      const msg = isPlainObject(err) && typeof err.message === 'string' ? err.message : 'unknown error'
      throw new Error(`Bayou Ledger reported an error: ${msg}`)
    }

    const nodes = doc.nodes
    if (!Array.isArray(nodes)) {
      throw new Error('Bayou Ledger returned an unexpected page (no data nodes)')
    }
    const node = findLedgerNode(nodes, chunks)
    if (!node) {
      throw new Error('Bayou Ledger returned an unexpected page (player data not found)')
    }
    return node
  }

  throw new Error('Bayou Ledger redirected too many times')
}

const bayouLedgerProvider: StatsProvider = {
  id: 'bayouLedger',
  label: 'The Bayou Ledger (public profile pages)',

  async fetchPlayer(steamId: string): Promise<ProviderFetchResult> {
    try {
      const node = await fetchLedgerNode(steamId)
      if (!node.player) {
        return {
          ok: true,
          found: false,
          error: 'Not tracked on the Bayou Ledger yet (stats hidden or not on the rolls).'
        }
      }
      const capturedAt = new Date().toISOString()
      const snapshot = buildSnapshot(steamId, node, capturedAt)
      return {
        ok: true,
        found: true,
        snapshot,
        autoName: node.subjectName || node.player?.name
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return { ok: false, found: false, error: message }
    }
  }
}

export const __testing = { unflatten, parseDataResponse, findLedgerNode }

export default bayouLedgerProvider
