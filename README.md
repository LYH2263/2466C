# 资产统计网站

## 项目类型
- Type: A) FULLSTACK_WEB

## 技术栈
- **Frontend**: Vue 3 + Vite + TypeScript + Element Plus + Apache ECharts
- **Backend**: Node.js 20 + Express + TypeScript + Prisma
- **Database**: PostgreSQL 15
- **Authentication**: JWT (access token) + Refresh Token (HttpOnly Cookie)
- **Security**: bcrypt + helmet + cors + express-rate-limit

## 系统架构
```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Frontend   │────>│   Backend   │────>│  Database   │
│   :3010     │     │   :8010     │     │   :5432     │
└─────────────┘     └─────────────┘     └─────────────┘
```

> 前端 nginx 已配置反向代理，`/api/*` 请求自动转发至后端容器，无需额外跨域配置。

## 快速启动
1. 确保 Docker Desktop / Docker Engine 可用
2. 在根目录执行：`docker compose up`
3. 等待服务启动（约30秒）
4. 访问地址：
   - **前端**：http://localhost:3010
   - **后端 API**：http://localhost:8010

### 端口说明
当前 docker-compose.yml 配置端口映射如下：

| 服务 | 容器端口 | 宿主机端口 | 说明 |
|------|----------|------------|------|
| 前端 (nginx) | 3000 | **3010** | 含 /api 反向代理到后端 |
| 后端 (Express) | 8000 | **8010** | REST API 服务 |
| 数据库 (PostgreSQL) | 5432 | 不暴露 | 仅容器内部访问 |

> 如需更改端口，修改 `docker-compose.yml` 中的 `ports` 映射即可。

## 👤 测试账号
> 测试账号仅在 README 中提供，登录页不展示明文凭据。

- **邮箱**: admin@example.com
- **密码**: admin123

> 系统启动时自动创建默认管理员账号，无需手动执行 seed 脚本。

## 功能清单

### 原有功能 (F1-F8)
- [x] F1: 资产录入表单 - 支持日期、活钱、长期投资、稳定债券、备注输入
- [x] F2: 资产历史列表 - 按日期倒序展示，支持删除单条记录
- [x] F3: 折线图展示 - 显示4条曲线（活钱/长期投资/稳定债券/总资产）
- [x] F4: 顶部汇总卡片 - 显示最新数据及各类别占比
- [x] F5: 数据持久化 - PostgreSQL数据库存储
- [x] F6: 数据校验与错误提示 - 前后端双重校验
- [x] F7: 响应式设计 - 桌面端和移动端均正常显示
- [x] F8: 演示数据能力 - 提供"填充示例数据"按钮

### 新增安全功能
- [x] 用户登录/注册
- [x] JWT Token认证 (15分钟有效期)
- [x] Refresh Token自动续期 (HttpOnly Cookie)
- [x] 密码bcrypt哈希存储 (cost=12)
- [x] 登录失败锁定 (5次失败锁定15分钟)
- [x] 接口限流保护 (登录1分钟5次，刷新1分钟20次)
- [x] 用户数据隔离 (只能访问自己的资产记录)
- [x] 路由守卫 (未登录自动跳转登录页)

## API文档

### 认证接口
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/auth/register | 用户注册 |
| POST | /api/auth/login | 用户登录 |
| POST | /api/auth/refresh | 刷新Token |
| POST | /api/auth/logout | 退出登录 |
| GET | /api/auth/me | 获取当前用户 |

### 资产接口 (需认证)
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/assets | 获取资产列表 |
| POST | /api/assets | 新增资产记录 |
| DELETE | /api/assets/:id | 删除资产记录 |

## 安全特性

### 密码安全
- 使用 bcrypt 哈希，cost factor = 12
- 密码最小长度 6 位

### 登录保护
- 连续 5 次登录失败锁定账号 15 分钟
- 登录接口限流：1 分钟最多 5 次

### Token策略
- Access Token: JWT，15 分钟有效期，存储在内存
- Refresh Token: 随机字符串，7 天有效期，HttpOnly Cookie
- SameSite=Lax 防止 CSRF

### 数据隔离
- 所有资产记录关联 userId
- 用户只能操作自己的数据
- 跨用户访问返回 403

## 自测说明

### 成功路径
1. 访问 http://localhost:3010，自动跳转登录页
2. 使用测试账号登录
3. 查看资产统计页面
4. 点击"填充示例数据"，查看折线图
5. 添加新资产记录
6. 刷新页面，数据仍然存在
7. 点击退出登录

### 失败路径
1. 输入错误密码，显示错误提示
2. 连续5次错误密码，账号被锁定15分钟
3. 未登录直接访问 /，自动跳转登录页
4. 添加资产时三类金额都为0，显示校验错误

### 安全测试
1. 登录后复制Token，在另一浏览器使用，验证权限
2. 尝试删除其他用户的资产记录，返回403
3. 登录后等待15分钟，验证自动刷新Token

## 证据文件
- evidence/01_boot.png: Docker 启动成功
- evidence/02_login.png: 登录页面
- evidence/03_dashboard.png: 资产统计页面
- evidence/04_chart.png: 折线图显示
- evidence/05_validation.png: 错误密码提示
- evidence/06_security.png: 账号锁定提示

## 项目结构
```
.
├── docker-compose.yml      # Docker编排
├── frontend/               # Vue3前端
│   ├── src/
│   │   ├── views/         # 页面组件
│   │   ├── components/    # 业务组件
│   │   └── composables/   # 组合式函数
│   └── Dockerfile
├── backend/               # Express后端
│   ├── src/
│   │   ├── routes/       # API路由
│   │   └── middleware/   # 中间件
│   ├── prisma/           # 数据库模型
│   └── Dockerfile
└── db/                   # 数据库初始化
    └── init/
```

## 技术决策
- **不使用 localStorage 存储敏感数据**：Token仅保存在内存，Refresh Token使用HttpOnly Cookie
- **前后端分离**：前端3010端口（nginx反向代理），后端8010端口
- **数据库优先**：Prisma ORM + PostgreSQL，支持数据迁移
