export type TourViewMode = 'analysis' | 'search' | 'statistics' | 'flowchart' | 'split'

export type TourPlacement = 'auto' | 'top' | 'right' | 'bottom' | 'left'

export type TourAction = 'none' | 'selectFirstTask' | 'selectFirstNode'

export interface TourStep {
  id: string
  sectionId: string
  sectionTitle: string
  title: string
  content: string
  target: string
  view?: TourViewMode
  placement?: TourPlacement
  padding?: number
  action?: TourAction
  optional?: boolean
  sinceVersion?: number
  nextLabel?: string
  prevLabel?: string
}
