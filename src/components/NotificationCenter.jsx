import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { checkStagnation, getUrgency } from '../lib/stagnationMonitor'
import { Bell, X, Clock, AlertTriangle, ChevronRight } from 'lucide-react'

const POLL_INTERVAL = 5 * 60 * 1000 // 5 minutes
const DISMISSED_KEY = 'samara-dismissed-stagnation'

function getDismissed() {
  try {
    return JSON.parse(localStorage.getItem(DISMISSED_KEY) || '[]')
  } catch { return [] }
}

function setDismissed(ids) {
  localStorage.setItem(DISMISSED_KEY, JSON.stringify(ids))
}

export default function NotificationCenter({ collapsed, onNavigate }) {
  const [alerts, setAlerts] = useState([])
  const [dismissed, setDismissedState] = useState(getDismissed)
  const [open, setOpen] = useState(false)
  const panelRef = useRef()

  const ACTIVE_STAGES = ['New', 'Screening', 'Interview Pending', 'Interview Scheduled', 'Interview Completed', 'Offer']

  const fetchAndCheck = useCallback(async () => {
    const { data } = await supabase
      .from('applications')
      .select('*, candidates!inner(full_name, id), roles!inner(title, department)')
      .in('stage', ACTIVE_STAGES)

    if (data) {
      setAlerts(checkStagnation(data))
    }
  }, [])

  // Initial fetch + polling
  useEffect(() => {
    fetchAndCheck()
    const interval = setInterval(fetchAndCheck, POLL_INTERVAL)
    return () => clearInterval(interval)
  }, [fetchAndCheck])

  // Close panel on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const activeAlerts = alerts.filter(a => !dismissed.includes(a.id))
  const unreadCount = activeAlerts.length

  const dismiss = (id) => {
    const next = [...dismissed, id]
    setDismissedState(next)
    setDismissed(next)
  }

  const dismissAll = () => {
    const next = [...dismissed, ...activeAlerts.map(a => a.id)]
    setDismissedState(next)
    setDismissed(next)
  }

  const urgencyColor = {
    critical: 'var(--alert)',
    warning: 'var(--gold)',
    info: 'var(--stone)',
  }

  const urgencyBg = {
    critical: 'var(--alert-bg)',
    warning: 'var(--gold-bg)',
    info: 'var(--sand)',
  }

  return (
    <div ref={panelRef} style={{ position: 'relative' }}>
      {/* Bell button */}
      <button
        onClick={() => setOpen(!open)}
        title={collapsed ? `${unreadCount} alert${unreadCount !== 1 ? 's' : ''}` : undefined}
        style={{
          position: 'relative',
          display: 'flex', alignItems: 'center', gap: 8,
          padding: collapsed ? '8px 0' : '8px 12px',
          justifyContent: collapsed ? 'center' : 'flex-start',
          width: '100%',
          background: open ? 'rgba(255,255,255,0.06)' : 'none',
          border: 'none', cursor: 'pointer',
          color: unreadCount > 0 ? 'var(--gold)' : 'rgba(197,188,176,0.5)',
          transition: 'color 0.15s, background 0.15s',
          borderRadius: 6,
        }}
        onMouseOver={e => { if (!open) e.currentTarget.style.color = 'var(--stone)' }}
        onMouseOut={e => { if (!open) e.currentTarget.style.color = unreadCount > 0 ? 'var(--gold)' : 'rgba(197,188,176,0.5)' }}
      >
        <Bell size={16} />
        {!collapsed && (
          <span style={{ fontSize: 12, fontWeight: 500 }}>Alerts</span>
        )}

        {/* Badge */}
        {unreadCount > 0 && (
          <span style={{
            position: collapsed ? 'absolute' : 'static',
            top: collapsed ? 2 : undefined,
            right: collapsed ? -2 : undefined,
            marginLeft: collapsed ? 0 : 'auto',
            background: 'var(--alert)',
            color: 'white',
            borderRadius: 10,
            fontSize: 9,
            fontWeight: 700,
            minWidth: 16,
            height: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 4px',
          }}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div style={{
          position: 'fixed',
          left: collapsed ? 60 : 220,
          top: 60,
          width: 380,
          maxHeight: 'calc(100vh - 100px)',
          background: 'white',
          borderRadius: 10,
          boxShadow: '0 12px 40px rgba(0,0,0,0.15), 0 2px 8px rgba(0,0,0,0.08)',
          border: '1px solid var(--sand-dark)',
          zIndex: 999,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{
            padding: '14px 16px',
            borderBottom: '1px solid var(--sand-dark)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertTriangle size={14} style={{ color: 'var(--gold)' }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--charcoal)' }}>
                Stagnation Alerts
              </span>
              {unreadCount > 0 && (
                <span style={{
                  background: 'var(--alert-bg)', color: 'var(--alert)',
                  borderRadius: 10, padding: '1px 7px', fontSize: 10, fontWeight: 600,
                }}>
                  {unreadCount}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {unreadCount > 0 && (
                <button
                  onClick={dismissAll}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: 10.5, color: 'var(--stone)', padding: '2px 6px',
                  }}
                >
                  Dismiss all
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--stone)', padding: 0 }}
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Alert list */}
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {activeAlerts.length === 0 ? (
              <div style={{
                padding: '40px 20px', textAlign: 'center', color: 'var(--stone)',
              }}>
                <Bell size={24} style={{ opacity: 0.3, marginBottom: 8 }} />
                <p style={{ fontSize: 13 }}>No stagnation alerts</p>
                <p style={{ fontSize: 11, color: 'var(--stone-light)', marginTop: 4 }}>
                  All candidates are progressing on schedule.
                </p>
              </div>
            ) : (
              activeAlerts.map(alert => {
                const urgency = getUrgency(alert)
                return (
                  <div
                    key={alert.id}
                    style={{
                      padding: '12px 16px',
                      borderBottom: '1px solid var(--sand)',
                      display: 'flex', gap: 10,
                      background: urgency === 'critical' ? 'rgba(192,97,74,0.03)' : 'white',
                      transition: 'background 0.15s',
                    }}
                  >
                    {/* Urgency indicator */}
                    <div style={{
                      width: 6, borderRadius: 3, flexShrink: 0,
                      background: urgencyColor[urgency],
                      opacity: 0.7,
                    }} />

                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                        <span style={{
                          fontSize: 12.5, fontWeight: 600, color: 'var(--charcoal)',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {alert.candidateName}
                        </span>
                        <span style={{
                          fontSize: 10, fontWeight: 500, color: urgencyColor[urgency],
                          background: urgencyBg[urgency],
                          borderRadius: 4, padding: '1px 6px', flexShrink: 0,
                        }}>
                          {alert.daysSinceUpdate}d
                        </span>
                      </div>

                      <p style={{ fontSize: 11, color: 'var(--stone)', marginBottom: 4 }}>
                        {alert.roleTitle} &middot; stuck in <strong>{alert.stage}</strong>
                      </p>

                      {/* Recommended action */}
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 4,
                        fontSize: 10.5, color: 'var(--teal)',
                      }}>
                        <ChevronRight size={10} />
                        {alert.nextAction}
                      </div>
                    </div>

                    {/* Dismiss */}
                    <button
                      onClick={() => dismiss(alert.id)}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: 'var(--stone-light)', padding: 0, flexShrink: 0, alignSelf: 'flex-start',
                      }}
                      title="Dismiss"
                    >
                      <X size={12} />
                    </button>
                  </div>
                )
              })
            )}
          </div>

          {/* Footer */}
          {activeAlerts.length > 0 && (
            <div style={{
              padding: '10px 16px',
              borderTop: '1px solid var(--sand-dark)',
              display: 'flex', alignItems: 'center', gap: 6,
              fontSize: 10.5, color: 'var(--stone-light)',
            }}>
              <Clock size={10} />
              Auto-refreshes every 5 minutes
            </div>
          )}
        </div>
      )}
    </div>
  )
}
