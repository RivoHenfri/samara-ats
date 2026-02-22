import { supabase } from './supabase'
import { differenceInDays } from 'date-fns'
import { ACTIVE_STAGES, STAGES } from './constants'
import { STAGNATION_THRESHOLDS } from './stagnationMonitor'

/**
 * Compute pipeline velocity metrics from application_history.
 *
 * Returns per-stage median dwell time, true conversion rates,
 * bottleneck identification, and velocity trend vs previous period.
 *
 * @param {{ start: Date, end: Date }} dateRange
 * @returns {{ stageMetrics: Array, bottleneck: object|null }}
 */
export async function computeVelocity(dateRange) {
  const { data: transitions, error } = await supabase
    .from('application_history')
    .select('application_id, previous_stage, new_stage, created_at')
    .eq('action_type', 'STAGE_MOVED')
    .gte('created_at', dateRange.start.toISOString())
    .lte('created_at', dateRange.end.toISOString())
    .order('created_at', { ascending: true })

  if (error || !transitions?.length) {
    return {
      stageMetrics: ACTIVE_STAGES.map(s => ({
        stage: s, medianDays: null, conversionRate: null, sampleSize: 0,
      })),
      bottleneck: null,
    }
  }

  // Group transitions by application to build per-candidate timelines
  const appTimelines = {}
  for (const t of transitions) {
    if (!appTimelines[t.application_id]) appTimelines[t.application_id] = []
    appTimelines[t.application_id].push(t)
  }

  // Calculate dwell times: time spent in previous_stage before moving
  const stageDwellTimes = {}
  for (const timeline of Object.values(appTimelines)) {
    for (let i = 0; i < timeline.length; i++) {
      const t = timeline[i]
      if (!t.previous_stage) continue
      // Entry time = previous transition's created_at (when they entered this stage)
      const enteredAt = i > 0
        ? new Date(timeline[i - 1].created_at)
        : null
      if (enteredAt) {
        const dwellDays = differenceInDays(new Date(t.created_at), enteredAt)
        if (dwellDays >= 0) {
          if (!stageDwellTimes[t.previous_stage]) stageDwellTimes[t.previous_stage] = []
          stageDwellTimes[t.previous_stage].push(dwellDays)
        }
      }
    }
  }

  // Compute per-stage metrics
  const stageMetrics = ACTIVE_STAGES.map(stage => {
    const times = stageDwellTimes[stage] || []
    const sorted = [...times].sort((a, b) => a - b)
    const median = sorted.length > 0 ? sorted[Math.floor(sorted.length / 2)] : null

    // True conversion: how many moved FORWARD from this stage (vs rejected)
    const forwardCount = transitions.filter(
      t => t.previous_stage === stage && t.new_stage !== 'Rejected'
    ).length
    const totalOut = transitions.filter(
      t => t.previous_stage === stage
    ).length
    const conversionRate = totalOut > 0 ? Math.round((forwardCount / totalOut) * 100) : null

    // Health status based on stagnation thresholds
    const threshold = STAGNATION_THRESHOLDS[stage]
    let health = 'healthy'
    if (median !== null && threshold) {
      if (median >= threshold) health = 'critical'
      else if (median >= threshold * 0.7) health = 'warning'
    }

    return { stage, medianDays: median, conversionRate, sampleSize: sorted.length, health }
  })

  // Identify bottleneck: highest median among stages with data
  const withData = stageMetrics.filter(m => m.medianDays !== null)
  const bottleneck = withData.length > 0
    ? withData.sort((a, b) => b.medianDays - a.medianDays)[0]
    : null

  return { stageMetrics, bottleneck }
}
