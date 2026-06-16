<template>
  <div class="app-container">
    <!-- Header -->
    <header class="app-header">
      <div class="header-content">
        <div class="logo">
          <WalletFilled style="font-size: 32px; color: #409eff;" />
          <div class="title">
            <h1>资产统计</h1>
            <p>个人资产管理工具</p>
          </div>
        </div>
        
        <div class="header-actions">
          <div v-if="user" class="user-info">
            <span>{{ user.email }}</span>
            <el-button
              type="danger"
              size="small"
              :icon="SwitchButton"
              @click="handleLogout"
            >
              退出
            </el-button>
          </div>
          <el-button
            v-if="!hasRecords"
            type="primary"
            :icon="DataLine"
            @click="handleFillDemo"
          >
            填充示例数据
          </el-button>
          <el-button
            v-else
            type="danger"
            :icon="DeleteFilled"
            @click="handleClearAll"
          >
            清空数据
          </el-button>
        </div>
      </div>
    </header>

    <!-- Main Content -->
    <main class="main-content">
      <div v-if="loading" class="loading-state">
        <el-skeleton :rows="10" animated />
      </div>
      
      <div v-else-if="error" class="error-state">
        <el-alert
          :title="error"
          type="error"
          :closable="false"
          show-icon
        >
          <template #default>
            <el-button @click="fetchRecords" style="margin-top: 16px">重试</el-button>
          </template>
        </el-alert>
      </div>
      
      <template v-else>
        <!-- Summary Cards -->
        <AssetSummary :latest-record="latestRecord" />

        <!-- Input Form -->
        <AssetForm
          @submit="handleSubmit"
          @fill-demo="handleFillDemo"
        />

        <!-- Chart -->
        <AssetChart
          :chart-data="chartData"
          @fill-demo="handleFillDemo"
        />

        <!-- List -->
        <AssetList
          :records="records"
          @delete="handleDelete"
          @fill-demo="handleFillDemo"
        />
      </template>
    </main>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { WalletFilled, DataLine, DeleteFilled, SwitchButton } from '@element-plus/icons-vue'
import { useAssets } from '../composables/useAssets'
import type { AssetFormData } from '../types'
import axios from 'axios'
import AssetSummary from '../components/AssetSummary.vue'
import AssetForm from '../components/AssetForm.vue'
import AssetChart from '../components/AssetChart.vue'
import AssetList from '../components/AssetList.vue'

const router = useRouter()
const { records, latestRecord, chartData, hasRecords, loading, error, fetchRecords, addRecord, deleteRecord, fillDemoData } = useAssets()

const user = ref<{ id: string; email: string } | null>(null)

const fetchUser = async () => {
  try {
    const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ''
    const token = localStorage.getItem('accessToken')
    
    const response = await axios.get(`${API_BASE_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    
    user.value = response.data.user
  } catch (err) {
    // User not logged in, router guard will handle redirect
  }
}

const handleSubmit = async (formData: AssetFormData) => {
  const result = await addRecord(formData)
  if (result.success) {
    ElMessage.success('添加成功')
  } else {
    ElMessage.error(result.error || '添加失败')
  }
}

const handleDelete = async (id: string) => {
  try {
    await ElMessageBox.confirm(
      '确定要删除这条记录吗？',
      '确认删除',
      {
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    await deleteRecord(id)
    ElMessage.success('删除成功')
  } catch (err) {
    // Cancelled
  }
}

const handleFillDemo = async () => {
  try {
    await fillDemoData()
    ElMessage.success('示例数据已填充')
  } catch (err: any) {
    ElMessage.error(err.message || '填充失败')
  }
}

const handleClearAll = async () => {
  try {
    await ElMessageBox.confirm(
      '确定要清空所有记录吗？此操作不可恢复。',
      '确认清空',
      {
        confirmButtonText: '清空',
        cancelButtonText: '取消',
        type: 'danger'
      }
    )
    
    // Delete all records one by one
    for (const record of records.value) {
      await deleteRecord(record.id)
    }
    ElMessage.success('数据已清空')
  } catch (err) {
    // Cancelled
  }
}

const handleLogout = async () => {
  try {
    const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ''
    
    await axios.post(`${API_BASE_URL}/api/auth/logout`, {}, {
      withCredentials: true
    })
    
    localStorage.removeItem('accessToken')
    ElMessage.success('已退出登录')
    router.push('/login')
  } catch (err) {
    localStorage.removeItem('accessToken')
    router.push('/login')
  }
}

onMounted(() => {
  fetchUser()
  fetchRecords()
})
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  background-color: #f5f7fa;
  min-height: 100vh;
}

.app-container {
  min-height: 100vh;
}

.app-header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 20px 0;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
}

.header-content {
  max-width: 1400px;
  margin: 0 auto;
  padding: 0 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.logo {
  display: flex;
  align-items: center;
  gap: 16px;
}

.title h1 {
  font-size: 24px;
  font-weight: 600;
  margin: 0;
}

.title p {
  font-size: 14px;
  opacity: 0.9;
  margin: 4px 0 0 0;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 16px;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 12px;
  color: white;
}

.main-content {
  max-width: 1400px;
  margin: 0 auto;
  padding: 24px 20px;
}

.loading-state,
.error-state {
  padding: 40px 0;
}

@media (max-width: 768px) {
  .header-content {
    flex-direction: column;
    gap: 16px;
    text-align: center;
  }

  .logo {
    flex-direction: column;
  }

  .header-actions {
    flex-direction: column;
    width: 100%;
  }

  .user-info {
    flex-direction: column;
  }

  .main-content {
    padding: 16px 12px;
  }
}
</style>
