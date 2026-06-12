/**
 * useAmapPicker - 地图选点组合式函数
 *
 * 用于在 Vue 3 组件中复用地图选点逻辑
 * 可与 AmapPicker 组件配合使用，或独立使用
 *
 * @example
 * // 基础用法
 * const { location, openPicker, confirmLocation } = useAmapPicker({
 *   apiKey: 'your_key',
 *   onConfirm: (data) => console.log(data)
 * })
 *
 * // 与组件 ref 配合使用
 * const pickerRef = ref(null)
 * const { history, clearHistory } = useAmapPicker({
 *   pickerRef,
 *   onHistoryChange: (h) => console.log('历史:', h)
 * })
 */

import { ref, computed } from 'vue'

/**
 * 创建地图选点组合式函数
 * @param {Object} options - 配置选项
 * @returns {Object} 响应式状态和方法
 */
export function useAmapPicker(options = {}) {
  const {
    // 高德地图配置
    apiKey = '',
    securityHost = '/_AMapService',
    defaultCenter = [113.337680, 23.141447],
    defaultZoom = 18,

    // 回调函数
    onSelect = null,
    onConfirm = null,
    onHistoryChange = null,

    // 组件 ref（如果使用 AmapPicker 组件）
    pickerRef = null
  } = options

  // 当前选中的位置
  const location = ref(null)
  const lng = computed(() => location.value?.lng ?? null)
  const lat = computed(() => location.value?.lat ?? null)
  const hasLocation = computed(() => location.value !== null)

  // 历史记录
  const history = ref([])

  // 弹窗控制
  const modalVisible = ref(false)

  /**
   * 打开地图选择器
   * @param {number} [initialLng] - 初始经度
   * @param {number} [initialLat] - 初始纬度
   */
  const openPicker = (initialLng, initialLat) => {
    if (pickerRef?.value) {
      // 使用组件 ref 的方式
      pickerRef.value.open(initialLng, initialLat)
    } else {
      // 独立使用，控制弹窗显示
      modalVisible.value = true
    }
  }

  /**
   * 关闭地图选择器
   */
  const closePicker = () => {
    if (pickerRef?.value) {
      pickerRef.value.close()
    } else {
      modalVisible.value = false
    }
  }

  /**
   * 处理选点
   * @param {Object} data - 选点数据
   */
  const handleSelect = (data) => {
    if (onSelect) {
      onSelect(data)
    }
  }

  /**
   * 确认选点
   * @param {Object} data - 选点数据 { lng, lat, isFromGotoBtn }
   */
  const confirmLocation = (data) => {
    location.value = {
      lng: data.lng,
      lat: data.lat,
      isFromGotoBtn: data.isFromGotoBtn,
      timestamp: Date.now()
    }

    // 添加到历史记录
    addToHistory(data.lng, data.lat, data.isFromGotoBtn)

    // 触发回调
    if (onConfirm) {
      onConfirm(data)
    }

    // 关闭弹窗
    closePicker()
  }

  /**
   * 设置位置（编程式）
   * @param {number} lngVal - 经度
   * @param {number} latVal - 纬度
   * @param {boolean} [isFromGotoBtn=false] - 是否来自定位按钮
   */
  const setLocation = (lngVal, latVal, isFromGotoBtn = false) => {
    location.value = {
      lng: parseFloat(lngVal),
      lat: parseFloat(latVal),
      isFromGotoBtn,
      timestamp: Date.now()
    }
  }

  /**
   * 清除当前位置
   */
  const clearLocation = () => {
    location.value = null
  }

  /**
   * 添加到历史记录
   * @param {number} lngVal - 经度
   * @param {number} latVal - 纬度
   * @param {boolean} isFromGotoBtn - 是否来自定位按钮
   */
  const addToHistory = (lngVal, latVal, isFromGotoBtn) => {
    history.value.unshift({
      lng: parseFloat(lngVal),
      lat: parseFloat(latVal),
      time: new Date().toLocaleString('zh-CN'),
      isFromGotoBtn
    })

    if (onHistoryChange) {
      onHistoryChange([...history.value])
    }
  }

  /**
   * 从历史记录中删除
   * @param {number} index - 索引
   */
  const removeFromHistory = (index) => {
    history.value.splice(index, 1)

    if (onHistoryChange) {
      onHistoryChange([...history.value])
    }
  }

  /**
   * 使用历史记录中的位置
   * @param {Object} item - 历史记录项
   */
  const useHistoryItem = (item) => {
    location.value = {
      lng: item.lng,
      lat: item.lat,
      isFromGotoBtn: item.isFromGotoBtn,
      timestamp: Date.now()
    }
  }

  /**
   * 清空历史记录
   */
  const clearHistory = () => {
    history.value = []

    if (onHistoryChange) {
      onHistoryChange([])
    }
  }

  /**
   * 定位到指定坐标并打开选择器
   * @param {number} lngVal - 经度
   * @param {number} latVal - 纬度
   */
  const locateAndOpen = (lngVal, latVal) => {
    if (pickerRef?.value) {
      pickerRef.value.locate(lngVal, latVal)
    } else {
      setLocation(lngVal, latVal, true)
      openPicker(lngVal, latVal)
    }
  }

  /**
   * 验证坐标是否有效
   * @param {number} lngVal - 经度
   * @param {number} latVal - 纬度
   * @returns {boolean}
   */
  const isValidCoordinate = (lngVal, latVal) => {
    const lng = parseFloat(lngVal)
    const lat = parseFloat(latVal)

    if (isNaN(lng) || isNaN(lat)) {
      return false
    }

    if (lng < -180 || lng > 180 || lat < -90 || lat > 90) {
      return false
    }

    return true
  }

  /**
   * 格式化坐标显示
   * @param {number} val - 坐标值
   * @param {number} [digits=6] - 小数位数
   * @returns {string}
   */
  const formatCoordinate = (val, digits = 6) => {
    if (val === null || val === undefined) return ''
    return parseFloat(val).toFixed(digits)
  }

  return {
    // 状态
    location,
    lng,
    lat,
    hasLocation,
    history,
    modalVisible,

    // 方法
    openPicker,
    closePicker,
    handleSelect,
    confirmLocation,
    setLocation,
    clearLocation,
    addToHistory,
    removeFromHistory,
    useHistoryItem,
    clearHistory,
    locateAndOpen,
    isValidCoordinate,
    formatCoordinate,

    // 配置（供模板使用）
    config: {
      apiKey,
      securityHost,
      defaultCenter,
      defaultZoom
    }
  }
}

export default useAmapPicker
