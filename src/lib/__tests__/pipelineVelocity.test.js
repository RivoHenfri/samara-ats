import { describe, it, expect, vi } from 'vitest'
import { computeVelocity } from '../pipelineVelocity'
import { supabase } from '../supabase'
import { ACTIVE_STAGES } from '../constants'
import { STAGNATION_THRESHOLDS } from '../stagnationMonitor'

// Mock the external supabase import
vi.mock('../supabase', () => ({
    supabase: {
        from: vi.fn(),
    }
}))

describe('pipelineVelocity', () => {
    const ONE_DAY = 1000 * 60 * 60 * 24

    it('handles empty database returns safely', async () => {
        // Setup mock to return no transitions
        const fromMock = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            gte: vi.fn().mockReturnThis(),
            lte: vi.fn().mockReturnThis(),
            order: vi.fn().mockResolvedValue({ data: [], error: null })
        }
        supabase.from.mockReturnValue(fromMock)

        const dateRange = { start: new Date(), end: new Date() }
        const result = await computeVelocity(dateRange)

        expect(result.bottleneck).toBeNull()
        expect(result.stageMetrics).toHaveLength(ACTIVE_STAGES.length)
        expect(result.stageMetrics[0].medianDays).toBeNull()
        expect(result.stageMetrics[0].conversionRate).toBeNull()
        expect(result.stageMetrics[0].sampleSize).toBe(0)
    })

    it('correctly calculates pipeline velocity from transition history', async () => {
        // Mock 3 days of transition data for a single application
        // Let's say App1: New -> Screening -> Interview Pending
        const baseTime = Date.now()
        const mockTransitions = [
            {
                application_id: 'app1',
                previous_stage: 'New',
                new_stage: 'Screening',   // Spent 1 day in New
                action_type: 'STAGE_MOVED',
                created_at: new Date(baseTime + 1 * ONE_DAY).toISOString()
            },
            {
                application_id: 'app1',
                previous_stage: 'Screening', // Spent 4 days in Screening
                new_stage: 'Interview Pending',
                action_type: 'STAGE_MOVED',
                created_at: new Date(baseTime + 5 * ONE_DAY).toISOString()
            }
        ]

        const fromMock = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            gte: vi.fn().mockReturnThis(),
            lte: vi.fn().mockReturnThis(),
            order: vi.fn().mockResolvedValue({ data: mockTransitions, error: null })
        }
        supabase.from.mockReturnValue(fromMock)

        const dateRange = { start: new Date(), end: new Date() }
        const result = await computeVelocity(dateRange)

        // Check New metrics: should have 1 transition with ~0 conversion time because there is no prior enter time available for the first ever stage in this isolated slice. Let's see how `computeVelocity` handles the absolute first stage for an app.
        // Looking at the implementation of `computeVelocity`:
        // enteredAt = i > 0 ? timeline[i-1].created_at : null
        // Which means if a stage is the FIRST transition in the sliced array, its entry time is assumed null and it's ignored for dwell time calculations.

        // Thus `New` should essentially have medianDays = null due to missing entry timestamp, but conversion rate 100
        const newStage = result.stageMetrics.find(m => m.stage === 'New')
        expect(newStage.medianDays).toBeNull() // No prior entry time in the mocked snippet
        expect(newStage.conversionRate).toBe(100) // 1 moved forward, 0 rejected

        // But for `Screening`, we DO have an entry time (the transition INTO Screening)
        // Entered Screening at base + 1 day
        // Left Screening at base + 5 day
        // Dwell = 4 days
        const screeningStage = result.stageMetrics.find(m => m.stage === 'Screening')
        expect(screeningStage.medianDays).toBe(4)
        expect(screeningStage.conversionRate).toBe(100)
        expect(screeningStage.sampleSize).toBe(1)

        // 4 days in Screening is less than threshold of 5 so healthy
        expect(screeningStage.health).toBe('warning') // 4 >= 5 * 0.7 (3.5)

        // And bottleneck should be Screening
        expect(result.bottleneck.stage).toBe('Screening')
        expect(result.bottleneck.medianDays).toBe(4)
    })
})
