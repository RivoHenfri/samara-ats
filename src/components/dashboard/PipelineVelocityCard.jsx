import { useEffect, useState } from 'react'
import { computeVelocity } from '../../lib/pipelineVelocity'
import { STAGE_COLORS } from '../../lib/constants'

const HEALTH_COLORS = {
  healthy:  '#4A7C74',
  warning:  '#D4A843',
  critical: '#C0614A',
}

export default function PipelineVelocityCard({ dateRange }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    computeVelocity(dateRange).then(result => {
      setData(result)
      setLoading(false)
    })
  }, [dateRange.start?.getTime(), dateRange.end?.getTime()])

  if (loading) {
    return (
      <div className="card">
        <div className="card-header">
          <span className="card-title">Pipeline Velocity</span>
        </div>
        <div className="loading-state" style={{ padding: 20 }}>
          <span className="spinner" /> Loading velocity data…
        </div>
      </div>
    )
  }

  if (!data) return null

  const { stageMetrics, bottleneck } = data
  const withData = stageMetrics.filter(m => m.medianDays !== null)
  const maxDays = Math.max(...withData.map(m => m.medianDays), 1)

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">Pipeline Velocity</span>
        {bottleneck && (
          <span style={{ fontSize: 11, color: 'var(--alert)' }}>
            Bottleneck: {bottleneck.stage} ({bottleneck.medianDays}d median)
          </span>
        )}
      </div>
      <div style={{ padding: '16px 20px 12px' }}>
        {withData.length === 0 ? (
          <p style={{ fontSize: 12, color: 'var(--stone)' }}>
            Not enough transition data yet. Velocity metrics will appear as candidates move through stages.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {stageMetrics.map(m => {
              if (m.medianDays === null) return null
              const barWidth = Math.max((m.medianDays / maxDays) * 100, 8)
              return (
                <div key={m.stage} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 110, fontSize: 11, color: 'var(--charcoal)',
                    fontWeight: 500, flexShrink: 0, textAlign: 'right',
                  }}>
                    {m.stage.replace('Interview ', 'Int. ')}
                  </div>

                  {/* Dwell time bar */}
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{
                      height: 16, borderRadius: 4,
                      width: `${barWidth}%`,
                      background: HEALTH_COLORS[m.health],
                      transition: 'width 0.3s ease',
                      minWidth: 20,
                    }} />
                    <span style={{
                      fontSize: 11, fontWeight: 600,
                      color: HEALTH_COLORS[m.health],
                      flexShrink: 0,
                    }}>
                      {m.medianDays}d
                    </span>
                  </div>

                  {/* Conversion rate */}
                  {m.conversionRate !== null && (
                    <div style={{
                      fontSize: 10, color: 'var(--stone)',
                      flexShrink: 0, width: 40, textAlign: 'right',
                    }}>
                      {m.conversionRate}% →
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
        {withData.length > 0 && (
          <div style={{ marginTop: 10, fontSize: 10, color: 'var(--stone-light)' }}>
            Median days in stage &middot; Based on {withData.reduce((s, m) => s + m.sampleSize, 0)} transitions
          </div>
        )}
      </div>
    </div>
  )
}
