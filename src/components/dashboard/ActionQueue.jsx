import { useNavigate } from 'react-router-dom'
import { checkStagnation, getUrgency } from '../../lib/stagnationMonitor'
import { STAGE_CLASS } from '../../lib/constants'
import { AlertTriangle } from 'lucide-react'

const URGENCY_COLOR = {
  critical: 'var(--alert)',
  warning:  '#D4A843',
  info:     'var(--stone)',
}

export default function ActionQueue({ applications }) {
  const navigate = useNavigate()
  const alerts = checkStagnation(applications)
  const topAlerts = alerts.slice(0, 10)

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">Needs Attention</span>
        {alerts.length > 0 && (
          <span style={{ fontSize: 11, color: 'var(--stone)' }}>
            {alerts.length} total
          </span>
        )}
      </div>

      {topAlerts.length === 0 ? (
        <div className="empty-state" style={{ padding: '24px 20px' }}>
          <p style={{ fontSize: 13, color: 'var(--teal)', fontWeight: 600 }}>All candidates on track</p>
          <p style={{ fontSize: 11, color: 'var(--stone)', marginTop: 4 }}>No stagnant candidates — pipeline is healthy.</p>
        </div>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: 8 }}></th>
              <th>Candidate</th>
              <th>Role</th>
              <th>Stuck In</th>
              <th>Days</th>
              <th>Next Action</th>
            </tr>
          </thead>
          <tbody>
            {topAlerts.map(alert => {
              const urgency = getUrgency(alert)
              return (
                <tr
                  key={alert.id}
                  style={{ cursor: 'pointer' }}
                  onClick={() => navigate('/pipeline')}
                >
                  <td>
                    <div style={{
                      width: 7, height: 7, borderRadius: '50%',
                      background: URGENCY_COLOR[urgency],
                      flexShrink: 0,
                    }} />
                  </td>
                  <td style={{ fontWeight: 600 }}>{alert.candidateName}</td>
                  <td>{alert.roleTitle}</td>
                  <td>
                    <span className={`stage-badge ${STAGE_CLASS[alert.stage] ?? 'stage-new'}`}>
                      {alert.stage}
                    </span>
                  </td>
                  <td style={{
                    color: urgency === 'critical' ? 'var(--alert)' : 'var(--stone)',
                    fontWeight: 600,
                    fontSize: 12,
                  }}>
                    {alert.daysSinceUpdate}d
                  </td>
                  <td style={{ fontSize: 11, color: 'var(--teal)', maxWidth: 220 }}>
                    {alert.nextAction}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}
