<template>
  <div class="asset-form">
    <el-card class="form-card">
      <template #header>
        <div class="card-header">
          <span>资产录入</span>
        </div>
      </template>

      <el-form :model="formData" label-position="top" @submit.prevent="handleSubmit">
        <el-row :gutter="20">
          <el-col :xs="24" :sm="12">
            <el-form-item label="盘点日期" required>
              <el-date-picker
                v-model="formData.date"
                type="date"
                placeholder="选择日期"
                format="YYYY-MM-DD"
                value-format="YYYY-MM-DD"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="20">
          <el-col :xs="24" :sm="8">
            <el-form-item label="活钱（元）">
              <el-input-number
                v-model="formData.cash"
                :precision="2"
                :min="0"
                :step="1000"
                placeholder="0.00"
                style="width: 100%"
                controls-position="right"
              />
            </el-form-item>
          </el-col>
          
          <el-col :xs="24" :sm="8">
            <el-form-item label="长期投资（元）">
              <el-input-number
                v-model="formData.longTermInvest"
                :precision="2"
                :min="0"
                :step="1000"
                placeholder="0.00"
                style="width: 100%"
                controls-position="right"
              />
            </el-form-item>
          </el-col>
          
          <el-col :xs="24" :sm="8">
            <el-form-item label="稳定债券（元）">
              <el-input-number
                v-model="formData.stableBond"
                :precision="2"
                :min="0"
                :step="1000"
                placeholder="0.00"
                style="width: 100%"
                controls-position="right"
              />
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item label="备注">
          <el-input
            v-model="formData.note"
            type="textarea"
            :rows="2"
            placeholder="可选，最多100字"
            maxlength="100"
            show-word-limit
          />
        </el-form-item>

        <el-form-item>
          <el-button type="primary" native-type="submit" :icon="Plus">新增记录</el-button>
          <el-button :icon="DataLine" @click="$emit('fill-demo')">填充示例数据</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { reactive } from 'vue'
import { Plus, DataLine } from '@element-plus/icons-vue'
import type { AssetFormData } from '../types'

const emit = defineEmits<{
  submit: [data: AssetFormData]
  'fill-demo': []
}>()

const formData = reactive<AssetFormData>({
  date: new Date().toISOString().split('T')[0],
  cash: null,
  longTermInvest: null,
  stableBond: null,
  note: ''
})

const handleSubmit = () => {
  emit('submit', { ...formData })
  // Reset amounts but keep date
  formData.cash = null
  formData.longTermInvest = null
  formData.stableBond = null
  formData.note = ''
}
</script>

<style scoped>
.asset-form {
  margin-bottom: 20px;
}

.card-header {
  font-size: 16px;
  font-weight: 600;
}
</style>
