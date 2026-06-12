<!--
  AmapPickerModal - 地图选窗组件
  内部组件，由 AmapPicker 调用
-->
<template>
  <el-dialog
    v-model="dialogVisible"
    title="选择地图位置"
    width="90%"
    :close-on-click-modal="false"
    destroy-on-close
    class="amap-picker-dialog"
    @opened="handleOpened"
    @closed="handleClosed"
  >
    <div class="map-container-wrapper">
      <el-alert
        title="点击地图任意位置选点"
        type="info"
        :closable="false"
        class="map-tip"
      />
      <div ref="mapRef" class="map-container"></div>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <div class="selected-info">
          <span>当前选择：</span>
          <el-tag v-if="selectedLng !== null" type="primary">
            {{ selectedLng.toFixed(6) }}, {{ selectedLat.toFixed(6) }}
          </el-tag>
          <el-tag v-else type="info">未选择</el-tag>
        </div>
        <div class="dialog-actions">
          <el-button @click="dialogVisible = false">取消</el-button>
          <el-button
            type="primary"
            :disabled="selectedLng === null"
            @click="handleConfirm"
          >
            确认
          </el-button>
        </div>
      </div>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  apiKey: {
    type: String,
    required: true
  },
  securityHost: {
    type: String,
    default: '/_AMapService'
  },
  defaultCenter: {
    type: Array,
    default: () => [113.337680, 23.141447]
  },
  defaultZoom: {
    type: Number,
    default: 18
  },
  history: {
    type: Array,
    default: () => []
  },
  initialLng: {
    type: Number,
    default: null
  },
  initialLat: {
    type: Number,
    default: null
  },
  isFromGoto: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:visible', 'select', 'confirm'])

// 弹窗可见性
const dialogVisible = ref(props.visible)

watch(() => props.visible, (val) => {
  dialogVisible.value = val
})

watch(dialogVisible, (val) => {
  emit('update:visible', val)
})

// 地图相关
const mapRef = ref(null)
let map = null
let marker = null
let infoWindow = null
let historyMarkers = []

// 选中坐标
const selectedLng = ref(null)
const selectedLat = ref(null)

// 弹窗打开后初始化地图
const handleOpened = () => {
  nextTick(() => {
    initMap()
  })
}

// 弹窗关闭后清理
const handleClosed = () => {
  selectedLng.value = null
  selectedLat.value = null
  if (marker) {
    map?.remove(marker)
    marker = null
  }
  if (infoWindow) {
    infoWindow.close()
  }
  // 清理历史标记
  historyMarkers.forEach(m => {
    map?.remove(m)
  })
  historyMarkers = []
}

// 初始化地图
const initMap = () => {
  if (!mapRef.value) return

  // 设置安全配置
  if (props.securityHost) {
    window._AMapSecurityConfig = {
      serviceHost: props.securityHost
    }
  }

  // 检查 AMap 是否已加载
  if (!window.AMap) {
    loadAMapScript().then(() => {
      createMap()
    }).catch(err => {
      console.error('加载高德地图失败:', err)
      ElMessage.error('加载地图失败，请检查网络连接')
    })
  } else {
    createMap()
  }
}

// 加载高德地图脚本
const loadAMapScript = () => {
  return new Promise((resolve, reject) => {
    // 检查是否已存在脚本
    const existingScript = document.querySelector(`script[src*="webapi.amap.com/maps"]`)
    if (existingScript) {
      // 等待脚本加载完成
      const checkAMap = setInterval(() => {
        if (window.AMap) {
          clearInterval(checkAMap)
          resolve()
        }
      }, 100)
      // 10秒超时
      setTimeout(() => {
        clearInterval(checkAMap)
        if (!window.AMap) {
          reject(new Error('AMap load timeout'))
        }
      }, 10000)
      return
    }

    const script = document.createElement('script')
    script.type = 'text/javascript'
    script.src = `https://webapi.amap.com/maps?v=2.0&key=${props.apiKey}`
    script.onload = () => {
      resolve()
    }
    script.onerror = () => {
      reject(new Error('Failed to load AMap script'))
    }
    document.head.appendChild(script)
  })
}

// 创建地图实例
const createMap = () => {
  const AMap = window.AMap
  if (!AMap) {
    console.error('AMap not available')
    return
  }

  // 确定中心点
  const center = (props.initialLng !== null && props.initialLat !== null)
    ? [props.initialLng, props.initialLat]
    : props.defaultCenter

  // 创建地图
  map = new AMap.Map(mapRef.value, {
    viewMode: '2D',
    zoom: props.defaultZoom,
    center: center
  })

  // 加载插件
  AMap.plugin(['AMap.Scale', 'AMap.MapType', 'AMap.Geolocation', 'AMap.InfoWindow'], () => {
    // 添加比例尺
    map.addControl(new AMap.Scale())

    // 添加地图类型切换
    map.addControl(new AMap.MapType())

    // 添加定位控件
    const geolocation = new AMap.Geolocation({
      enableHighAccuracy: true,
      timeout: 10000,
      zoomToAccuracy: true,
      buttonPosition: 'RB'
    })
    map.addControl(geolocation)

    // 创建信息窗口
    infoWindow = new AMap.InfoWindow({
      offset: new AMap.Pixel(0, -30)
    })

    // 绑定地图点击事件
    map.on('click', handleMapClick)

    // 显示历史标记
    showHistoryMarkers()

    // 如果有初始坐标，显示标记
    if (props.initialLng !== null && props.initialLat !== null) {
      showMarkerOnMap(props.initialLng, props.initialLat)
    }
  })
}

// 地图点击处理
const handleMapClick = (e) => {
  const lng = e.lnglat.getLng()
  const lat = e.lnglat.getLat()

  selectedLng.value = lng
  selectedLat.value = lat

  // 移除旧标记
  if (marker) {
    map.remove(marker)
  }

  // 添加新标记
  marker = new window.AMap.Marker({
    position: e.lnglat,
    title: '选点位置'
  })
  map.add(marker)

  // 显示信息窗口
  infoWindow.setContent(`
    <div style="padding: 10px;">
      <p><strong>经度:</strong> ${lng.toFixed(6)}</p>
      <p><strong>纬度:</strong> ${lat.toFixed(6)}</p>
    </div>
  `)
  infoWindow.open(map, e.lnglat)

  // 触发选择事件
  emit('select', { lng, lat, isFromGotoBtn: false })
}

// 显示历史记录标记
const showHistoryMarkers = () => {
  if (!map || !window.AMap) return

  const AMap = window.AMap

  // 清除旧的历史标记
  historyMarkers.forEach(m => {
    map.remove(m)
  })
  historyMarkers = []

  // 添加所有历史记录标记
  props.history.forEach((item, index) => {
    const isRed = item.isFromGotoBtn === true
    const iconUrl = isRed
      ? 'https://webapi.amap.com/theme/v1.3/markers/n/mark_r.png'
      : 'https://webapi.amap.com/theme/v1.3/markers/n/mark_b.png'

    const historyMarker = new AMap.Marker({
      position: [item.lng, item.lat],
      title: isRed ? `定位位置 ${index + 1}` : `历史位置 ${index + 1}`,
      icon: new AMap.Icon({
        size: new AMap.Size(20, 28),
        image: iconUrl,
        imageSize: new AMap.Size(20, 28)
      })
    })
    map.add(historyMarker)
    historyMarkers.push(historyMarker)
  })
}

// 在地图上显示红色标记（定位按钮来源）
const showMarkerOnMap = (lng, lat) => {
  if (!map || !window.AMap) return

  const AMap = window.AMap
  const position = new AMap.LngLat(lng, lat)

  // 更新选中信息
  selectedLng.value = lng
  selectedLat.value = lat

  // 移除旧标记
  if (marker) {
    map.remove(marker)
  }

  // 添加红色标记
  marker = new AMap.Marker({
    position: position,
    title: '定位位置',
    icon: new AMap.Icon({
      size: new AMap.Size(25, 34),
      image: 'https://webapi.amap.com/theme/v1.3/markers/n/mark_r.png',
      imageSize: new AMap.Size(25, 34)
    })
  })
  map.add(marker)

  // 地图中心移到该位置
  map.setCenter(position)
  map.setZoom(props.defaultZoom)

  // 显示信息窗口
  infoWindow.setContent(`
    <div style="padding: 10px;">
      <p><strong>经度:</strong> ${lng.toFixed(6)}</p>
      <p><strong>纬度:</strong> ${lat.toFixed(6)}</p>
    </div>
  `)
  infoWindow.open(map, position)
}

// 确认选点
const handleConfirm = () => {
  if (selectedLng.value === null || selectedLat.value === null) return

  emit('confirm', {
    lng: selectedLng.value,
    lat: selectedLat.value,
    isFromGotoBtn: props.isFromGoto
  })

  dialogVisible.value = false
}
</script>

<style scoped>
.amap-picker-dialog :deep(.el-dialog__body) {
  padding: 0;
}

.map-container-wrapper {
  position: relative;
  height: 500px;
}

.map-tip {
  position: absolute;
  top: 10px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 10;
  width: auto;
  min-width: 200px;
  text-align: center;
}

.map-container {
  width: 100%;
  height: 100%;
}

.dialog-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.selected-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.dialog-actions {
  display: flex;
  gap: 12px;
}
</style>
