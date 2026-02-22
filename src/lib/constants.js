/**
 * Shared constants for pipeline stages, colours, and chart styling.
 * Used by Dashboard, Analytics, and dashboard widgets.
 */

export const STAGES = [
  'New',
  'Screening',
  'Interview Pending',
  'Interview Scheduled',
  'Interview Completed',
  'Offer',
  'Hired',
  'Rejected',
]

// Non-terminal stages (for pipeline health / velocity calculations)
export const ACTIVE_STAGES = STAGES.filter(s => s !== 'Hired' && s !== 'Rejected')

// Samara brand colours for stages
export const STAGE_COLORS = {
  New:                   '#9A8F80',  // stone
  Screening:             '#B8965A',  // gold
  'Interview Pending':   '#4A7C74',  // teal
  'Interview Scheduled': '#4A7C74',
  'Interview Completed': '#4A7C74',
  Offer:                 '#6A9C94',  // teal-light
  Hired:                 '#2A5C54',  // teal-dark
  Rejected:              '#C0614A',  // alert
}

// Stage → CSS class mapping
export const STAGE_CLASS = {
  New:                   'stage-new',
  Screening:             'stage-screening',
  'Interview Pending':   'stage-interview',
  'Interview Scheduled': 'stage-interview',
  'Interview Completed': 'stage-interview',
  Offer:                 'stage-offer',
  Hired:                 'stage-hired',
  Rejected:              'stage-rejected',
}

// Department colours (for pie charts)
export const DEPT_COLORS = ['#B8965A', '#4A7C74', '#9A8F80']

// Shared Recharts tooltip style
export const TOOLTIP_STYLE = {
  contentStyle: {
    background: '#2C2A27',
    border: 'none',
    borderRadius: 8,
    fontSize: 12,
    color: '#F0EBE0',
  },
  labelStyle: { color: '#C5BCB0' },
  itemStyle: { color: '#F0EBE0' },
}

// Department list
export const DEPARTMENTS = ['All', 'Hospitality', 'Operations', 'Construction']
