import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { X } from 'lucide-react'

export default function AssignTemplateModal({ employee, onClose, onSuccess }) {
    const [templates, setTemplates] = useState([])
    const [selectedTemplate, setSelectedTemplate] = useState(null)
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        fetchTemplates()
    }, [])

    const fetchTemplates = async () => {
        // Assuming standard public schema if RLS is setup or hr if using explicit schema
        const { data, error } = await supabase
            .from('hr_workflow_templates')
            .select('*')
            .order('name')

        if (!error && data) {
            setTemplates(data)
        }
    }

    const handleAssign = async () => {
        if (!selectedTemplate) return
        setLoading(true)

        try {
            // 1. Create the employee_workflow instance
            const { data: workflow, error: workflowError } = await supabase
                .from('hr_employee_workflows')
                .insert({
                    employee_id: employee.id,
                    template_id: selectedTemplate.id,
                    status: 'Scheduled'
                })
                .select()
                .single()

            if (workflowError) throw workflowError

            // 2. Fetch the blueprint tasks for this template
            const { data: blueprintTasks, error: tasksError } = await supabase
                .from('hr_workflow_template_tasks')
                .select('*')
                .eq('template_id', selectedTemplate.id)

            if (tasksError) throw tasksError

            // 3. Instantiate the tasks for this specific employee
            if (blueprintTasks && blueprintTasks.length > 0) {
                const instantiatedTasks = blueprintTasks.map(task => ({
                    employee_workflow_id: workflow.id,
                    title: task.title,
                    description: task.description,
                    is_required: task.is_required,
                    sort_order: task.sort_order,
                    status: 'pending'
                }))

                const { error: insertError } = await supabase
                    .from('hr_employee_workflow_tasks')
                    .insert(instantiatedTasks)

                if (insertError) throw insertError
            }

            // 4. Update employee record status
            await supabase
                .from('hr_employee_records')
                .update({ status: 'Scheduled' })
                .eq('id', employee.id)

            onSuccess()
        } catch (error) {
            console.error('Error assigning template:', error)
            alert('Failed to assign template. See console for details.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">

                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-100">
                    <div>
                        <h3 className="text-xl font-serif text-[var(--charcoal)]">Assign Onboarding</h3>
                        <p className="text-sm text-gray-500 mt-1">
                            Select a workflow template for {employee.first_name} {employee.last_name}
                        </p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
                    {templates.length === 0 ? (
                        <div className="text-sm text-gray-500 text-center py-4">Loading templates...</div>
                    ) : (
                        templates.map(template => (
                            <label
                                key={template.id}
                                className={`flex gap-3 p-4 rounded-lg border cursor-pointer transition-all ${selectedTemplate?.id === template.id
                                    ? 'border-[var(--teal)] bg-[var(--teal)]/5'
                                    : 'border-gray-200 hover:border-gray-300'
                                    }`}
                            >
                                <input
                                    type="radio"
                                    name="template"
                                    className="mt-1"
                                    checked={selectedTemplate?.id === template.id}
                                    onChange={() => setSelectedTemplate(template)}
                                />
                                <div>
                                    <div className="font-medium text-[var(--charcoal)]">{template.name}</div>
                                    <div className="text-sm text-gray-500 mt-1">{template.description}</div>
                                </div>
                            </label>
                        ))
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-[var(--charcoal)]"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleAssign}
                        disabled={!selectedTemplate || loading}
                        className="px-6 py-2 bg-[var(--teal)] text-white rounded-lg text-sm font-medium hover:bg-teal-700 disabled:opacity-50 transition-colors"
                    >
                        {loading ? 'Assigning...' : 'Assign Template'}
                    </button>
                </div>
            </div>
        </div>
    )
}
