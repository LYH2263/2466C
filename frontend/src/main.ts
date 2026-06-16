import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import App from './App.vue'
import Login from './views/Login.vue'
import Dashboard from './views/Dashboard.vue'

// Route guard
const requireAuth = (to: any, from: any, next: any) => {
  const token = localStorage.getItem('accessToken')
  if (token) {
    next()
  } else {
    next('/login')
  }
}

const requireGuest = (to: any, from: any, next: any) => {
  const token = localStorage.getItem('accessToken')
  if (token) {
    next('/')
  } else {
    next()
  }
}

const routes = [
  {
    path: '/login',
    component: Login,
    beforeEnter: requireGuest
  },
  {
    path: '/',
    component: Dashboard,
    beforeEnter: requireAuth
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

const app = createApp(App)

// Register all icons
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}

app.use(ElementPlus)
app.use(router)
app.mount('#app')
