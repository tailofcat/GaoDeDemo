# Vue 3 + FastAPI 集成指南

> 将 AmapPicker 组件集成到 Vue 3 + Vite + Element Plus + FastAPI 项目

## 文件结构

```
你的项目/
├── frontend/                    # Vue 3 前端
│   ├── src/
│   │   ├── components/
│   │   │   └── AmapPicker/     # 复制这三个文件
│   │   │       ├── AmapPicker.vue
│   │   │       ├── AmapPickerModal.vue
│   │   │       └── useAmapPicker.js
│   │   └── ...
│   └── package.json
├── backend/                     # FastAPI 后端
│   ├── app/
│   │   ├── routers/
│   │   │   └── amap_proxy.py   # 复制此文件
│   │   └── main.py
│   └── requirements.txt
└── .env
```

---

## 前端集成

### 1. 复制组件文件

将 `vue-components/` 目录下的三个文件复制到你的 Vue 项目：

```bash
# 假设你的 Vue 项目在 frontend/ 目录
mkdir -p frontend/src/components/AmapPicker
cp vue-components/AmapPicker.vue frontend/src/components/AmapPicker/
cp vue-components/AmapPickerModal.vue frontend/src/components/AmapPicker/
cp vue-components/useAmapPicker.js frontend/src/components/AmapPicker/
```

### 2. 在表单中使用

```vue
<template>
  <el-form :model="form">
    <!-- 其他表单项 -->

    <!-- 地图选点组件 -->
    <el-form-item label="站点位置">
      <AmapPicker
        v-model="form.location"
        :api-key="amapConfig.apiKey"
        :security-host="amapConfig.securityHost"
        @confirm="onLocationConfirm"
      />
    </el-form-item>
  </el-form>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import AmapPicker from '@/components/AmapPicker/AmapPicker.vue'

const form = ref({
  name: '',
  location: null  // { lng, lat, isFromGotoBtn }
})

const amapConfig = ref({
  apiKey: '',
  securityHost: '/_AMapService'
})

// 从后端获取配置
onMounted(async () => {
  const res = await fetch('/api/config/amap')
  amapConfig.value = await res.json()
})

const onLocationConfirm = (data) => {
  console.log('选中位置:', data)
}
</script>
```

### 3. 使用组合式函数（可选）

```vue
<script setup>
import { useAmapPicker } from '@/components/AmapPicker/useAmapPicker.js'

const {
  location,
  lng,
  lat,
  hasLocation,
  history,
  openPicker,
  clearLocation
} = useAmapPicker({
  apiKey: 'your_key',
  onConfirm: (data) => console.log('确认:', data),
  onHistoryChange: (h) => console.log('历史:', h)
})
</script>
```

---

## 后端集成

### 1. 复制 FastAPI 路由

```bash
mkdir -p backend/app/routers
cp fastapi-backend/amap_proxy.py backend/app/routers/
```

### 2. 安装依赖

```bash
cd backend
pip install -r ../fastapi-backend/requirements.txt
```

或在现有 `requirements.txt` 中添加：

```
httpx>=0.24.0
pydantic-settings>=2.0.0
```

### 3. 在主应用中挂载路由

```python
# backend/app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import amap_proxy

app = FastAPI()

# CORS 配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Vite 默认端口
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 挂载高德地图代理
app.include_router(amap_proxy.router, prefix="/_AMapService")

# 其他路由...
```

### 4. 环境变量配置

创建 `.env` 文件：

```env
# 高德地图
AMAP_KEY=你的高德地图APIKey
AMAP_SECURITY_KEY=你的安全密钥

# 应用
APP_NAME=My App
DEBUG=false
```

---

## 完整示例页面

```vue
<!-- pages/StationCreate.vue -->
<template>
  <div class="station-create">
    <el-page-header title="新建站点" @back="$router.back()" />

    <el-card class="form-card">
      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-width="100px"
      >
        <el-form-item label="站点名称" prop="name">
          <el-input v-model="form.name" placeholder="请输入站点名称" />
        </el-form-item>

        <el-form-item label="站点位置" prop="location">
          <AmapPicker
            ref="pickerRef"
            v-model="form.location"
            :api-key="amapConfig.apiKey"
            :security-host="amapConfig.securityHost"
            :default-center="[113.337680, 23.141447]"
            :default-zoom="18"
            @confirm="onLocationConfirm"
            @history-change="onHistoryChange"
          />
        </el-form-item>

        <el-form-item label="详细地址" prop="address">
          <el-input
            v-model="form.address"
            type="textarea"
            placeholder="请输入详细地址"
          />
        </el-form-item>

        <el-form-item>
          <el-button type="primary" @click="submitForm">提交</el-button>
          <el-button @click="resetForm">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 显示选中的坐标 -->
    <el-card v-if="form.location" class="result-card">
      <template #header>已选位置信息</template>
      <p>经度: {{ form.location.lng }}</p>
      <p>纬度: {{ form.location.lat }}</p>
      <p>来源: {{ form.location.isFromGotoBtn ? '定位按钮' : '地图点击' }}</p>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import AmapPicker from '@/components/AmapPicker/AmapPicker.vue'

const router = useRouter()
const formRef = ref(null)
const pickerRef = ref(null)

const form = ref({
  name: '',
  location: null,
  address: ''
})

const amapConfig = ref({
  apiKey: '',
  securityHost: '/_AMapService'
})

const rules = {
  name: [{ required: true, message: '请输入站点名称', trigger: 'blur' }],
  location: [{ required: true, message: '请选择站点位置', trigger: 'change' }]
}

onMounted(async () => {
  // 获取高德地图配置
  try {
    const res = await fetch('/api/config/amap')
    amapConfig.value = await res.json()
  } catch (err) {
    console.error('获取地图配置失败:', err)
  }
})

const onLocationConfirm = (data) => {
  ElMessage.success(`已选择位置: ${data.lng.toFixed(6)}, ${data.lat.toFixed(6)}`)
}

const onHistoryChange = (history) => {
  console.log('历史记录变化:', history)
}

const submitForm = async () => {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  // 提交表单...
  console.log('提交数据:', form.value)
  ElMessage.success('提交成功')
}

const resetForm = () => {
  formRef.value?.resetFields()
  pickerRef.value?.clearHistory()
}
</script>

<style scoped>
.station-create {
  padding: 20px;
}
.form-card {
  margin-top: 20px;
  max-width: 800px;
}
.result-card {
  margin-top: 20px;
  max-width: 800px;
}
</style>
```

---

## 注意事项

1. **CORS 配置**：确保 FastAPI 的 CORS 允许前端域名访问
2. **环境变量**：`AMAP_SECURITY_KEY` 只在后端使用，不要暴露到前端
3. **地图脚本**：组件会自动加载高德地图脚本，无需在 `index.html` 中引入
4. **类型支持**：如需 TypeScript 支持，可将 `.js` 改为 `.ts` 并添加类型定义

---

## 迁移对比

| 功能 | 原项目 (原生JS) | 新项目 (Vue3) |
|------|----------------|---------------|
| 组件形式 | UMD 模块 | Vue SFC 组件 |
| 状态管理 | 内部变量 | ref/reactive |
| UI 组件 | 自定义 CSS | Element Plus |
| 事件通信 | EventEmitter | Vue emit |
| 后端代理 | Express 中间件 | FastAPI Router |
| 配置管理 | dotenv | Pydantic Settings |
