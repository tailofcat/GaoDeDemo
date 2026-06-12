<!--
  AmapPicker - Vue 3 地图选点组件
  适配 Element Plus + Vue 3 Composition API
-->
<template>
  <div class="amap-picker">
    <!-- 坐标输入区域 -->
    <el-card class="picker-section">
      <template #header>
        <span>{{ titles.coordSection }}</span>
      </template>

      <el-form :model="form" label-width="60px" size="default">
        <el-form-item label="经度">
          <el-input
            v-model="form.lng"
            type="number"
            step="0.000001"
            :placeholder="placeholder.lng"
            @keyup.enter="handleLocate"
          />
        </el-form-item>
        <el-form-item label="纬度">
          <el-input
            v-model="form.lat"
            type="number"
            step="0.000001"
            :placeholder="placeholder.lat"
            @keyup.enter="handleLocate"
          />
        </el-form-item>
      </el-form>

      <el-button
        type="primary"
        style="width: 100%"
        @click="handleLocate"
      >
        定位
      </el-button>
    </el-card>

    <!-- 地图选点区域 -->
    <el-card class="picker-section">
      <template #header>
        <span>{{ titles.mapSection }}</span>
      </template>

      <el-text type="info" size="small" style="display: block; margin-bottom: 10px;">
        {{ titles.mapTip }}
      </el-text>

      <!-- 预览框 -->
      <div
        class="preview-box"
        :class="{ 'has-location': hasLocation }"
        @click="openModal"
      >
        <div v-if="!hasLocation" class="preview-empty">
          <el-icon :size="32" class="preview-icon"><Location /></el-icon>
          <span class="preview-text">点击选择地图位置</span>
        </div>
        <div v-else class="preview-content">
          <div ref="previewMapRef" class="preview-map"></div>
          <div class="preview-overlay">
            <span class="preview-coords">
              经度: {{ currentLng.toFixed(6) }}, 纬度: {{ currentLat.toFixed(6) }}
            </span>
          </div>
        </div>
      </div>

      <!-- 历史记录 -->
      <div class="history-section">
        <div class="history-header">
          <span>已选位置记录</span>
          <el-button
            v-if="history.length > 0"
            type="danger"
            link
            size="small"
            @click="clearHistory"
          >
            清空
          </el-button>
        </div>

        <el-empty v-if="history.length === 0" description="暂无选点记录" />

        <div v-else class="history-list">
          <div
            v-for="(item, index) in history"
            :key="index"
            class="history-item"
          >
            <div class="history-info">
              <div class="history-coords">
                经度: {{ item.lng.toFixed(6) }}, 纬度: {{ item.lat.toFixed(6) }}
              </div>
              <div class="history-time">{{ item.time }}</div>
            </div>
            <div class="history-actions">
              <el-button
                type="primary"
                link
                size="small"
                @click="useHistory(item)"
              >
                使用
              </el-button>
              <el-button
                type="danger"
                link
                size="small"
                @click="deleteHistory(index)"
              >
                删除
              </el-button>
            </div>
          </div>
        </div>
      </div>
    </el-card>

    <!-- 地图弹窗 -->
    <AmapPickerModal
      v-model:visible="modalVisible"
      :api-key="apiKey"
      :security-host="securityHost"
      :default-center="defaultCenter"
      :default-zoom="defaultZoom"
      :history="history"
      :initial-lng="initialLng"
      :initial-lat="initialLat"
      :is-from-goto="isFromGoto"
      @select="handleSelect"
      @confirm="handleConfirm"
    />
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { Location } from '@element-plus/icons-vue'
import AmapPickerModal from './AmapPickerModal.vue'

const props = defineProps({
  // 高德地图 API Key
  apiKey: {
    type: String,
    required: true
  },
  // 安全代理路径
  securityHost: {
    type: String,
    default: '/_AMapService'
  },
  // 默认中心点
  defaultCenter: {
    type: Array,
    default: () => [113.337680, 23.141447]
  },
  // 默认缩放级别
  defaultZoom: {
    type: Number,
    default: 18
  },
  // 输入框占位符
  placeholder: {
    type: Object,
    default: () => ({
      lng: '113.337680',
      lat: '23.141447'
    })
  },
  // 区域标题
  titles: {
    type: Object,
    default: () => ({
      coordSection: '规划站点坐标',
      mapSection: '选址地图',
      mapTip: '点击地图插入候选站点'
    })
  },
  // 初始值（用于 v-model）
  modelValue: {
    type: Object,
    default: () => null
  }
})

const emit = defineEmits(['update:modelValue', 'select', 'confirm', 'historyChange'])

// 表单数据
const form = ref({
  lng: '',
  lat: ''
})

// 当前选中的坐标
const currentLng = ref(null)
const currentLat = ref(null)
const hasLocation = computed(() => currentLng.value !== null && currentLat.value !== null)

// 弹窗控制
const modalVisible = ref(false)
const initialLng = ref(null)
const initialLat = ref(null)
const isFromGoto = ref(false)

// 历史记录
const history = ref([])

// 预览地图
const previewMapRef = ref(null)
let previewMap = null
let previewMarkers = []

// 监听 v-model 变化
watch(() => props.modelValue, (val) => {
  if (val && val.lng !== undefined && val.lat !== undefined) {
    form.value.lng = val.lng
    form.value.lat = val.lat
    currentLng.value = parseFloat(val.lng)
    currentLat.value = parseFloat(val.lat)
    nextTick(() => initPreviewMap())
  }
}, { immediate: true })

// 定位按钮点击
const handleLocate = () => {
  const lngVal = form.value.lng || props.placeholder.lng
  const latVal = form.value.lat || props.placeholder.lat
  const lng = parseFloat(lngVal)
  const lat = parseFloat(latVal)

  if (isNaN(lng) || isNaN(lat)) {
    ElMessage.error('请输入有效的经纬度坐标')
    return
  }

  if (lng < -180 || lng > 180 || lat < -90 || lat > 90) {
    ElMessage.error('经度范围：-180 到 180，纬度范围：-90 到 90')
    return
  }

  // 回填输入框
  form.value.lng = lng
  form.value.lat = lat

  // 标记为来自定位按钮
  isFromGoto.value = true
  initialLng.value = lng
  initialLat.value = lat

  // 打开弹窗
  modalVisible.value = true
}

// 打开弹窗（预览框点击）
const openModal = () => {
  isFromGoto.value = false
  initialLng.value = parseFloat(form.value.lng) || null
  initialLat.value = parseFloat(form.value.lat) || null
  modalVisible.value = true
}

// 处理地图选点
const handleSelect = (data) => {
  emit('select', data)
}

// 确认选点
const handleConfirm = (data) => {
  const { lng, lat, isFromGotoBtn } = data

  // 更新当前值
  currentLng.value = lng
  currentLat.value = lat
  form.value.lng = lng
  form.value.lat = lat

  // 更新 v-model
  emit('update:modelValue', { lng, lat, isFromGotoBtn })
  emit('confirm', data)

  // 添加到历史记录
  addToHistory(lng, lat, isFromGotoBtn)

  // 初始化预览地图
  nextTick(() => initPreviewMap())
}

// 添加到历史记录
const addToHistory = (lng, lat, isFromGotoBtn) => {
  history.value.unshift({
    lng,
    lat,
    time: new Date().toLocaleString('zh-CN'),
    isFromGotoBtn
  })
  emit('historyChange', [...history.value])
}

// 使用历史记录
const useHistory = (item) => {
  currentLng.value = item.lng
  currentLat.value = item.lat
  form.value.lng = item.lng
  form.value.lat = item.lat
  emit('update:modelValue', { lng: item.lng, lat: item.lat, isFromGotoBtn: item.isFromGotoBtn })
  nextTick(() => initPreviewMap())
}

// 删除历史记录
const deleteHistory = (index) => {
  history.value.splice(index, 1)
  emit('historyChange', [...history.value])
}

// 清空历史记录
const clearHistory = () => {
  history.value = []
  emit('historyChange', [])
  ElMessage.success('历史记录已清空')
}

// 初始化预览地图
const initPreviewMap = () => {
  if (!previewMapRef.value || !window.AMap) return
  if (!hasLocation.value) return

  // 销毁旧地图
  if (previewMap) {
    previewMap.destroy()
    previewMap = null
  }
  previewMarkers = []

  nextTick(() => {
    const AMap = window.AMap
    previewMap = new AMap.Map(previewMapRef.value, {
      viewMode: '2D',
      zoom: props.defaultZoom,
      center: [currentLng.value, currentLat.value],
      dragEnable: false,
      zoomEnable: false,
      doubleClickZoom: false,
      keyboardEnable: false
    })

    // 添加所有历史记录标记
    history.value.forEach((item) => {
      const isRed = item.isFromGotoBtn === true
      const iconUrl = isRed
        ? 'https://webapi.amap.com/theme/v1.3/markers/n/mark_r.png'
        : 'https://webapi.amap.com/theme/v1.3/markers/n/mark_b.png'

      const marker = new AMap.Marker({
        position: [item.lng, item.lat],
        title: isRed ? '定位位置' : '历史位置',
        icon: new AMap.Icon({
          size: new AMap.Size(20, 28),
          image: iconUrl,
          imageSize: new AMap.Size(20, 28)
        })
      })
      marker.setMap(previewMap)
      previewMarkers.push(marker)
    })
  })
}

// 暴露方法给父组件
defineExpose({
  open: (lng, lat) => {
    if (lng !== undefined && lat !== undefined) {
      form.value.lng = lng
      form.value.lat = lat
      isFromGoto.value = true
      initialLng.value = parseFloat(lng)
      initialLat.value = parseFloat(lat)
    } else {
      isFromGoto.value = false
      initialLng.value = parseFloat(form.value.lng) || null
      initialLat.value = parseFloat(form.value.lat) || null
    }
    modalVisible.value = true
  },
  close: () => {
    modalVisible.value = false
  },
  getHistory: () => [...history.value],
  clearHistory,
  locate: (lng, lat) => {
    form.value.lng = lng
    form.value.lat = lat
    handleLocate()
  }
})
</script>

<style scoped>
.amap-picker {
  max-width: 800px;
  margin: 0 auto;
}

.picker-section {
  margin-bottom: 20px;
}

.preview-box {
  width: 100%;
  height: 180px;
  border: 2px dashed var(--el-border-color);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.3s;
  background: var(--el-fill-color-light);
  position: relative;
  overflow: hidden;
}

.preview-box:hover {
  border-color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}

.preview-box.has-location {
  border-style: solid;
  border-color: var(--el-color-success);
  background: var(--el-color-success-light-9);
  padding: 0;
}

.preview-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.preview-icon {
  color: var(--el-text-color-secondary);
}

.preview-text {
  color: var(--el-text-color-regular);
  font-size: 14px;
}

.preview-content {
  width: 100%;
  height: 100%;
  position: relative;
  pointer-events: none;
}

.preview-map {
  width: 100%;
  height: 100%;
  border-radius: 6px;
}

.preview-overlay {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: linear-gradient(transparent, rgba(0, 0, 0, 0.7));
  padding: 30px 12px 12px;
  color: white;
  z-index: 10;
}

.preview-coords {
  font-size: 13px;
  font-family: monospace;
}

.history-section {
  margin-top: 20px;
}

.history-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  font-weight: 500;
}

.history-list {
  max-height: 300px;
  overflow-y: auto;
}

.history-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  border-bottom: 1px solid var(--el-border-color-lighter);
  transition: background 0.2s;
}

.history-item:hover {
  background: var(--el-fill-color-light);
}

.history-item:last-child {
  border-bottom: none;
}

.history-coords {
  font-family: monospace;
  font-size: 13px;
  color: var(--el-text-color-primary);
}

.history-time {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-top: 4px;
}

.history-actions {
  display: flex;
  gap: 8px;
}
</style>
