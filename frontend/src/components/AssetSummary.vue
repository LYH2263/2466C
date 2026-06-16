<template>
  <div class="asset-summary">
    <el-row :gutter="20">
      <el-col :xs="24" :sm="12" :md="6">
        <el-card class="summary-card cash-card" shadow="hover">
          <div class="card-content">
            <div class="card-icon"><Wallet /></div>
            <div class="card-info">
              <div class="label">活钱</div>
              <div class="value" v-if="latestRecord">{{ formatMoney(latestRecord.cash) }}</div>
              <div class="value empty" v-else>--</div>
              <div class="percent" v-if="latestRecord && latestRecord.total > 0">
                {{ ((latestRecord.cash / latestRecord.total) * 100).toFixed(1) }}%
              </div>
            </div>
          </div>
        </el-card>
      </el-col>

      <el-col :xs="24" :sm="12" :md="6">
        <el-card class="summary-card invest-card" shadow="hover">
          <div class="card-content">
            <div class="card-icon"><TrendCharts /></div>
            <div class="card-info">
              <div class="label">长期投资</div>
              <div class="value" v-if="latestRecord">{{ formatMoney(latestRecord.longTermInvest) }}</div>
              <div class="value empty" v-else>--</div>
              <div class="percent" v-if="latestRecord && latestRecord.total > 0">
                {{ ((latestRecord.longTermInvest / latestRecord.total) * 100).toFixed(1) }}%
              </div>
            </div>
          </div>
        </el-card>
      </el-col>

      <el-col :xs="24" :sm="12" :md="6">
        <el-card class="summary-card bond-card" shadow="hover">
          <div class="card-content">
            <div class="card-icon"><Money /></div>
            <div class="card-info">
              <div class="label">稳定债券</div>
              <div class="value" v-if="latestRecord">{{ formatMoney(latestRecord.stableBond) }}</div>
              <div class="value empty" v-else>--</div>
              <div class="percent" v-if="latestRecord && latestRecord.total > 0">
                {{ ((latestRecord.stableBond / latestRecord.total) * 100).toFixed(1) }}%
              </div>
            </div>
          </div>
        </el-card>
      </el-col>

      <el-col :xs="24" :sm="12" :md="6">
        <el-card class="summary-card total-card" shadow="hover">
          <div class="card-content">
            <div class="card-icon"><Coin /></div>
            <div class="card-info">
              <div class="label">总资产</div>
              <div class="value total" v-if="latestRecord">{{ formatMoney(latestRecord.total) }}</div>
              <div class="value empty" v-else>--</div>
              <div class="date" v-if="latestRecord">{{ latestRecord.date }}</div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { Wallet, TrendCharts, Money, Coin } from '@element-plus/icons-vue'
import type { AssetRecord } from '../types'

interface Props {
  latestRecord: AssetRecord | null
}

defineProps<Props>()

const formatMoney = (value: number): string => {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    minimumFractionDigits: 2
  }).format(value)
}
</script>

<style scoped>
.asset-summary {
  margin-bottom: 20px;
}

.summary-card {
  margin-bottom: 20px;
}

.card-content {
  display: flex;
  align-items: center;
  gap: 16px;
}

.card-icon {
  font-size: 32px;
  color: #409eff;
  display: flex;
  align-items: center;
}

.cash-card .card-icon {
  color: #67c23a;
}

.invest-card .card-icon {
  color: #e6a23c;
}

.bond-card .card-icon {
  color: #409eff;
}

.total-card .card-icon {
  color: #f56c6c;
}

.card-info {
  flex: 1;
}

.label {
  font-size: 14px;
  color: #606266;
  margin-bottom: 4px;
}

.value {
  font-size: 20px;
  font-weight: 600;
  color: #303133;
}

.value.total {
  font-size: 24px;
  color: #f56c6c;
}

.value.empty {
  color: #c0c4cc;
}

.percent {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
}

.date {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
}
</style>
