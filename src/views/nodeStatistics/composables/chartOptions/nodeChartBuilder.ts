import type { NodeStatistics } from '@windsland52/maa-log-parser/node-statistics'
import { formatDuration } from '../../../../utils/formatDuration'
import type { NodeChartDimension } from './dimensions'
import { buildBarBaseOption } from './baseBar'

export const buildNodeChartOption = (
  source: NodeStatistics[],
  dimension: NodeChartDimension,
) => {
  if (source.length === 0) return null

  let title = ''
  let tooltipFormatter: (params: any) => string
  let valueFormatter: (value: number) => string
  let sortFn: (a: NodeStatistics, b: NodeStatistics) => number
  let valueFn: (item: NodeStatistics) => number

  switch (dimension) {
    case 'count':
      title = '节点执行次数排行（Top 10）'
      tooltipFormatter = (params: any) => `${params.name}<br />执行次数：${params.value} 次`
      valueFormatter = (value: number) => `${value} 次`
      sortFn = (a, b) => b.count - a.count
      valueFn = (item) => item.count
      break
    case 'totalDuration':
      title = '节点总耗时排行（Top 10）'
      tooltipFormatter = (params: any) => `${params.name}<br />总耗时：${formatDuration(params.value)}`
      valueFormatter = (value: number) => formatDuration(value)
      sortFn = (a, b) => b.totalDuration - a.totalDuration
      valueFn = (item) => item.totalDuration
      break
    case 'avgDuration':
      title = '节点平均耗时排行（Top 10）'
      tooltipFormatter = (params: any) => `${params.name}<br />平均耗时：${formatDuration(params.value)}`
      valueFormatter = (value: number) => formatDuration(value)
      sortFn = (a, b) => b.avgDuration - a.avgDuration
      valueFn = (item) => item.avgDuration
      break
    case 'maxDuration':
      title = '节点最大耗时排行（Top 10）'
      tooltipFormatter = (params: any) => `${params.name}<br />最大耗时：${formatDuration(params.value)}`
      valueFormatter = (value: number) => formatDuration(value)
      sortFn = (a, b) => b.maxDuration - a.maxDuration
      valueFn = (item) => item.maxDuration
      break
  }

  const top10 = source
    .slice()
    .sort(sortFn)
    .slice(0, 10)

  return buildBarBaseOption(
    title,
    top10.map((item) => ({ name: item.name, value: valueFn(item) })),
    tooltipFormatter,
    valueFormatter,
  )
}
