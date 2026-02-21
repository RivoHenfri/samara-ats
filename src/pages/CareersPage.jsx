import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Briefcase, MapPin, ChevronRight, Loader2, AlertTriangle } from 'lucide-react'

// ── Helpers ───────────────────────────────────────────────────────────────────
function groupByDepartment(roles) {
  return roles.reduce((acc, role) => {
    const dept = role.department || 'Other'
    if (!acc[dept]) acc[dept] = []
    acc[dept].push(role)
    return acc
  }, {})
}

function truncate(text, max = 180) {
  if (!text) return null
  return text.length <= max ? text : text.slice(0, max).trimEnd() + '…'
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function CareersPage() {
  const { tenantSlug } = useParams()
  const [tenant, setTenant] = useState(null)
  const [roles, setRoles] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)

      // Resolve slug → tenant
      const { data: tenantData, error: tenantErr } = await supabase
        .from('tenants')
        .select('id, name, slug')
        .eq('slug', tenantSlug)
        .single()

      if (tenantErr || !tenantData) {
        setError('Company not found. Please check the URL.')
        setLoading(false)
        return
      }

      setTenant(tenantData)

      // Fetch open roles for this tenant
      const { data: rolesData, error: rolesErr } = await supabase
        .from('roles')
        .select('id, title, department, job_context')
        .eq('tenant_id', tenantData.id)
        .eq('status', 'Open')
        .order('department')
        .order('title')

      if (rolesErr) {
        setError('Failed to load open positions. Please try again.')
        setLoading(false)
        return
      }

      setRoles(rolesData || [])
      setLoading(false)
    }

    load()
  }, [tenantSlug])

  // ── Loading state ──────────────────────────────────────────────────────────
  if (loading) return (
    <div style={styles.fullPage}>
      <div style={styles.centerBox}>
        <Loader2 size={28} style={{ animation: 'spin 1s linear infinite', color: 'var(--teal, #4A7C74)' }} />
        <p style={{ marginTop: 12, color: '#9A8F80', fontSize: 14 }}>Loading positions…</p>
      </div>
    </div>
  )

  // ── Error state ────────────────────────────────────────────────────────────
  if (error) return (
    <div style={styles.fullPage}>
      <div style={styles.centerBox}>
        <AlertTriangle size={28} style={{ color: '#C0614A' }} />
        <p style={{ marginTop: 12, color: '#2C2A27', fontSize: 15, fontWeight: 500 }}>{error}</p>
      </div>
    </div>
  )

  const grouped = groupByDepartment(roles)
  const departments = Object.keys(grouped).sort()

  return (
    <div style={styles.fullPage}>
      <div style={styles.container}>

        {/* ── Header ── */}
        <header style={styles.header}>
          <div style={styles.wordmark}>
            <span style={styles.wordmarkText}>samara</span>
          </div>
          <h1 style={styles.heroTitle}>Join {tenant.name}</h1>
          <p style={styles.heroSubtitle}>
            {roles.length > 0
              ? `${roles.length} open position${roles.length !== 1 ? 's' : ''} — find your next role below`
              : 'No open positions at the moment. Check back soon.'}
          </p>
        </header>

        {/* ── Role listing ── */}
        {roles.length > 0 && (
          <main style={styles.main}>
            {departments.map(dept => (
              <section key={dept} style={styles.deptSection}>
                <h2 style={styles.deptHeading}>{dept}</h2>
                <div style={styles.roleList}>
                  {grouped[dept].map(role => (
                    <RoleCard key={role.id} role={role} tenantSlug={tenantSlug} />
                  ))}
                </div>
              </section>
            ))}
          </main>
        )}

        {/* ── Footer ── */}
        <footer style={styles.footer}>
          <p style={{ color: '#C4BDB5', fontSize: 12 }}>
            Powered by Samara ATS
          </p>
        </footer>

      </div>
    </div>
  )
}

// ── Role card component ────────────────────────────────────────────────────────
function RoleCard({ role, tenantSlug }) {
  const [hovered, setHovered] = useState(false)
  const summary = truncate(role.job_context)

  return (
    <Link
      to={`/apply/${role.id}`}
      style={{
        ...styles.roleCard,
        ...(hovered ? styles.roleCardHover : {}),
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={styles.roleCardLeft}>
        <div style={styles.roleIcon}>
          <Briefcase size={16} style={{ color: '#4A7C74' }} />
        </div>
        <div>
          <p style={styles.roleTitle}>{role.title}</p>
          <div style={styles.roleMeta}>
            <span style={styles.deptBadge}>{role.department}</span>
            <span style={styles.roleMetaDot}>·</span>
            <MapPin size={11} style={{ color: '#9A8F80', marginTop: 1 }} />
            <span style={{ color: '#9A8F80', fontSize: 12 }}>Lombok, Indonesia</span>
          </div>
          {summary && (
            <p style={styles.roleSummary}>{summary}</p>
          )}
        </div>
      </div>
      <ChevronRight size={16} style={{ color: hovered ? '#4A7C74' : '#C4BDB5', flexShrink: 0, transition: 'color 0.15s' }} />
    </Link>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = {
  fullPage: {
    minHeight: '100vh',
    background: '#FAF8F5',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  centerBox: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    minHeight: '100vh',
  },
  container: {
    width: '100%',
    maxWidth: 720,
    padding: '0 20px',
    display: 'flex',
    flexDirection: 'column',
    gap: 0,
  },
  header: {
    padding: '64px 0 48px',
    textAlign: 'center',
    borderBottom: '1px solid #EBE7E1',
  },
  wordmark: {
    marginBottom: 24,
  },
  wordmarkText: {
    fontSize: 22,
    fontWeight: 700,
    letterSpacing: '-0.03em',
    color: '#2C2A27',
  },
  heroTitle: {
    fontSize: 34,
    fontWeight: 700,
    color: '#2C2A27',
    margin: '0 0 12px',
    letterSpacing: '-0.02em',
    lineHeight: 1.2,
  },
  heroSubtitle: {
    fontSize: 15,
    color: '#9A8F80',
    margin: 0,
    lineHeight: 1.6,
  },
  main: {
    padding: '40px 0 64px',
    display: 'flex',
    flexDirection: 'column',
    gap: 40,
  },
  deptSection: {},
  deptHeading: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: '#9A8F80',
    margin: '0 0 12px',
  },
  roleList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  roleCard: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    background: 'white',
    border: '1px solid #EBE7E1',
    borderRadius: 10,
    padding: '16px 20px',
    textDecoration: 'none',
    transition: 'border-color 0.15s, box-shadow 0.15s',
    cursor: 'pointer',
  },
  roleCardHover: {
    borderColor: '#4A7C74',
    boxShadow: '0 2px 8px rgba(74, 124, 116, 0.12)',
  },
  roleCardLeft: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 14,
    flex: 1,
    minWidth: 0,
  },
  roleIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    background: 'rgba(74, 124, 116, 0.08)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 2,
  },
  roleTitle: {
    fontSize: 15,
    fontWeight: 600,
    color: '#2C2A27',
    margin: '0 0 5px',
  },
  roleMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    flexWrap: 'wrap',
  },
  deptBadge: {
    fontSize: 11,
    fontWeight: 600,
    color: '#4A7C74',
    background: 'rgba(74, 124, 116, 0.08)',
    borderRadius: 4,
    padding: '2px 7px',
  },
  roleMetaDot: {
    color: '#C4BDB5',
    fontSize: 12,
  },
  roleSummary: {
    fontSize: 12.5,
    color: '#9A8F80',
    margin: '8px 0 0',
    lineHeight: 1.55,
  },
  footer: {
    padding: '24px 0 40px',
    borderTop: '1px solid #EBE7E1',
    textAlign: 'center',
  },
}
