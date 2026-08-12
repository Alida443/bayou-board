import type { PlayerSnapshot } from '../../shared/types'

export interface ProviderFetchResult {
  ok: boolean
  found: boolean
  snapshot?: PlayerSnapshot
  error?: string
  autoName?: string
}

export interface StatsProvider {
  readonly id: string
  readonly label: string
  fetchPlayer(steamId: string): Promise<ProviderFetchResult>
}
