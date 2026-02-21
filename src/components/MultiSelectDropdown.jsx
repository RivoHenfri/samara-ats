import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Search, X, Check } from 'lucide-react'

export default function MultiSelectDropdown({
    label,
    options,
    selectedValues,
    onChange,
    placeholder = "Select...",
    searchPlaceholder = "Search...",
    className = ""
}) {
    const [isOpen, setIsOpen] = useState(false)
    const [search, setSearch] = useState("")
    const dropdownRef = useRef(null)

    useEffect(() => {
        function handleClickOutside(event) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false)
            }
        }
        document.addEventListener("mousedown", handleClickOutside)
        return () => document.removeEventListener("mousedown", handleClickOutside)
    }, [])

    const filteredOptions = options.filter(opt =>
        opt.label.toLowerCase().includes(search.toLowerCase())
    )

    const toggleOption = (value) => {
        const newValues = selectedValues.includes(value)
            ? selectedValues.filter(v => v !== value)
            : [...selectedValues, value]
        onChange(newValues)
    }

    return (
        <div className={`relative inline-block text-left ${className}`} ref={dropdownRef}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="btn btn-ghost btn-sm flex items-center gap-2 min-w-[140px] justify-between"
                style={{ textTransform: 'none', fontWeight: 500, letterSpacing: 'normal' }}
            >
                <span className="truncate">
                    {selectedValues.length > 0
                        ? `${label}: ${selectedValues.length} selected`
                        : label}
                </span>
                <ChevronDown size={14} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div
                    className="absolute z-50 mt-2 w-64 origin-top-left rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none animate-slide-down"
                    style={{ border: '1px solid var(--sand-dark)' }}
                >
                    <div className="p-2 border-bottom" style={{ borderBottom: '1px solid var(--sand-light)' }}>
                        <div className="relative">
                            <Search className="absolute left-2 top-2.5 text-stone-light" size={14} style={{ color: 'var(--stone-light)' }} />
                            <input
                                type="text"
                                className="w-full pl-8 pr-3 py-2 text-xs border rounded-md outline-none focus:border-gold"
                                style={{ border: '1px solid var(--sand-dark)', fontSize: '12px' }}
                                placeholder={searchPlaceholder}
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                autoFocus
                            />
                        </div>
                    </div>

                    <div className="max-height-60 overflow-y-auto py-1" style={{ maxHeight: '240px' }}>
                        {filteredOptions.length === 0 ? (
                            <div className="px-4 py-4 text-xs text-center text-stone" style={{ color: 'var(--stone)' }}>
                                No options found
                            </div>
                        ) : (
                            filteredOptions.map((opt) => {
                                const isSelected = selectedValues.includes(opt.value)
                                return (
                                    <label
                                        key={opt.value}
                                        className="flex items-center px-3 py-2 text-xs hover:bg-sand-light cursor-pointer transition-colors"
                                    >
                                        <div
                                            className={`w-4 h-4 rounded border flex items-center justify-center mr-3 transition-colors ${isSelected ? 'bg-teal border-teal' : 'bg-white border-sand-dark'
                                                }`}
                                            style={{
                                                backgroundColor: isSelected ? 'var(--teal)' : 'white',
                                                borderColor: isSelected ? 'var(--teal)' : 'var(--sand-dark)'
                                            }}
                                        >
                                            {isSelected && <Check size={10} color="white" />}
                                        </div>
                                        <input
                                            type="checkbox"
                                            className="hidden"
                                            checked={isSelected}
                                            onChange={() => toggleOption(opt.value)}
                                        />
                                        <span className={`flex-1 truncate ${isSelected ? 'font-semibold' : ''}`} style={{ color: 'var(--charcoal)' }}>
                                            {opt.label}
                                        </span>
                                    </label>
                                )
                            })
                        )}
                    </div>

                    {selectedValues.length > 0 && (
                        <div className="p-2 border-t" style={{ borderTop: '1px solid var(--sand-light)' }}>
                            <button
                                type="button"
                                onClick={() => onChange([])}
                                className="w-full text-center py-1.5 text-[10px] uppercase font-bold tracking-wider text-stone hover:text-charcoal transition-colors"
                                style={{ color: 'var(--stone)' }}
                            >
                                Clear Selected
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
