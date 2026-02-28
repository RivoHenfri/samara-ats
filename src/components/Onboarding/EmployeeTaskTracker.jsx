import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { X, CheckCircle2, Circle } from 'lucide-react'

export default function EmployeeTaskTracker({ employee, workflowId, onClose }) {
    const [tasks, setTasks] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (workflowId) {
            fetchTasks()
        }
    }, [workflowId])

    const fetchTasks = async () => {
        setLoading(true)
        const { data, error } = await supabase
            .from('hr_employee_workflow_tasks')
            .select('*')
            .eq('employee_workflow_id', workflowId)
            .order('sort_order', { ascending: true })

        if (!error && data) {
            setTasks(data)
        }
        setLoading(false)
    }

    const toggleTaskStatus = async (task) => {
        const newStatus = task.status === 'completed' ? 'pending' : 'completed'

        // Optimistic UI update
        setTasks(current => current.map(t =>
            t.id === task.id ? { ...t, status: newStatus } : t
        ))

        const { error } = await supabase
            .from('hr_employee_workflow_tasks')
            .update({
                status: newStatus,
                completed_at: newStatus === 'completed' ? new Date().toISOString() : null
            })
            .eq('id', task.id)

        if (error) {
            console.error('Error updating task:', error)
            // Revert on error
            fetchTasks()
        } else {
            checkWorkflowCompletion(task.id, newStatus)
        }
    }

    const checkWorkflowCompletion = async (taskId, lastActionStatus) => {
        // If we just unchecked something, ensure workflow is "In Progress"
        if (lastActionStatus === 'pending') {
            await supabase.from('hr_employee_workflows').update({ status: 'In Progress' }).eq('id', workflowId)
            return
        }

        // Check if all are complete
        const allComplete = tasks.every(t => t.status === 'completed' || (t.id === taskId && lastActionStatus === 'completed'))

        if (allComplete) {
            await supabase.from('hr_employee_workflows').update({
                status: 'Completed',
                completed_at: new Date().toISOString()
            }).eq('id', workflowId)
        } else {
            // Just marking one as completed moves it from Scheduled to In Progress
            await supabase.from('hr_employee_workflows').update({ status: 'In Progress' }).eq('id', workflowId)
        }
    }

    const completedCount = tasks.filter(t => t.status === 'completed').length
    const progressPercent = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0

    return (
        <div className="fixed inset-y-0 right-0 w-[480px] bg-white shadow-2xl z-40 flex flex-col animate-in slide-in-from-right duration-300">

            {/* Header */}
            <div className="p-6 border-b border-gray-100 flex items-start justify-between bg-gray-50">
                <div>
                    <div className="text-xs font-semibold text-[var(--teal)] tracking-wider mb-1 uppercase">
                        Onboarding Tracker
                    </div>
                    <h2 className="text-xl font-serif text-[var(--charcoal)]">
                        {employee.first_name} {employee.last_name}
                    </h2>
                    <div className="text-sm text-gray-500 mt-1 flex items-center gap-2">
                        <span>{employee.role}</span>
                        <span className="w-1 h-1 rounded-full bg-gray-300" />
                        <span>{employee.department}</span>
                    </div>
                </div>
                <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-500">
                    <X size={20} />
                </button>
            </div>

            {/* Progress Bar */}
            <div className="px-6 py-4 border-b border-gray-100">
                <div className="flex justify-between text-sm mb-2">
                    <span className="font-medium text-gray-700">Completion Progress</span>
                    <span className="text-[var(--teal)] font-semibold">{progressPercent}%</span>
                </div>
                <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-[var(--teal)] transition-all duration-500 ease-out"
                        style={{ width: `${progressPercent}%` }}
                    />
                </div>
            </div>

            {/* Task List */}
            <div className="flex-1 overflow-y-auto p-6 space-y-3">
                {loading ? (
                    <div className="text-sm text-gray-400 text-center py-8">Loading tasks...</div>
                ) : tasks.length === 0 ? (
                    <div className="text-sm text-gray-400 text-center py-8">No tasks found for this workflow.</div>
                ) : (
                    tasks.map(task => (
                        <button
                            key={task.id}
                            onClick={() => toggleTaskStatus(task)}
                            className={`w-full text-left p-4 rounded-xl border transition-all flex gap-4 ${task.status === 'completed'
                                ? 'bg-gray-50 border-gray-200'
                                : 'bg-white border-gray-200 hover:border-[var(--teal)] shadow-sm'
                                }`}
                        >
                            <div className="pt-0.5 flex-shrink-0">
                                {task.status === 'completed' ? (
                                    <CheckCircle2 size={20} className="text-[var(--teal)]" />
                                ) : (
                                    <Circle size={20} className="text-gray-300" />
                                )}
                            </div>
                            <div>
                                <div className={`font-medium ${task.status === 'completed' ? 'text-gray-500 line-through' : 'text-[var(--charcoal)]'}`}>
                                    {task.title}
                                </div>
                                {task.description && (
                                    <div className={`text-sm mt-1 ${task.status === 'completed' ? 'text-gray-400' : 'text-gray-500'}`}>
                                        {task.description}
                                    </div>
                                )}
                            </div>
                        </button>
                    ))
                )}
            </div>

        </div>
    )
}
