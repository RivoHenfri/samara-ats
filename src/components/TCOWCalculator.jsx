import { useState } from 'react'

export default function TCOWCalculator() {
  const [baseSalary, setBaseSalary] = useState('')
  const [result, setResult] = useState(null)

  const calculate = () => {
    const base = parseFloat(baseSalary)
    if (!base || base <= 0) return

    const sumbawaPremium = base * 0.20
    const bpjsTax = base * 0.04
    const thrProvision = base / 12
    const tcow = base + sumbawaPremium + bpjsTax + thrProvision

    setResult({ base, sumbawaPremium, bpjsTax, thrProvision, tcow })
  }

  const fmt = (n) => new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR', maximumFractionDigits: 0
  }).format(n)

  return (
    <div className="p-8 max-w-lg">
      <h1 className="text-2xl font-bold text-white mb-2">TCOW Calculator</h1>
      <p className="text-gray-400 mb-6">Total Cost of Worker — Samara Lombok Formula</p>

      <div className="bg-gray-800 rounded-xl p-6 mb-4">
        <label className="text-gray-400 text-sm mb-2 block">Base Monthly Salary (IDR)</label>
        <input
          type="number"
          value={baseSalary}
          onChange={e => setBaseSalary(e.target.value)}
          placeholder="e.g. 8000000"
          className="w-full bg-gray-700 text-white px-4 py-3 rounded-lg outline-none text-lg mb-4"
        />
        <button
          onClick={calculate}
          className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-lg font-semibold transition-colors"
        >
          Calculate TCOW
        </button>
      </div>

      {result && (
        <div className="bg-gray-800 rounded-xl p-6 space-y-3">
          <div className="flex justify-between text-gray-300">
            <span>Base Salary</span>
            <span>{fmt(result.base)}</span>
          </div>
          <div className="flex justify-between text-yellow-400">
            <span>Sumbawa Premium (20%)</span>
            <span>+ {fmt(result.sumbawaPremium)}</span>
          </div>
          <div className="flex justify-between text-blue-400">
            <span>BPJS & Tax (4%)</span>
            <span>+ {fmt(result.bpjsTax)}</span>
          </div>
          <div className="flex justify-between text-purple-400">
            <span>THR Provision (1/12)</span>
            <span>+ {fmt(result.thrProvision)}</span>
          </div>
          <div className="border-t border-gray-600 pt-3 flex justify-between text-white font-bold text-lg">
            <span>Total TCOW</span>
            <span className="text-emerald-400">{fmt(result.tcow)}</span>
          </div>
        </div>
      )}
    </div>
  )
}