<template>
  <div class="login-container">
    <div class="login-box">
      <div class="login-header">
        <wallet-filled style="font-size: 48px; color: #409eff;" />
        <h1>资产统计系统</h1>
        <p>请登录您的账户</p>
      </div>

      <el-form
        ref="formRef"
        :model="formData"
        :rules="rules"
        @submit.prevent="handleSubmit"
        class="login-form"
      >
        <el-form-item prop="email">
          <el-input
            v-model="formData.email"
            placeholder="邮箱"
            size="large"
            :prefix-icon="User"
          />
        </el-form-item>

        <el-form-item prop="password">
          <el-input
            v-model="formData.password"
            type="password"
            placeholder="密码"
            size="large"
            :prefix-icon="Lock"
            show-password
            @keyup.enter="handleSubmit"
          />
        </el-form-item>

        <el-form-item>
          <el-button
            type="primary"
            size="large"
            :loading="loading"
            @click="handleSubmit"
            style="width: 100%"
          >
            登录
          </el-button>
        </el-form-item>
      </el-form>

      <div class="login-footer">
        <p>安全登录 · 数据加密传输</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { User, Lock, WalletFilled } from '@element-plus/icons-vue'
import axios from 'axios'

const router = useRouter()
const formRef = ref()
const loading = ref(false)

const formData = reactive({
  email: '',
  password: ''
})

const rules = {
  email: [
    { required: true, message: '请输入邮箱', trigger: 'blur' },
    { type: 'email', message: '请输入有效的邮箱地址', trigger: 'blur' }
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, message: '密码至少需要6个字符', trigger: 'blur' }
  ]
}

const handleSubmit = async () => {
  if (!formRef.value) return
  
  try {
    await formRef.value.validate()
    loading.value = true
    
    const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ''
    
    const response = await axios.post(`${API_BASE_URL}/api/auth/login`, {
      email: formData.email,
      password: formData.password
    }, {
      withCredentials: true
    })
    
    const { accessToken } = response.data
    localStorage.setItem('accessToken', accessToken)
    
    ElMessage.success('登录成功')
    router.push('/')
  } catch (err: any) {
    const message = err.response?.data?.error || '登录失败'
    ElMessage.error(message)
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 20px;
}

.login-box {
  background: white;
  padding: 40px;
  border-radius: 16px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  width: 100%;
  max-width: 400px;
}

.login-header {
  text-align: center;
  margin-bottom: 32px;
}

.login-header h1 {
  margin: 16px 0 8px 0;
  font-size: 24px;
  color: #303133;
}

.login-header p {
  color: #909399;
  margin: 0;
}

.login-form {
  margin-top: 24px;
}

.login-footer {
  margin-top: 24px;
  text-align: center;
  color: #909399;
  font-size: 14px;
}

.login-footer p {
  margin: 0;
}
</style>
