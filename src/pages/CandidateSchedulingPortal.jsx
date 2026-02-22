import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { format, addDays, getDay, startOfToday, addMinutes } from 'date-fns'
import { Calendar as CalendarIcon, Clock, CheckCircle, AlertCircle } from 'lucide-react'

// Mock fetching free slots from proxy/backend for UI structure
export default function CandidateSchedulingPortal() {
    const { interview_id } = useParams()
    const [interview, setInterview] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    const [selectedDate, setSelectedDate] = useState(null)
    const [selectedSlot, setSelectedSlot] = useState(null)
    const [confirming, setConfirming] = useState(false)
    const [success, setSuccess] = useState(false)

    // Generate 5 dates (skipping weekends typically, but for this demo, just next 5 days)
    const today = startOfToday()
    const availableDates = Array.from({ length: 5 }).map((_, i) => addDays(today, i + 1)).filter(d => getDay(d) !== 0 && getDay(d) !== 6)

    // Mock static slots
    const mockSlots = ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00']

    useEffect(() => {
        fetchInterview()
    }, [])

    const fetchInterview = async () => {
        const { data, error } = await supabase
            .from('interviews')
            .select('*, applications(candidates(full_name), roles(title, department))')
            .eq('id', interview_id)
            .single()

        if (error) {
            console.error(error)
            setError('Interview link not found or expired.')
            setLoading(false)
            return
        }

        if (data.status !== 'pending') {
            setError('This interview has already been scheduled or cancelled.')
        } else {
            setInterview(data)
        }
        setLoading(false)
    }

    const handleConfirm = async () => {
        setConfirming(true)
        // 1. In a real environment, you'd invoke the `schedule-interview` Edge Function here.
        // That function creates the Zoom + MS Calendar events, and pushes a WhatsApp message.

        const [hours, minutes] = selectedSlot.split(':')
        const scheduledAt = new Date(selectedDate)
        scheduledAt.setHours(parseInt(hours), parseInt(minutes), 0, 0)

        // Simulate API call
        setTimeout(async () => {
            // Direct supabase patch for UI simulation (though edge function should really do this)
            await supabase
                .from('interviews')
                .update({
                    status: 'scheduled',
                    scheduled_at: scheduledAt.toISOString(),
                    end_at: addMinutes(scheduledAt, interview?.duration_minutes || 60).toISOString(),
                    meeting_link: 'https://zoom.us/j/mock12345'
                })
                .eq('id', interview_id)

            await supabase
                .from('applications')
                .update({ stage: 'Interview Scheduled' })
                .eq('id', interview.application_id)

            setSuccess(true)
            setConfirming(false)
        }, 1500)
    }

    if (loading) return (
        <div className="min-h-screen bg-sand flex items-center justify-center">
            <span className="spinner" /> Loading scheduling portal...
        </div>
    )

    if (error) return (
        <div className="min-h-screen bg-sand-light flex items-center justify-center p-4">
            <div className="card text-center p-8 max-w-md w-full">
                <AlertCircle size={48} color="var(--alert)" className="mx-auto mb-4" />
                <h2 className="text-xl font-semibold mb-2 text-charcoal">Cannot load availability</h2>
                <p className="text-stone">{error}</p>
            </div>
        </div>
    )

    if (success) return (
        <div className="min-h-screen bg-sand-light flex items-center justify-center p-4">
            <div className="card text-center p-8 max-w-md w-full">
                <CheckCircle size={48} color="var(--teal)" className="mx-auto mb-4" />
                <h2 className="text-xl font-semibold mb-2 text-charcoal">Interview Confirmed!</h2>
                <p className="text-stone mb-6">
                    Your interview for the <strong>{interview.applications.roles.title}</strong> role is set for {format(selectedDate, 'EEEE, MMMM do')} at {selectedSlot}.
                </p>
                <p className="text-sm text-stone-light">
                    We have sent a calendar invitation and meeting link to your email and WhatsApp.
                </p>
            </div>
        </div>
    )

    return (
        <div className="min-h-screen bg-sand-light py-12 px-4 sm:px-6">
            <div className="max-w-3xl mx-auto">
                <div className="text-center mb-8">
                    <div className="brand-wordmark text-3xl mb-1 flex justify-center text-charcoal tracking-wide">Samara</div>
                    <p className="text-stone font-serif italic text-lg tracking-wide">Schedule your interview</p>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-sand-dark overflow-hidden flex flex-col md:flex-row">

                    {/* Left panel */}
                    <div className="bg-sand-light p-8 md:w-1/3 border-b md:border-b-0 md:border-r border-sand-dark">
                        <h3 className="text-xl font-semibold text-charcoal mb-4">
                            {interview.applications.roles.title}
                        </h3>
                        <p className="text-stone-dark text-sm mb-6">Samara Lombok — {interview.applications.roles.department}</p>

                        <div className="flex items-center gap-3 text-stone mb-4">
                            <Clock size={16} />
                            <span className="text-sm">{interview.duration_minutes || 60} minutes</span>
                        </div>
                        <div className="flex items-center gap-3 text-stone mb-4">
                            <VideoIcon icon={<VideoIconSVG />} />
                            <span className="text-sm">Online (Zoom link provided upon confirmation)</span>
                        </div>
                    </div>

                    {/* Right panel */}
                    <div className="p-8 md:w-2/3">
                        <h4 className="font-medium text-charcoal mb-4">Select a Date & Time</h4>

                        <div className="flex gap-2 overflow-x-auto pb-4 mb-6">
                            {availableDates.map((date, i) => {
                                const isSelected = selectedDate === date
                                return (
                                    <button
                                        key={i}
                                        onClick={() => { setSelectedDate(date); setSelectedSlot(null) }}
                                        className={`flex-shrink-0 w-16 p-2 rounded-xl border text-center transition-colors ${isSelected ? 'border-teal bg-teal-bg text-teal' : 'border-stone-light bg-white text-charcoal hover:border-gold'
                                            }`}
                                    >
                                        <div className="text-xs uppercase font-bold opacity-60 mb-1">{format(date, 'MMM')}</div>
                                        <div className="text-xl font-serif">{format(date, 'd')}</div>
                                        <div className="text-[10px] uppercase mt-1 opacity-60">{format(date, 'EEE')}</div>
                                    </button>
                                )
                            })}
                        </div>

                        {selectedDate ? (
                            <div>
                                <h5 className="text-sm text-stone mb-3">Available times for {format(selectedDate, 'EEEE, MMM do')}</h5>
                                <div className="grid grid-cols-3 gap-3">
                                    {mockSlots.map(slot => (
                                        <button
                                            key={slot}
                                            onClick={() => setSelectedSlot(slot)}
                                            className={`py-2 px-3 rounded text-sm font-medium border transition-colors ${selectedSlot === slot
                                                    ? 'border-teal bg-teal text-white'
                                                    : 'border-stone-light text-charcoal hover:border-teal hover:text-teal'
                                                }`}
                                        >
                                            {slot}
                                        </button>
                                    ))}
                                </div>

                                {selectedSlot && (
                                    <div className="mt-8 pt-6 border-t border-sand-dark flex justify-end">
                                        <button
                                            onClick={handleConfirm}
                                            disabled={confirming}
                                            className="btn btn-primary px-8"
                                        >
                                            {confirming ? 'Confirming...' : 'Confirm Interview'}
                                        </button>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="h-32 flex items-center justify-center border-2 border-dashed border-sand-dark rounded-xl text-stone-light text-sm">
                                Select a date to view available times
                            </div>
                        )}
                    </div>

                </div>
            </div>
        </div>
    )
}

function VideoIconSVG() {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="23 7 16 12 23 17 23 7"></polygon>
            <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
        </svg>
    )
}

function VideoIcon({ icon }) {
    return icon
}
