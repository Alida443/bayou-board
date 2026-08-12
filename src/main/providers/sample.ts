import type { Friend, PlayerSnapshot } from '../../shared/types'
import { PALETTE } from '../../shared/types'

interface DemoProfile {
  name: string
  steamId: string
  startMmr: number
  startKills: number
  startDeaths: number
  bountyPerDay: number
  skillDrift: number
  sessionsPerWeek: number
  wins: number
}

const PROFILES: DemoProfile[] = [
  {
    name: 'Rusty Bayou',
    steamId: '76561190000000001',
    startMmr: 2210,
    startKills: 640,
    startDeaths: 730,
    bountyPerDay: 1400,
    skillDrift: 1.02,
    sessionsPerWeek: 3,
    wins: 0.55
  },
  {
    name: 'Twitchy Teal',
    steamId: '76561190000000002',
    startMmr: 2590,
    startKills: 1010,
    startDeaths: 830,
    bountyPerDay: 2100,
    skillDrift: 1.05,
    sessionsPerWeek: 4,
    wins: 0.62
  },
  {
    name: 'Baron Thicket',
    steamId: '76561190000000003',
    startMmr: 1980,
    startKills: 410,
    startDeaths: 560,
    bountyPerDay: 900,
    skillDrift: 0.99,
    sessionsPerWeek: 2,
    wins: 0.42
  }
]

const DAY_MS = 24 * 60 * 60 * 1000
const DAYS = 60

const DEMO_COLORS = [PALETTE[0], PALETTE[5], PALETTE[4]] // blood, river, sage

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function generate(): { friends: Friend[]; snapshots: PlayerSnapshot[] } {
  const friends: Friend[] = PROFILES.map((p, i) => ({
    steamId: p.steamId,
    name: p.name,
    color: DEMO_COLORS[i % DEMO_COLORS.length],
    addedAt: new Date(Date.now() - DAYS * DAY_MS).toISOString(),
    lastFetchedAt: new Date().toISOString(),
    demo: true
  }))

  const snapshots: PlayerSnapshot[] = []
  const now = Date.now()
  const start = now - DAYS * DAY_MS

  PROFILES.forEach((p) => {
    let kills = p.startKills
    let deaths = p.startDeaths
    let bounty = Math.round(p.bountyPerDay * DAYS * 0.3)
    let mmr = p.startMmr
    let lastDate = start
    const sessionEvery = 7 / p.sessionsPerWeek

    for (let day = 0; day <= DAYS; day += 1) {
      const t = lastDate + sessionEvery * DAY_MS
      if (t > now) break
      lastDate = t
      const win = Math.random() < p.wins
      const killsNow = win ? Math.floor(Math.random() * 5) + 1 : Math.floor(Math.random() * 3)
      const deathsNow = win ? Math.floor(Math.random() * 2) : Math.floor(Math.random() * 3) + 1
      kills += killsNow
      deaths += deathsNow
      bounty += Math.round((win ? 1500 : 350) + Math.random() * 1200)

      // MMR random walk with drift; wins push up, losses pull down
      mmr = mmr + (win ? 8 : -10) + (Math.random() * 14 - 7) * p.skillDrift
      mmr = clamp(mmr, 1400, 3400)

      const kd = kills / Math.max(1, deaths)
      const assists = Math.round(kills * 0.35)
      const kda = (kills + assists) / Math.max(1, deaths)

      snapshots.push({
        steamId: p.steamId,
        capturedAt: new Date(t).toISOString(),
        source: 'demo',
        mmr: Math.round(mmr),
        kd: Number(kd.toFixed(2)),
        kda: Number(kda.toFixed(2)),
        kills,
        deaths,
        assists,
        bounty,
        banishes: Math.round(bounty / 2200),
        playtimeMinutes: Math.round(kills * 6),
        level: 100,
        prestige: 12
      })
    }
  })

  return { friends, snapshots }
}

export function generateDemoData(): { friends: Friend[]; snapshots: PlayerSnapshot[] } {
  return generate()
}
