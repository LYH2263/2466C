<template>
  <div class="asset-chart">
    <el-card class="chart-card">
      <template #header>
        <div class="card-header">
          <span>资产趋势图</span>
        </div>
      </template>

      <div v-if="chartData.length === 0" class="empty-state">
        <el-empty description="暂无数据，请先添加资产记录或填充示例数据">
          <el-button type="primary" @click="$emit('fill-demo')">填充示例数据</el-button>
        </el-empty>
      </div>

      <v-chart
        v-else
        class="chart"
        :option="chartOption"
        autoresize
      />
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart } from 'echarts/charts'
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  TitleComponent,
  DataZoomComponent
} from 'echarts/components'
import VChart from 'vue-echarts'
import type { AssetRecord } from '../types'

use([
  CanvasRenderer,
  LineChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  TitleComponent,
  DataZoomComponent
])

interface Props {
  chartData: AssetRecord[]
}

const props = defineProps<Props>()

defineEmits<{
  'fill-demo': []
}>()

const chartOption = computed(() => {
  const dates = props.chartData.map(r => r.date)
  const cashData = props.chartData.map(r => r.cash)
  const investData = props.chartData.map(r => r.longTermInvest)
  const bondData = props.chartData.map(r => r.stableBond)
  const totalData = props.chartData.map(r => r.total)

  return {
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'cross'
      },
      formatter: (params: any[]) => {
        let html = `<div style="font-weight:600;margin-bottom:5px;">${params[0].axisValue}</div>`
        params.forEach(p => {
          html += `<div style="display:flex;align-items:center;gap:8px;margin:3px 0;">
            <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${p.color}"></span>
            <span>${p.seriesName}: ¥${p.value.toLocaleString()}</span>
          </div>`
        })
        return html
      }
    },
    legend: {
      data: ['活钱', '长期投资', '稳定债券', '总资产'],
      bottom: 0
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '15%',
      top: '10%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: dates,
      axisLabel: {
        rotate: 45
      }
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        formatter: (value: number) => {
          if (value >= 10000) {
            return (value / 10000).toFixed(0) + '万'
          }
          return value
        }
      }
    },
    dataZoom: [
      {
        type: 'inside',
        start: 0,
        end: 100
      }
    ],
    series: [
      {
        name: '活钱',
        type: 'line',
        smooth: true,
        data: cashData,
        itemStyle: { color: '#67c23a' },
        lineStyle: { width: 3 },
        symbol: 'circle',
        symbolSize: 6
      },
      {
        name: '长期投资',
        type: 'line',
        smooth: true,
        data: investData,
        itemStyle: { color: '#e6a23c' },
        lineStyle: { width: 3 },
        symbol: 'circle',
        symbolSize: 6
      },
      {
        name: '稳定债券',
        type: 'line',
        smooth: true,
        data: bondData,
        itemStyle: { color: '#409eff' },
        lineStyle: { width: 3 },
        symbol: 'circle',
        symbolSize: 6
      },
      {
        name: '总资产',
        type: 'line',
        smooth: true,
        data: totalData,
        itemStyle: { color: '#f56c6c' },
        lineStyle: { width: 4, type: 'dashed' },
        symbol: 'circle',
        symbolSize: 8
      }
    ]
  }
})
</script>

<style scoped>
.asset-chart {
  margin-bottom: 20px;
}

.chart-card {
  min-height: 400px;
}

.card-header {
  font-size: 16px;
  font-weight: 600;
}

.chart {
  height: 400px;
}

.empty-state {
  height: 400px;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
