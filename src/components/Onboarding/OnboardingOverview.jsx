import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { FolderOpen, ChevronRight, User } from 'lucide-react'
import AssignTemplateModal from './AssignTemplateModal'
import EmployeeTaskTracker from './EmployeeTaskTracker'

export default function OnboardingOverview() {
    const [employees, setEmployees] = useState([])
    const [loading, setLoading] = useState(true)
    const [activeBucket, setActiveBucket] = useState('Pending')
    const [selectedEmployeeForAssign, setSelectedEmployeeForAssign] = useState(null)
    const [selectedWorkflowForTracking, setSelectedWorkflowForTracking] = useState(null)

    useEffect(() => {
        fetchOnboardingData()
    }, [])

    const fetchOnboardingData = async () => {
        try {
            setLoading(true)
            // Fetch employees and their workflows.
            // We join employee_workflows to get status.
            const { data, error } = await supabase
                .from('hr_employee_records')
                .select(`
          *,
          employee_workflows:hr_employee_workflows!employee_id (
            status,
            id,
            template_id
          )
        `)
                .order('created_at', { ascending: false })

            if (error) {
                // Fallback for schema difference during development if hr. employee_records isn't mapped directly
                console.error('Initial fetch failed, trying direct select', error)

                // Let's try specifying the schema explicitly
                const { data: hrData, error: hrError } = await supabase
                    .schema('hr')
                    .from('employee_records')
                    .select(`
              *,
              employee_workflows (
                status,
                id,
                template_id
              )
            `)
                    .order('created_at', { ascending: false })

                if (hrError) throw hrError
                setEmployees(hrData || [])
            } else {
                setEmployees(data || [])
            }
        } catch (err) {
            console.error('Error fetching onboarding data:', err)
        } finally {
            setLoading(false)
        }
    }

    // Derived state for the buckets
    const pending = employees.filter(e => e.status === 'Pending' || e.employee_workflows?.length === 0)
    const scheduled = employees.filter(e => e.employee_workflows?.[0]?.status === 'Scheduled')
    const inProgress = employees.filter(e => e.employee_workflows?.[0]?.status === 'In Progress')
    const completed = employees.filter(e => e.employee_workflows?.[0]?.status === 'Completed')

    const buckets = {
        'Pending': pending,
        'Scheduled': scheduled,
        'In Progress': inProgress,
        'Completed': completed
    }

    const activeEmployees = buckets[activeBucket] || []

    if (loading) {
        return <div className="p-8 text-gray-400">Loading onboarding data...</div>
    }

    return (
        <div className="flex gap-8 p-8 h-full bg-[var(--sand)]">

            {/* Sidebar Buckets */}
            <div className="w-[280px] flex-shrink-0 flex flex-col gap-2">

                <div className="mb-6">
                    <h2 className="text-3xl font-serif text-[var(--charcoal)] mb-2">Onboarding</h2>
                    <p className="text-sm text-gray-500">Track the progress of the onboarding workflows in the company</p>
                </div>

                <Bucket title="Pending" count={pending.length} active={activeBucket === 'Pending'} onClick={() => setActiveBucket('Pending')} />
                <Bucket title="Scheduled" count={scheduled.length} active={activeBucket === 'Scheduled'} onClick={() => setActiveBucket('Scheduled')} />
                <Bucket title="In Progress" count={inProgress.length} active={activeBucket === 'In Progress'} onClick={() => setActiveBucket('In Progress')} />
                <Bucket title="Completed" count={completed.length} active={activeBucket === 'Completed'} onClick={() => setActiveBucket('Completed')} />
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col pt-6 pr-8">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-medium text-[var(--charcoal)]">{activeBucket} Onboarding</h3>
                    <span className="text-sm text-gray-500">{activeEmployees.length} employees</span>
                </div>

                {activeEmployees.length === 0 ? (
                    <div className="m-auto flex flex-col items-center text-center justify-center max-w-sm mt-20">
                        <div className="relative mb-6">
                            <div className="absolute inset-0 bg-[#F4DECF] rounded-full blur-xl opacity-60"></div>
                            <FolderOpen size={64} className="text-[#C6A478] relative z-10" fill="#C6A478" />
                        </div>
                        <h3 className="text-lg font-medium text-[var(--charcoal)] mb-2">No employees</h3>
                        <p className="text-sm text-gray-500">
                            There are currently no employees in the {activeBucket} stage.
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                        {activeEmployees.map(emp => (
                            <EmployeeCard
                                key={emp.id}
                                employee={emp}
                                bucket={activeBucket}
                                onAssign={() => setSelectedEmployeeForAssign(emp)}
                                onTrack={() => setSelectedWorkflowForTracking({
                                    emp,
                                    workflowId: emp.employee_workflows[0].id
                                })}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Modals & Trackers */}
            {selectedEmployeeForAssign && (
                <AssignTemplateModal
                    employee={selectedEmployeeForAssign}
                    onClose={() => setSelectedEmployeeForAssign(null)}
                    onSuccess={() => {
                        setSelectedEmployeeForAssign(null)
                        fetchOnboardingData() // Refresh list
                        setActiveBucket('Scheduled') // Move them visually to the next step
                    }}
                />
            )}

            {selectedWorkflowForTracking && (
                <>
                    <div
                        className="fixed inset-0 bg-black/20 z-30 transition-opacity"
                        onClick={() => {
                            setSelectedWorkflowForTracking(null)
                            fetchOnboardingData() // Refresh list on close to update status if changed
                        }}
                    />
                    <EmployeeTaskTracker
                        employee={selectedWorkflowForTracking.emp}
                        workflowId={selectedWorkflowForTracking.workflowId}
                        onClose={() => {
                            setSelectedWorkflowForTracking(null)
                            fetchOnboardingData() // Refresh list on close
                        }}
                    />
                </>
            )}

        </div>
    )
}

function Bucket({ title, count, active, onClick }) {
    return (
        <button
            onClick={onClick}
            className={`
        w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all text-left
        ${active ? 'bg-[#E5E5E5] text-[var(--charcoal)] font-medium' : 'hover:bg-gray-100 text-gray-600'}
      `}
        >
            <span className="text-sm">{title}</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-white bg-opacity-50">
                ({count})
            </span>
        </button>
    )
}

function EmployeeCard({ employee, bucket, onAssign, onTrack }) {
    return (
        <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
            <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[var(--teal)]/10 text-[var(--teal)] flex items-center justify-center">
                        <User size={20} />
                    </div>
                    <div>
                        <div className="font-semibold text-[var(--charcoal)]">{employee.first_name} {employee.last_name}</div>
                        <div className="text-sm text-gray-500">{employee.role} &bull; {employee.department}</div>
                    </div>
                </div>
                <div className="text-xs font-medium text-[var(--teal)] bg-[var(--teal)]/10 px-2 py-1 rounded">
                    {bucket}
                </div>
            </div>

            <div className="mt-4 pt-4 border-t border-gray-50 flex justify-end">
                {bucket === 'Pending' ? (
                    <button
                        onClick={onAssign}
                        className="text-sm font-medium text-[var(--teal)] hover:text-teal-700 flex items-center gap-1 transition-colors"
                    >
                        Assign Onboarding <ChevronRight size={16} />
                    </button>
                ) : (
                    <button
                        onClick={onTrack}
                        className="text-sm font-medium text-[var(--charcoal)] hover:text-black flex items-center gap-1 transition-colors"
                    >
                        View Tracker <ChevronRight size={16} />
                    </button>
                )}
            </div>
        </div>
    )
}
