import { describe, it, expect } from 'vitest'
import {
    checkStagnation,
    groupByStage,
    getUrgency,
    STAGNATION_THRESHOLDS,
    STAGE_NEXT_ACTION
} from '../stagnationMonitor'

describe('stagnationMonitor', () => {
    const ONE_DAY = 1000 * 60 * 60 * 24

    describe('checkStagnation', () => {
        it('returns an empty array if no applications are provided', () => {
            expect(checkStagnation([])).toEqual([])
            expect(checkStagnation(null)).toEqual([])
        })

        it('ignores terminal stages (Hired, Rejected)', () => {
            const now = Date.now()
            const apps = [
                { id: '1', stage: 'Hired', updated_at: new Date(now - 100 * ONE_DAY).toISOString() },
                { id: '2', stage: 'Rejected', updated_at: new Date(now - 100 * ONE_DAY).toISOString() }
            ]
            expect(checkStagnation(apps)).toEqual([])
        })

        it('identifies stagnant applications based on stage thresholds', () => {
            const now = Date.now()
            const apps = [
                // New threshold is 3 days. This one is 4 days old (stagnant)
                {
                    id: 'app1',
                    stage: 'New',
                    updated_at: new Date(now - 4 * ONE_DAY).toISOString(),
                    candidates: { full_name: 'John Doe' },
                    roles: { title: 'Engineer' }
                },
                // Screening threshold is 5 days. This one is 2 days old (NOT stagnant)
                {
                    id: 'app2',
                    stage: 'Screening',
                    updated_at: new Date(now - 2 * ONE_DAY).toISOString(),
                    candidates: { full_name: 'Jane Smith' },
                    roles: { title: 'Designer' }
                },
            ]

            const alerts = checkStagnation(apps)
            expect(alerts).toHaveLength(1)
            expect(alerts[0].id).toBe('app1')
            expect(alerts[0].candidateName).toBe('John Doe')
            expect(alerts[0].roleTitle).toBe('Engineer')
            expect(alerts[0].threshold).toBe(3)
            expect(alerts[0].nextAction).toBe(STAGE_NEXT_ACTION['New'])
            // daysSinceUpdate comes as an integer (floor), so it should be at least 3
            expect(alerts[0].daysSinceUpdate).toBeGreaterThanOrEqual(3)
        })

        it('sorts alerts by daysSinceUpdate in descending order', () => {
            const now = Date.now()
            const apps = [
                { id: 'a', stage: 'New', updated_at: new Date(now - 4 * ONE_DAY).toISOString() }, // 4 days
                { id: 'b', stage: 'New', updated_at: new Date(now - 10 * ONE_DAY).toISOString() }, // 10 days
                { id: 'c', stage: 'Offer', updated_at: new Date(now - 7 * ONE_DAY).toISOString() } // 7 days
            ]

            const alerts = checkStagnation(apps)
            expect(alerts).toHaveLength(3)
            expect(alerts[0].id).toBe('b') // 10 days
            expect(alerts[1].id).toBe('c') // 7 days 
            expect(alerts[2].id).toBe('a') // 4 days
        })
    })

    describe('groupByStage', () => {
        it('groups alerts by their current stage', () => {
            const mockAlerts = [
                { id: '1', stage: 'New', nextAction: 'Action A' },
                { id: '2', stage: 'New', nextAction: 'Action A' },
                { id: '3', stage: 'Offer', nextAction: 'Action B' }
            ]

            const groups = groupByStage(mockAlerts)

            expect(groups['New'].count).toBe(2)
            expect(groups['New'].alerts).toHaveLength(2)
            expect(groups['New'].nextAction).toBe('Action A')

            expect(groups['Offer'].count).toBe(1)
            expect(groups['Offer'].alerts).toHaveLength(1)
            expect(groups['Offer'].nextAction).toBe('Action B')
        })
    })

    describe('getUrgency', () => {
        it('returns critical if daysSinceUpdate is >= 2x threshold', () => {
            expect(getUrgency({ daysSinceUpdate: 6, threshold: 3 })).toBe('critical')
            expect(getUrgency({ daysSinceUpdate: 10, threshold: 4 })).toBe('critical')
        })

        it('returns warning if daysSinceUpdate is between 1.5x and 2x threshold', () => {
            expect(getUrgency({ daysSinceUpdate: 5, threshold: 3 })).toBe('warning') // 1.66x
            expect(getUrgency({ daysSinceUpdate: 6, threshold: 4 })).toBe('warning') // 1.50x
        })

        it('returns info otherwise', () => {
            expect(getUrgency({ daysSinceUpdate: 3, threshold: 3 })).toBe('info') // 1.0x
            expect(getUrgency({ daysSinceUpdate: 4, threshold: 3 })).toBe('info') // 1.33x
        })
    })
})
