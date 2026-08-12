import { load } from './store'
import { pollAll } from './service'

let timer: ReturnType<typeof setInterval> | null = null

export function restartScheduler(): void {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
  const settings = load().settings
  if (!settings.autoRefresh) return
  const minutes = Math.max(2, Math.round(settings.refreshMinutes))
  timer = setInterval(() => {
    void pollAll()
  }, minutes * 60 * 1000)
  console.log(`[bayou-board] auto-refresh every ${minutes} min`)
}
