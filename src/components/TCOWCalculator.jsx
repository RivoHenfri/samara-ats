import { useState } from 'react'

export default function TCOWCalculator() {
  const [baseSalary, setBaseSalary] = useState('')
  const [result,     setResult]     = useState(null)

  const calculate = () => {
    const base = parseFloat(baseSalary)
    if (!base || base <= 0) return

    const sumbawaPremium = base * 0.20
    const bpjsTax        = base * 0.04
    const thrProvision   = base / 12
    const tcow           = base + sumbawaPremium + bpjsTax + thrProvision

    setResult({ base, sumbawaPremium, bpjsTax, thrProvision, tcow })
  }

  const fmt = (n) => new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR', maximumFractionDigits: 0
  }).format(n)

  return (
    <div>
      {/* ── Topbar ── */}
      <div className="topbar">
        <h1 className="page-title">TCOW Calculator</h1>
      </div>

      <div className="page-body" style={{ maxWidth: 640 }}>
        <p style={{ fontSize: 12, color: 'var(--stone)', marginBottom: 24 }}>
          Total Cost of Workforce — Samara Lombok formula including Sumbawa premium, BPJS, and THR provision.
        </p>

        {/* Input card */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header">
            <span className="card-title">Position Details</span>
          </div>
          <div style={{ padding: '20px' }}>
            <div className="form-group">
              <label className="form-label">Base Monthly Salary (IDR)</label>
              <input
                type="number"
                value={baseSalary}
                onChange={e => setBaseSalary(e.target.value)}
                placeholder="e.g. 8000000"
                className="form-control"
                style={{ fontSize: 15 }}
                onKeyDown={e => e.key === 'Enter' && calculate()}
              />
              <p className="form-hint">Enter the gross monthly base salary before any additions</p>
            </div>
            <button
              onClick={calculate}
              className="btn btn-primary btn-block btn-lg"
            >
              Calculate TCOW
            </button>
          </div>
        </div>

        {/* Result */}
        {result && (
          <div className="tcow-result">
            <div className="tcow-result-label">Total Cost of Workforce / Month</div>
            <div className="tcow-result-val">{fmt(result.tcow)}</div>
            <div className="tcow-result-sub" style={{ marginBottom: 20 }}>
              {fmt(result.tcow * 12)} / year
            </div>

            {/* Divider */}
            <div style={{
              height: 1,
              background: 'rgba(255,255,255,0.08)',
              marginBottom: 16,
            }} />

            {/* Breakdown */}
            <div className="tcow-line">
              <span className="tcow-line-label">Base Salary</span>
              <span className="tcow-line-val">{fmt(result.base)}</span>
            </div>
            <div className="tcow-line">
              <span className="tcow-line-label" style={{ color: 'var(--gold-light)' }}>
                + Sumbawa Premium (20%)
              </span>
              <span className="tcow-line-val" style={{ color: 'var(--gold-light)' }}>
                {fmt(result.sumbawaPremium)}
              </span>
            </div>
            <div className="tcow-line">
              <span className="tcow-line-label" style={{ color: 'var(--teal-light)' }}>
                + BPJS & Tax (4%)
              </span>
              <span className="tcow-line-val" style={{ color: 'var(--teal-light)' }}>
                {fmt(result.bpjsTax)}
              </span>
            </div>
            <div className="tcow-line">
              <span className="tcow-line-label" style={{ color: 'var(--stone-light)' }}>
                + THR Provision (1/12)
              </span>
              <span className="tcow-line-val" style={{ color: 'var(--stone-light)' }}>
                {fmt(result.thrProvision)}
              </span>
            </div>

            <div style={{
              height: 1,
              background: 'rgba(255,255,255,0.1)',
              margin: '12px 0',
            }} />

            <div className="tcow-line tcow-total">
              <span className="tcow-line-label">Total TCOW / Month</span>
              <span className="tcow-line-val">{fmt(result.tcow)}</span>
            </div>
          </div>
        )}

        {/* Info box */}
        <div style={{
          marginTop: 16,
          padding: '12px 16px',
          background: 'var(--gold-bg)',
          border: '1px solid rgba(184,150,90,0.2)',
          borderRadius: 8,
          fontSize: 11.5,
          color: 'var(--charcoal)',
          lineHeight: 1.6,
        }}>
          <strong style={{ color: 'var(--gold)' }}>Formula:</strong>{' '}
          Base + Sumbawa Remote Premium (20%) + Employer BPJS (4%) + THR Monthly Provision (Base ÷ 12).
          Use this for budgeting headcount costs accurately before making an offer.
        </div>
      </div>
    </div>
  )
}
