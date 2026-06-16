import { ref, computed } from 'vue'
import axios from 'axios'
import type { AssetRecord, AssetFormData } from '../types'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ''

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
})

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Handle token expiration
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config
    
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true
      
      try {
        // Try to refresh token
        const response = await axios.post(`${API_BASE_URL}/api/auth/refresh`, {}, {
          withCredentials: true
        })
        
        const { accessToken } = response.data
        localStorage.setItem('accessToken', accessToken)
        
        // Retry original request
        originalRequest.headers.Authorization = `Bearer ${accessToken}`
        return api(originalRequest)
      } catch (refreshError) {
        // Refresh failed, logout
        localStorage.removeItem('accessToken')
        window.location.href = '/login'
        return Promise.reject(refreshError)
      }
    }
    
    return Promise.reject(error)
  }
)

export function useAssets() {
  const records = ref<AssetRecord[]>([])
  const loading = ref(false)
  const error = ref('')

  const fetchRecords = async () => {
    loading.value = true
    error.value = ''
    try {
      const response = await api.get('/api/assets')
      records.value = response.data.records.map((r: any) => ({
        ...r,
        date: r.date.split('T')[0],
        cash: Number(r.cash),
        longTermInvest: Number(r.longTermInvest),
        stableBond: Number(r.stableBond),
        total: Number(r.total)
      }))
    } catch (err: any) {
      error.value = err.response?.data?.error || '获取数据失败'
      throw err
    } finally {
      loading.value = false
    }
  }

  const addRecord = async (formData: AssetFormData): Promise<{ success: boolean; error?: string }> => {
    try {
      await api.post('/api/assets', formData)
      await fetchRecords()
      return { success: true }
    } catch (err: any) {
      const message = err.response?.data?.error || '添加失败'
      return { success: false, error: message }
    }
  }

  const deleteRecord = async (id: string) => {
    try {
      await api.delete(`/api/assets/${id}`)
      await fetchRecords()
    } catch (err: any) {
      throw new Error(err.response?.data?.error || '删除失败')
    }
  }

  const fillDemoData = async () => {
    const demoData = [
      { date: '2024-01-01', cash: 50000, longTermInvest: 100000, stableBond: 30000, note: '年初盘点' },
      { date: '2024-02-01', cash: 55000, longTermInvest: 105000, stableBond: 30000, note: '月度盘点' },
      { date: '2024-03-01', cash: 60000, longTermInvest: 110000, stableBond: 35000, note: '季度盘点' },
      { date: '2024-04-01', cash: 58000, longTermInvest: 115000, stableBond: 35000, note: '月度盘点' },
      { date: '2024-05-01', cash: 62000, longTermInvest: 120000, stableBond: 40000, note: '月度盘点' },
      { date: '2024-06-01', cash: 65000, longTermInvest: 125000, stableBond: 40000, note: '半年盘点' }
    ]
    
    for (const data of demoData) {
      await api.post('/api/assets', data)
    }
    await fetchRecords()
  }

  // Computed
  const latestRecord = computed(() => records.value[0] || null)
  const sortedRecords = computed(() => [...records.value].sort((a, b) => 
    new Date(b.date).getTime() - new Date(a.date).getTime()
  ))
  const chartData = computed(() => {
    return [...records.value].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    )
  })
  const hasRecords = computed(() => records.value.length > 0)

  return {
    records: sortedRecords,
    latestRecord,
    chartData,
    hasRecords,
    loading,
    error,
    fetchRecords,
    addRecord,
    deleteRecord,
    fillDemoData
  }
}
