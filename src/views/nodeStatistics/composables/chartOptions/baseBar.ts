export const buildBarBaseOption = (
  title: string,
  data: Array<{ name: string; value: number }>,
  tooltipFormatter: (params: any) => string,
  valueFormatter: (value: number) => string,
) => ({
  title: {
    text: title,
    left: 'center',
    top: 0,
    textStyle: {
      fontSize: 14,
      fontWeight: 600,
    },
  },
  grid: {
    left: 136,
    right: 68,
    top: 48,
    bottom: 16,
    containLabel: false,
  },
  tooltip: {
    trigger: 'axis',
    axisPointer: {
      type: 'shadow',
    },
    formatter: (items: any[]) => {
      const first = Array.isArray(items) ? items[0] : items
      return tooltipFormatter(first)
    },
  },
  xAxis: {
    type: 'value',
    axisLabel: {
      color: '#9aa4b2',
    },
    splitLine: {
      lineStyle: {
        color: 'rgba(148, 163, 184, 0.16)',
      },
    },
  },
  yAxis: {
    type: 'category',
    inverse: true,
    data: data.map((item) => item.name),
    axisTick: {
      show: false,
    },
    axisLine: {
      show: false,
    },
    axisLabel: {
      width: 120,
      overflow: 'truncate',
      color: '#cbd5e1',
      fontSize: 12,
    },
  },
  series: [
    {
      type: 'bar',
      data: data.map((item) => item.value),
      barWidth: 16,
      itemStyle: {
        borderRadius: [0, 8, 8, 0],
        color: '#5aa9e6',
      },
      emphasis: {
        itemStyle: {
          color: '#7cc4f8',
        },
      },
      label: {
        show: true,
        position: 'right',
        color: '#cbd5e1',
        formatter: ({ value }: { value: number }) => valueFormatter(value),
      },
    },
  ],
  animationDuration: 250,
})

export const adaptChartForMobile = (option: any, isMobile: boolean) => {
  if (!option || !isMobile) return option
  return {
    ...option,
    grid: {
      ...option.grid,
      left: 110,
      right: 52,
      top: 44,
      bottom: 8,
    },
    yAxis: {
      ...option.yAxis,
      axisLabel: {
        ...option.yAxis?.axisLabel,
        width: 92,
        fontSize: 11,
      },
    },
    series: option.series.map((seriesItem: any) => ({
      ...seriesItem,
      barWidth: 14,
      label: {
        ...seriesItem.label,
        fontSize: 11,
      },
    })),
  }
}
