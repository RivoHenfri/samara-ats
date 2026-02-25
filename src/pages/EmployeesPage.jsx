import { useState } from 'react'
import OnboardingOverview from '../components/Onboarding/OnboardingOverview'

export default function EmployeesPage() {
    const [activeTab, setActiveTab] = useState('onboarding')

    const tabs = [
        { id: 'people', label: 'PEOPLE DIRECTORY' },
        { id: 'org', label: 'ORG CHART' },
        { id: 'onboarding', label: 'ONBOARDING' },
        { id: 'performance', label: 'PERFORMANCE' }
    ]

    return (
        <div className="flex flex-col h-full bg-[var(--sand)]">
            {/* Header */}
            <div className="px-8 pt-8 pb-4 bg-white border-b border-gray-100 flex-shrink-0">

                {/* Tabs */}
                <div className="flex gap-6 mt-6">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`pb-3 text-sm font-semibold tracking-wider transition-colors relative ${activeTab === tab.id
                                    ? 'text-[var(--charcoal)]'
                                    : 'text-gray-400 hover:text-gray-600'
                                }`}
                        >
                            {tab.label}
                            {activeTab === tab.id && (
                                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--charcoal)]" />
                            )}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-auto bg-[var(--sand)]">
                {activeTab === 'onboarding' && <OnboardingOverview />}

                {/* Placeholder for other tabs */}
                {activeTab !== 'onboarding' && (
                    <div className="flex items-center justify-center h-full text-gray-400">
                        {tabs.find(t => t.id === activeTab)?.label} Module (Coming Soon)
                    </div>
                )}
            </div>
        </div>
    )
}
