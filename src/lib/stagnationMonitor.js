/**
 * Stagnation Monitor — Shared stagnation detection logic.
 *
 * Provides configurable per-stage thresholds and recommended next actions
 * used by KanbanBoard, Dashboard, and NotificationCenter.
 */

// ── Per-stage thresholds (in days) ──────────────────────────────────────────
export const STAGNATION_THRESHOLDS = {
  New:                   3,
  Screening:             5,
  'Interview Pending':   7,
  'Interview Scheduled': 3,
  'Interview Completed': 3,
  Offer:                 5,
}

// ── Recommended next action per stage ───────────────────────────────────────
export const STAGE_NEXT_ACTION = {
  New:                   'Move to Screening — AI will score automatically',
  Screening:             'Review AI score and schedule an interview',
  'Interview Pending':   'Generate interview invite and wait for candidate booking',
  'Interview Scheduled': 'Conduct the interview on Zoom',
  'Interview Completed': 'Capture interview feedback and move to Offer or Reject',
  Offer:                 'Follow up on offer status — confirm acceptance or close',
}

// Terminal stages are excluded from stagnation checks
const TERMINAL_STAGES = ['Hired', 'Rejected']

/**
 * Detect stagnant applications from a list.
 *
 * @param {Array} applications — full application objects (with candidates + roles)
 * @returns {Array<{ id, candidateName, roleTitle, stage, daysSinceUpdate, threshold, nextAction }>}
 */
export function checkStagnation(applications) {
  if (!applications?.length) return []

  const now = Date.now()
  const alerts = []

  for (const app of applications) {
    if (TERMINAL_STAGES.includes(app.stage)) continue

    const threshold = STAGNATION_THRESHOLDS[app.stage]
    if (!threshold) continue

    const lastUpdate = new Date(app.updated_at).getTime()
    const daysSinceUpdate = (now - lastUpdate) / (1000 * 60 * 60 * 24)

    if (daysSinceUpdate >= threshold) {
      alerts.push({
        id: app.id,
        candidateName: app.candidates?.full_name || 'Unknown',
        roleTitle: app.roles?.title || 'Unknown Role',
        stage: app.stage,
        daysSinceUpdate: Math.floor(daysSinceUpdate),
        threshold,
        nextAction: STAGE_NEXT_ACTION[app.stage] || 'Review and take action',
      })
    }
  }

  // Sort by severity (most stagnant first)
  alerts.sort((a, b) => b.daysSinceUpdate - a.daysSinceUpdate)
  return alerts
}

/**
 * Group stagnation alerts by stage.
 * @param {Array} alerts — from checkStagnation
 * @returns {Object} — { stageName: { count, nextAction, alerts } }
 */
export function groupByStage(alerts) {
  const groups = {}
  for (const alert of alerts) {
    if (!groups[alert.stage]) {
      groups[alert.stage] = {
        count: 0,
        nextAction: alert.nextAction,
        alerts: [],
      }
    }
    groups[alert.stage].count++
    groups[alert.stage].alerts.push(alert)
  }
  return groups
}

/**
 * Classify alert urgency.
 * @param {object} alert — single stagnation alert
 * @returns {'critical'|'warning'|'info'}
 */
export function getUrgency(alert) {
  const ratio = alert.daysSinceUpdate / alert.threshold
  if (ratio >= 2) return 'critical'  // 2x threshold
  if (ratio >= 1.5) return 'warning' // 1.5x threshold
  return 'info'
}
