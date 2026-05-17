import type { RecognitionActionStatistics } from '@windsland52/maa-log-parser/node-statistics'
import { formatDuration } from '../../../../utils/formatDuration'
import type { RecognitionActionChartDimension } from './dimensions'
import { buildBarBaseOption } from './baseBar'

export const buildRecognitionActionChartOption = (
  source: RecognitionActionStatistics[],
  dimension: RecognitionActionChartDimension,
) => {
  if (source.length === 0) return null

  let title = ''
  let tooltipFormatter: (params: any) => string
  let valueFormatter: (value: number) => string
  let sortFn: (a: RecognitionActionStatistics, b: RecognitionActionStatistics) => number
  let valueFn: (item: RecognitionActionStatistics) => number
  let filterFn: (item: RecognitionActionStatistics) => boolean = () => true

  switch (dimension) {
    case 'avgRecognitionDuration':
      title = '平均识别耗时排行（Top 10）'
      tooltipFormatter = (params: any) => `${params.name}<br />平均识别耗时：${formatDuration(params.value)}`
      valueFormatter = (value: number) => formatDuration(value)
      sortFn = (a, b) => b.avgRecognitionDuration - a.avgRecognitionDuration
      valueFn = (item) => item.avgRecognitionDuration
      filterFn = (item) => item.recognitionCount > 0
      break
    case 'maxRecognitionDuration':
      title = '最大识别耗时排行（Top 10）'
      tooltipFormatter = (params: any) => `${params.name}<br />最大识别耗时：${formatDuration(params.value)}`
      valueFormatter = (value: number) => formatDuration(value)
      sortFn = (a, b) => b.maxRecognitionDuration - a.maxRecognitionDuration
      valueFn = (item) => item.maxRecognitionDuration
      filterFn = (item) => item.recognitionCount > 0
      break
    case 'avgActionDuration':
      title = '平均动作耗时排行（Top 10）'
      tooltipFormatter = (params: any) => `${params.name}<br />平均动作耗时：${formatDuration(params.value)}`
      valueFormatter = (value: number) => formatDuration(value)
      sortFn = (a, b) => b.avgActionDuration - a.avgActionDuration
      valueFn = (item) => item.avgActionDuration
      filterFn = (item) => item.actionCount > 0
      break
    case 'maxActionDuration':
      title = '最大动作耗时排行（Top 10）'
      tooltipFormatter = (params: any) => `${params.name}<br />最大动作耗时：${formatDuration(params.value)}`
      valueFormatter = (value: number) => formatDuration(value)
      sortFn = (a, b) => b.maxActionDuration - a.maxActionDuration
      valueFn = (item) => item.maxActionDuration
      filterFn = (item) => item.actionCount > 0
      break
    case 'avgRecognitionAttempts':
      title = '平均识别尝试次数排行（Top 10）'
      tooltipFormatter = (params: any) => `${params.name}<br />平均识别尝试：${Number(params.value).toFixed(1)} 次`
      valueFormatter = (value: number) => `${value.toFixed(1)} 次`
      sortFn = (a, b) => b.avgRecognitionAttempts - a.avgRecognitionAttempts
      valueFn = (item) => item.avgRecognitionAttempts
      break
  }

  const top10 = source
    .slice()
    .filter(filterFn)
    .sort(sortFn)
    .slice(0, 10)

  if (top10.length === 0) return null

  return buildBarBaseOption(
    title,
    top10.map((item) => ({ name: item.name, value: valueFn(item) })),
    tooltipFormatter,
    valueFormatter,
  )
}
