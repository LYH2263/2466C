<template>
  <div class="asset-list">
    <el-card class="list-card">
      <template #header>
        <div class="card-header">
          <span>资产历史记录</span>
          <el-tag v-if="records.length > 0" type="info">共 {{ records.length }} 条</el-tag>
        </div>
      </template>

      <div v-if="records.length === 0" class="empty-state">
        <el-empty description="暂无记录">
          <el-button type="primary" @click="$emit('fill-demo')">填充示例数据</el-button>
        </el-empty>
      </div>

      <el-table
        v-else
        :data="records"
        style="width: 100%"
        stripe
        border
        :default-sort="{ prop: 'date', order: 'descending' }"
      >
        <el-table-column prop="date" label="日期" width="120" sortable />
        
        <el-table-column label="活钱" min-width="120">
          <template #default="{ row }">
            <span class="money cash">{{ formatMoney(row.cash) }}</span>
          </template>
        </el-table-column>

        <el-table-column label="长期投资" min-width="120">
          <template #default="{ row }">
            <span class="money invest">{{ formatMoney(row.longTermInvest) }}</span>
          </template>
        </el-table-column>

        <el-table-column label="稳定债券" min-width="120">
          <template #default="{ row }">
            <span class="money bond">{{ formatMoney(row.stableBond) }}</span>
          </template>
        </el-table-column>

        <el-table-column label="总资产" min-width="120">
          <template #default="{ row }">
            <span class="money total">{{ formatMoney(row.total) }}</span>
          </template>
        </el-table-column>

        <el-table-column prop="note" label="备注" min-width="150" show-overflow-tooltip />

        <el-table-column label="操作" width="100" fixed="right">
          <template #default="{ row }">
            <el-button
              type="danger"
              size="small"
              :icon="Delete"
              @click="handleDelete(row)"
            >删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { Delete } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { AssetRecord } from '../types'

interface Props {
  records: AssetRecord[]
}

defineProps<Props>()

const emit = defineEmits<{
  delete: [id: string]
  'fill-demo': []
}>()

const formatMoney = (value: number): string => {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    minimumFractionDigits: 2
  }).format(value)
}

const handleDelete = (row: AssetRecord) => {
  ElMessageBox.confirm(
    `确定要删除 ${row.date} 的记录吗？`,
    '确认删除',
    {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning'
    }
  )
    .then(() => {
      emit('delete', row.id)
      ElMessage.success('删除成功')
    })
    .catch(() => {
      // Cancelled
    })
}
</script>

<style scoped>
.asset-list {
  margin-bottom: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 16px;
  font-weight: 600;
}

.empty-state {
  padding: 60px 0;
}

.money {
  font-family: 'Courier New', monospace;
  font-weight: 600;
}

.cash {
  color: #67c23a;
}

.invest {
  color: #e6a23c;
}

.bond {
  color: #409eff;
}

.total {
  color: #f56c6c;
  font-weight: 700;
}
</style>
