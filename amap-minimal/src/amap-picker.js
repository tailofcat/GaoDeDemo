/**
 * AmapPicker - 高德地图选点组件
 *
 * 可插拔的地图选点模块，支持弹窗选点、坐标定位、历史记录管理
 *
 * @example
 * const picker = new AmapPicker({
 *   container: '#app',
 *   apiKey: 'your_amap_key',
 *   securityHost: '/_AMapService',
 *   defaultCenter: [113.337680, 23.141447],
 *   defaultZoom: 18
 * });
 *
 * picker.on('confirm', ({ lng, lat, isFromGotoBtn }) => {
 *   console.log('选中坐标:', lng, lat);
 * });
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.AmapPicker = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {

  // 默认配置
  var DEFAULTS = {
    container: 'body',               // 挂载容器选择器或 DOM 元素
    apiKey: '',                       // 高德地图 JS API Key
    securityHost: '/_AMapService',    // 安全代理路径
    defaultCenter: [113.337680, 23.141447], // 默认中心点
    defaultZoom: 18,                  // 默认缩放级别
    placeholder: {                    // 输入框占位符
      lng: '113.337680',
      lat: '23.141447'
    },
    titles: {                         // 区域标题
      coordSection: '规划站点坐标',
      mapSection: '选址地图',
      mapTip: '点击地图插入候选站点'
    },
    modalWidth: '90%',               // 弹窗宽度
    modalMaxWidth: '900px',           // 弹窗最大宽度
    modalHeight: '80%',              // 弹窗高度
    previewHeight: '180px',          // 预览框高度
    historyMaxHeight: '300px',       // 历史记录最大高度
    markerIcons: {                    // 标记图标
      red: 'https://webapi.amap.com/theme/v1.3/markers/n/mark_r.png',
      blue: 'https://webapi.amap.com/theme/v1.3/markers/n/mark_b.png'
    }
  };

  /**
   * 简易事件发射器
   */
  function EventEmitter() {
    this._events = {};
  }

  EventEmitter.prototype.on = function (event, fn) {
    if (!this._events[event]) this._events[event] = [];
    this._events[event].push(fn);
    return this;
  };

  EventEmitter.prototype.off = function (event, fn) {
    if (!this._events[event]) return this;
    if (!fn) {
      delete this._events[event];
    } else {
      this._events[event] = this._events[event].filter(function (f) {
        return f !== fn;
      });
    }
    return this;
  };

  EventEmitter.prototype.emit = function (event) {
    var args = Array.prototype.slice.call(arguments, 1);
    var listeners = this._events[event];
    if (listeners) {
      listeners.forEach(function (fn) {
        fn.apply(null, args);
      });
    }
    return this;
  };

  /**
   * AmapPicker 构造函数
   * @param {Object} options - 配置项
   */
  function AmapPicker(options) {
    EventEmitter.call(this);

    this.options = this._mergeOptions(DEFAULTS, options || {});
    this._validateOptions();

    // 内部状态
    this._map = null;
    this._marker = null;
    this._infoWindow = null;
    this._previewMap = null;
    this._selectedLng = null;
    this._selectedLat = null;
    this._isFromGotoBtn = false;
    this._historyData = [];
    this._historyMarkers = [];
    this._destroyed = false;

    // DOM 引用
    this._el = null;
    this._elements = {};

    // AMap 引用（可注入）
    this._AMap = options && options.AMap ? options.AMap : (typeof AMap !== 'undefined' ? AMap : null);

    this._init();
  }

  // 继承 EventEmitter
  AmapPicker.prototype = Object.create(EventEmitter.prototype);
  AmapPicker.prototype.constructor = AmapPicker;

  /**
   * 合并配置项
   */
  AmapPicker.prototype._mergeOptions = function (defaults, options) {
    var result = {};
    for (var key in defaults) {
      if (defaults.hasOwnProperty(key)) {
        if (typeof defaults[key] === 'object' && defaults[key] !== null && !Array.isArray(defaults[key])) {
          result[key] = this._mergeOptions(defaults[key], options[key] || {});
        } else {
          result[key] = options.hasOwnProperty(key) ? options[key] : defaults[key];
        }
      }
    }
    return result;
  };

  /**
   * 校验必要配置项
   */
  AmapPicker.prototype._validateOptions = function () {
    if (!this.options.apiKey) {
      throw new Error('AmapPicker: apiKey is required');
    }
  };

  /**
   * 获取挂载容器
   */
  AmapPicker.prototype._getContainer = function () {
    var container = this.options.container;
    if (typeof container === 'string') {
      return document.querySelector(container);
    }
    return container;
  };

  /**
   * 初始化组件
   */
  AmapPicker.prototype._init = function () {
    var mountEl = this._getContainer();
    if (!mountEl) {
      throw new Error('AmapPicker: container not found');
    }

    // 注入样式
    this._injectStyles();

    // 创建 DOM 结构
    this._el = document.createElement('div');
    this._el.className = 'amap-picker';
    this._el.innerHTML = this._renderTemplate();
    mountEl.appendChild(this._el);

    // 缓存 DOM 引用
    this._cacheElements();

    // 绑定事件
    this._bindEvents();

    // 预加载高德地图脚本（不阻塞初始化）
    this._preloadAMapScript();
  };

  /**
   * 预加载高德地图脚本（在后台加载，不阻塞）
   */
  AmapPicker.prototype._preloadAMapScript = function () {
    var self = this;

    // 设置安全配置
    if (this.options.securityHost) {
      window._AMapSecurityConfig = {
        serviceHost: this.options.securityHost
      };
    }

    // 检查是否已加载或正在加载
    if (typeof AMap !== 'undefined') {
      this._AMap = AMap;
      return;
    }

    // 检查是否已存在脚本标签
    var existingScript = document.querySelector('script[src*="webapi.amap.com/maps"]');
    if (existingScript) {
      // 等待脚本加载完成
      var checkInterval = setInterval(function () {
        if (typeof AMap !== 'undefined') {
          clearInterval(checkInterval);
          self._AMap = AMap;
        }
      }, 100);
      // 10秒超时
      setTimeout(function () {
        clearInterval(checkInterval);
      }, 10000);
      return;
    }

    // 创建脚本标签预加载
    var script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = 'https://webapi.amap.com/maps?v=2.0&key=' + this.options.apiKey;
    script.async = true;
    script.onload = function () {
      self._AMap = AMap;
    };
    document.head.appendChild(script);
  };

  /**
   * 注入 CSS 样式
   */
  AmapPicker.prototype._injectStyles = function () {
    if (document.getElementById('amap-picker-styles')) return;

    var style = document.createElement('style');
    style.id = 'amap-picker-styles';
    style.textContent = this._getStyles();
    document.head.appendChild(style);
  };

  /**
   * 获取 CSS 样式
   */
  AmapPicker.prototype._getStyles = function () {
    return [
      '.amap-picker * { box-sizing: border-box; }',
      '.amap-picker { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; }',

      // 区域卡片
      '.amap-picker-section { background: white; border-radius: 8px; padding: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); margin-bottom: 20px; }',
      '.amap-picker-section-title { font-size: 16px; font-weight: 600; margin-bottom: 15px; color: #333; }',

      // 输入区域
      '.amap-picker-input-section { border-top: none; margin-top: 0; padding-top: 0; }',
      '.amap-picker-input-group { display: flex; gap: 10px; margin-bottom: 10px; }',
      '.amap-picker-input-group label { font-size: 13px; color: #666; min-width: 45px; line-height: 32px; }',
      '.amap-picker-input-group input { flex: 1; padding: 6px 10px; border: 1px solid #d9d9d9; border-radius: 4px; font-size: 13px; }',
      '.amap-picker-input-group input:focus { outline: none; border-color: #1677ff; }',

      // 按钮
      '.amap-picker-btn { padding: 8px 20px; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; transition: all 0.2s; }',
      '.amap-picker-btn-primary { background: #1677ff; color: white; }',
      '.amap-picker-btn-primary:hover { background: #4096ff; }',
      '.amap-picker-btn-default { background: #f5f5f5; color: #666; }',
      '.amap-picker-btn-default:hover { background: #e8e8e8; }',
      '.amap-picker-btn-primary:disabled { background: #d9d9d9; cursor: not-allowed; }',
      '.amap-picker-btn-full { width: 100%; }',

      // 小按钮
      '.amap-picker-btn-sm { padding: 4px 12px; font-size: 12px; border: none; border-radius: 4px; cursor: pointer; transition: all 0.2s; }',
      '.amap-picker-btn-use { background: #1677ff; color: white; }',
      '.amap-picker-btn-use:hover { background: #4096ff; }',
      '.amap-picker-btn-delete { background: #ff4d4f; color: white; }',
      '.amap-picker-btn-delete:hover { background: #ff7875; }',

      // 预览框
      '.amap-picker-preview { width: 100%; height: ' + this.options.previewHeight + '; border: 2px dashed #d9d9d9; border-radius: 8px; display: flex; flex-direction: column; align-items: center; justify-content: center; cursor: pointer; transition: all 0.3s; background: #fafafa; position: relative; overflow: hidden; }',
      '.amap-picker-preview:hover { border-color: #1677ff; background: #f0f7ff; }',
      '.amap-picker-preview.has-location { border-style: solid; border-color: #52c41a; background: #f6ffed; padding: 0; }',
      '.amap-picker-preview-icon { font-size: 32px; margin-bottom: 8px; display: flex; align-items: center; justify-content: center; }',
      '.amap-picker-preview-text { color: #666; font-size: 14px; }',
      '.amap-picker-preview-content { width: 100%; height: 100%; position: relative; }',
      '.amap-picker-preview-map { width: 100%; height: 100%; border-radius: 6px; }',
      '.amap-picker-preview-overlay { position: absolute; bottom: 0; left: 0; right: 0; background: linear-gradient(transparent, rgba(0,0,0,0.7)); padding: 30px 12px 12px; color: white; z-index: 10; }',
      '.amap-picker-preview-click-layer { position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 20; cursor: pointer; }',
      '.amap-picker-preview-coords { font-size: 13px; font-family: monospace; }',

      // 历史记录
      '.amap-picker-history-list { max-height: ' + this.options.historyMaxHeight + '; overflow-y: auto; }',
      '.amap-picker-history-item { display: flex; justify-content: space-between; align-items: center; padding: 12px; border-bottom: 1px solid #f0f0f0; transition: background 0.2s; }',
      '.amap-picker-history-item:hover { background: #f5f5f5; }',
      '.amap-picker-history-item:last-child { border-bottom: none; }',
      '.amap-picker-history-coords { font-family: monospace; font-size: 13px; color: #333; }',
      '.amap-picker-history-time { font-size: 12px; color: #999; }',
      '.amap-picker-history-actions { display: flex; gap: 8px; }',
      '.amap-picker-history-empty { text-align: center; color: #999; padding: 40px; font-size: 14px; }',

      // 弹窗
      '.amap-picker-modal-overlay { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); z-index: 10000; justify-content: center; align-items: center; }',
      '.amap-picker-modal-overlay.active { display: flex; }',
      '.amap-picker-modal { background: white; border-radius: 12px; width: ' + this.options.modalWidth + '; max-width: ' + this.options.modalMaxWidth + '; height: ' + this.options.modalHeight + '; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 8px 32px rgba(0,0,0,0.2); }',
      '.amap-picker-modal-header { display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; border-bottom: 1px solid #f0f0f0; }',
      '.amap-picker-modal-title { font-size: 16px; font-weight: 600; color: #333; }',
      '.amap-picker-modal-close { width: 32px; height: 32px; border: none; background: #f5f5f5; border-radius: 6px; cursor: pointer; font-size: 18px; color: #666; display: flex; align-items: center; justify-content: center; }',
      '.amap-picker-modal-close:hover { background: #e8e8e8; color: #333; }',
      '.amap-picker-modal-body { flex: 1; position: relative; }',
      '.amap-picker-modal-body .amap-picker-map-container { width: 100%; height: 100%; }',
      '.amap-picker-modal-footer { display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; border-top: 1px solid #f0f0f0; background: #fafafa; }',
      '.amap-picker-selected-info { font-size: 14px; color: #666; }',
      '.amap-picker-selected-coords { color: #1677ff; font-weight: 600; font-family: monospace; }',
      '.amap-picker-modal-actions { display: flex; gap: 12px; }',

      // 地图提示
      '.amap-picker-map-tip { position: absolute; top: 10px; left: 50%; transform: translateX(-50%); background: rgba(0,0,0,0.7); color: white; padding: 8px 16px; border-radius: 20px; font-size: 13px; z-index: 10; pointer-events: none; }'
    ].join('\n');
  };

  /**
   * 渲染 HTML 模板
   */
  AmapPicker.prototype._renderTemplate = function () {
    var opts = this.options;
    return [
      // 坐标输入区域
      '<div class="amap-picker-section">',
      '  <div class="amap-picker-section-title">' + opts.titles.coordSection + '</div>',
      '  <div class="amap-picker-input-section">',
      '    <div class="amap-picker-input-group">',
      '      <label>经度:</label>',
      '      <input type="number" class="amap-picker-input-lng" step="0.000001" placeholder="' + opts.placeholder.lng + '">',
      '    </div>',
      '    <div class="amap-picker-input-group">',
      '      <label>纬度:</label>',
      '      <input type="number" class="amap-picker-input-lat" step="0.000001" placeholder="' + opts.placeholder.lat + '">',
      '    </div>',
      '    <button class="amap-picker-btn amap-picker-btn-primary amap-picker-btn-full amap-picker-goto-btn">定位</button>',
      '  </div>',
      '</div>',

      // 地图选点区域
      '<div class="amap-picker-section">',
      '  <div class="amap-picker-section-title">' + opts.titles.mapSection + '</div>',
      '  <div style="font-size: 13px; color: #666; margin-bottom: 10px;">' + opts.titles.mapTip + '</div>',
      '<div class="amap-picker-preview">',
      '    <div class="amap-picker-preview-empty">',
      '      <div class="amap-picker-preview-icon">\u{1F4CD}</div>',
      '      <div class="amap-picker-preview-text">点击选择地图位置</div>',
      '    </div>',
      '    <div class="amap-picker-preview-content" style="display: none;">',
      '      <div class="amap-picker-preview-map"></div>',
      '      <div class="amap-picker-preview-overlay">',
      '        <div class="amap-picker-preview-coords"></div>',
      '      </div>',
      '    </div>',
      '    <div class="amap-picker-preview-click-layer"></div>',
      '  </div>',

      // 历史记录
      '  <div class="amap-picker-section-title" style="margin-top: 20px;">已选位置记录</div>',
      '  <div class="amap-picker-history-list">',
      '    <div class="amap-picker-history-empty">暂无选点记录</div>',
      '  </div>',
      '</div>',

      // 弹窗
      '<div class="amap-picker-modal-overlay">',
      '  <div class="amap-picker-modal">',
      '    <div class="amap-picker-modal-header">',
      '      <div class="amap-picker-modal-title">选择地图位置</div>',
      '      <button class="amap-picker-modal-close">&times;</button>',
      '    </div>',
      '    <div class="amap-picker-modal-body">',
      '      <div class="amap-picker-map-tip">点击地图任意位置选点</div>',
      '      <div class="amap-picker-map-container"></div>',
      '    </div>',
      '    <div class="amap-picker-modal-footer">',
      '      <div class="amap-picker-selected-info">',
      '        当前选择：<span class="amap-picker-selected-coords">未选择</span>',
      '      </div>',
      '      <div class="amap-picker-modal-actions">',
      '        <button class="amap-picker-btn amap-picker-btn-default amap-picker-btn-cancel">取消</button>',
      '        <button class="amap-picker-btn amap-picker-btn-primary amap-picker-btn-confirm" disabled>确认</button>',
      '      </div>',
      '    </div>',
      '  </div>',
      '</div>'
    ].join('\n');
  };

  /**
   * 缓存 DOM 元素引用
   */
  AmapPicker.prototype._cacheElements = function () {
    var el = this._el;
    this._elements = {
      inputLng: el.querySelector('.amap-picker-input-lng'),
      inputLat: el.querySelector('.amap-picker-input-lat'),
      gotoBtn: el.querySelector('.amap-picker-goto-btn'),
      preview: el.querySelector('.amap-picker-preview'),
      previewEmpty: el.querySelector('.amap-picker-preview-empty'),
      previewContent: el.querySelector('.amap-picker-preview-content'),
      previewMap: el.querySelector('.amap-picker-preview-map'),
      previewCoords: el.querySelector('.amap-picker-preview-coords'),
      modalOverlay: el.querySelector('.amap-picker-modal-overlay'),
      modalClose: el.querySelector('.amap-picker-modal-close'),
      btnCancel: el.querySelector('.amap-picker-btn-cancel'),
      btnConfirm: el.querySelector('.amap-picker-btn-confirm'),
      selectedCoords: el.querySelector('.amap-picker-selected-coords'),
      historyList: el.querySelector('.amap-picker-history-list'),
      mapContainer: el.querySelector('.amap-picker-map-container')
    };
  };

  /**
   * 绑定事件
   */
  AmapPicker.prototype._bindEvents = function () {
    var self = this;
    var els = this._elements;

    // 定位按钮
    els.gotoBtn.addEventListener('click', function () {
      self._handleGoto();
    });

    // 回车键触发定位
    els.inputLng.addEventListener('keypress', function (e) {
      if (e.key === 'Enter') self._handleGoto();
    });
    els.inputLat.addEventListener('keypress', function (e) {
      if (e.key === 'Enter') self._handleGoto();
    });

    // 预览框点击
    els.preview.addEventListener('click', function () {
      self._isFromGotoBtn = false;
      self.open();
    });

    // 弹窗关闭
    els.modalClose.addEventListener('click', function () {
      self.close();
    });
    els.btnCancel.addEventListener('click', function () {
      self.close();
    });
    els.modalOverlay.addEventListener('click', function (e) {
      if (e.target === els.modalOverlay) self.close();
    });

    // 确认按钮
    els.btnConfirm.addEventListener('click', function () {
      self._confirmSelection();
    });
  };

  /**
   * 处理定位按钮点击
   */
  AmapPicker.prototype._handleGoto = function () {
    var els = this._elements;
    var lngValue = els.inputLng.value || els.inputLng.placeholder;
    var latValue = els.inputLat.value || els.inputLat.placeholder;
    var lng = parseFloat(lngValue);
    var lat = parseFloat(latValue);

    if (isNaN(lng) || isNaN(lat)) {
      this.emit('error', new Error('请输入有效的经纬度坐标'));
      return;
    }

    if (lng < -180 || lng > 180 || lat < -90 || lat > 90) {
      this.emit('error', new Error('经度范围：-180 到 180，纬度范围：-90 到 90'));
      return;
    }

    // 回填输入框
    els.inputLng.value = lng;
    els.inputLat.value = lat;

    this._isFromGotoBtn = true;
    this.open();
  };

  /**
   * 确保高德地图脚本已加载（用于弹窗打开时）
   * @param {Function} callback - 加载完成后的回调
   */
  AmapPicker.prototype._ensureAMapLoaded = function (callback) {
    var self = this;

    // 如果已经加载，直接回调
    if (this._AMap || typeof AMap !== 'undefined') {
      this._AMap = AMap;
      callback();
      return;
    }

    // 等待脚本加载
    var checkInterval = setInterval(function () {
      if (typeof AMap !== 'undefined') {
        clearInterval(checkInterval);
        self._AMap = AMap;
        callback();
      }
    }, 50);

    // 5秒超时
    setTimeout(function () {
      clearInterval(checkInterval);
      if (!self._AMap) {
        console.error('高德地图脚本加载超时');
      }
    }, 5000);
  };

  /**
   * 初始化弹窗地图
   */
  AmapPicker.prototype._initMap = function () {
    var AMap = this._AMap;
    if (!AMap) return;

    var self = this;
    var opts = this.options;

    this._map = new AMap.Map(this._elements.mapContainer, {
      viewMode: '2D',
      zoom: opts.defaultZoom,
      center: opts.defaultCenter
    });

    AMap.plugin(['AMap.Scale', 'AMap.MapType', 'AMap.Geolocation', 'AMap.InfoWindow'], function () {
      self._map.addControl(new AMap.Scale());
      self._map.addControl(new AMap.MapType());

      var geolocation = new AMap.Geolocation({
        enableHighAccuracy: true,
        timeout: 10000,
        zoomToAccuracy: true,
        buttonPosition: 'RB'
      });
      self._map.addControl(geolocation);

      self._infoWindow = new AMap.InfoWindow({
        offset: new AMap.Pixel(0, -30)
      });

      // 地图点击事件
      self._map.on('click', function (e) {
        self._selectedLng = e.lnglat.getLng();
        self._selectedLat = e.lnglat.getLat();

        self._elements.selectedCoords.textContent =
          self._selectedLng.toFixed(6) + ', ' + self._selectedLat.toFixed(6);
        self._elements.btnConfirm.disabled = false;

        if (self._marker) self._map.remove(self._marker);

        self._marker = new AMap.Marker({
          position: e.lnglat,
          title: '选点位置'
        });
        self._map.add(self._marker);

        self._infoWindow.setContent(
          '<div style="padding: 10px;"><p><strong>经度:</strong> ' + self._selectedLng.toFixed(6) +
          '</p><p><strong>纬度:</strong> ' + self._selectedLat.toFixed(6) + '</p></div>'
        );
        self._infoWindow.open(self._map, e.lnglat);

        self.emit('select', {
          lng: self._selectedLng,
          lat: self._selectedLat,
          isFromGotoBtn: false
        });
      });
    });
  };

  /**
   * 显示所有历史标记
   */
  AmapPicker.prototype._showHistoryMarkers = function () {
    var AMap = this._AMap;
    if (!AMap || !this._map) return;

    var self = this;

    // 清除旧标记
    this._historyMarkers.forEach(function (m) {
      self._map.remove(m);
    });
    this._historyMarkers = [];

    // 添加历史标记
    this._historyData.forEach(function (item, index) {
      var isRed = item.isFromGotoBtn === true;
      var iconUrl = isRed ? self.options.markerIcons.red : self.options.markerIcons.blue;
      var title = isRed ? '定位位置 ' + (index + 1) : '历史位置 ' + (index + 1);

      var historyMarker = new AMap.Marker({
        position: [item.lng, item.lat],
        title: title,
        icon: new AMap.Icon({
          size: new AMap.Size(20, 28),
          image: iconUrl,
          imageSize: new AMap.Size(20, 28)
        })
      });
      self._map.add(historyMarker);
      self._historyMarkers.push(historyMarker);
    });
  };

  /**
   * 在地图上显示红色标记并定位
   */
  AmapPicker.prototype._showMarkerOnMap = function (lng, lat) {
    var AMap = this._AMap;
    if (!AMap || !this._map) return;

    var position = new AMap.LngLat(lng, lat);

    this._selectedLng = lng;
    this._selectedLat = lat;
    this._elements.selectedCoords.textContent = lng.toFixed(6) + ', ' + lat.toFixed(6);
    this._elements.btnConfirm.disabled = false;

    if (this._marker) this._map.remove(this._marker);

    this._marker = new AMap.Marker({
      position: position,
      title: '定位位置',
      icon: new AMap.Icon({
        size: new AMap.Size(25, 34),
        image: this.options.markerIcons.red,
        imageSize: new AMap.Size(25, 34)
      })
    });
    this._map.add(this._marker);

    this._map.setCenter(position);
    this._map.setZoom(this.options.defaultZoom);

    if (this._infoWindow) {
      this._infoWindow.setContent(
        '<div style="padding: 10px;"><p><strong>经度:</strong> ' + lng.toFixed(6) +
        '</p><p><strong>纬度:</strong> ' + lat.toFixed(6) + '</p></div>'
      );
      this._infoWindow.open(this._map, position);
    }
  };

  /**
   * 初始化预览地图
   */
  AmapPicker.prototype._initPreviewMap = function (lng, lat) {
    var AMap = this._AMap;
    if (!AMap) return;

    if (this._previewMap) {
      this._previewMap.destroy();
    }

    var self = this;
    this._previewMap = new AMap.Map(this._elements.previewMap, {
      viewMode: '2D',
      zoom: this.options.defaultZoom,
      center: [lng, lat],
      dragEnable: false,
      zoomEnable: false,
      doubleClickZoom: false,
      keyboardEnable: false
    });

    // 添加历史标记到预览地图
    this._historyData.forEach(function (item) {
      var isRed = item.isFromGotoBtn === true;
      var iconUrl = isRed ? self.options.markerIcons.red : self.options.markerIcons.blue;
      var marker = new AMap.Marker({
        position: [item.lng, item.lat],
        title: isRed ? '定位位置' : '历史位置',
        icon: new AMap.Icon({
          size: new AMap.Size(20, 28),
          image: iconUrl,
          imageSize: new AMap.Size(20, 28)
        })
      });
      marker.setMap(self._previewMap);
    });
  };

  /**
   * 确认选点
   */
  AmapPicker.prototype._confirmSelection = function () {
    if (this._selectedLng === null || this._selectedLat === null) return;

    var els = this._elements;

    // 更新预览框
    els.preview.classList.add('has-location');
    els.previewEmpty.style.display = 'none';
    els.previewContent.style.display = 'block';

    var fromGotoBtn = this._isFromGotoBtn;

    // 先添加历史记录
    this._addToHistory(this._selectedLng, this._selectedLat, fromGotoBtn);

    // 重置标记
    this._isFromGotoBtn = false;

    // 初始化预览地图
    this._initPreviewMap(this._selectedLng, this._selectedLat);
    els.previewCoords.textContent = '经度: ' + this._selectedLng.toFixed(6) + ', 纬度: ' + this._selectedLat.toFixed(6);

    var confirmData = {
      lng: this._selectedLng,
      lat: this._selectedLat,
      isFromGotoBtn: fromGotoBtn
    };

    this.emit('confirm', confirmData);

    // 关闭弹窗
    this.close();
  };

  /**
   * 添加历史记录
   */
  AmapPicker.prototype._addToHistory = function (lng, lat, fromGotoBtn) {
    var record = {
      lng: lng,
      lat: lat,
      time: new Date().toLocaleString('zh-CN'),
      isFromGotoBtn: fromGotoBtn === true
    };
    this._historyData.unshift(record);
    this._renderHistory();
    this.emit('historyChange', this._historyData.slice());
  };

  /**
   * 渲染历史记录列表
   */
  AmapPicker.prototype._renderHistory = function () {
    var self = this;
    var listEl = this._elements.historyList;

    if (this._historyData.length === 0) {
      listEl.innerHTML = '<div class="amap-picker-history-empty">暂无选点记录</div>';
      return;
    }

    var html = '';
    this._historyData.forEach(function (item, index) {
      html += '<div class="amap-picker-history-item" data-index="' + index + '">' +
        '<div>' +
          '<div class="amap-picker-history-coords">经度: ' + item.lng.toFixed(6) + ', 纬度: ' + item.lat.toFixed(6) + '</div>' +
          '<div class="amap-picker-history-time">' + item.time + '</div>' +
        '</div>' +
        '<div class="amap-picker-history-actions">' +
          '<button class="amap-picker-btn-sm amap-picker-btn-use" data-action="use" data-index="' + index + '">使用</button>' +
          '<button class="amap-picker-btn-sm amap-picker-btn-delete" data-action="delete" data-index="' + index + '">删除</button>' +
        '</div>' +
      '</div>';
    });
    listEl.innerHTML = html;

    // 事件委托
    listEl.onclick = function (e) {
      var btn = e.target.closest('[data-action]');
      if (!btn) return;
      var action = btn.dataset.action;
      var idx = parseInt(btn.dataset.index, 10);
      if (action === 'use') {
        self._useHistory(idx);
      } else if (action === 'delete') {
        self._deleteHistory(idx);
      }
    };
  };

  /**
   * 使用历史记录
   */
  AmapPicker.prototype._useHistory = function (index) {
    var item = this._historyData[index];
    if (!item) return;

    var els = this._elements;
    els.preview.classList.add('has-location');
    els.previewEmpty.style.display = 'none';
    els.previewContent.style.display = 'block';
    this._initPreviewMap(item.lng, item.lat);
    els.previewCoords.textContent = '经度: ' + item.lng.toFixed(6) + ', 纬度: ' + item.lat.toFixed(6);

    this.emit('useHistory', { lng: item.lng, lat: item.lat, isFromGotoBtn: item.isFromGotoBtn });
  };

  /**
   * 删除历史记录
   */
  AmapPicker.prototype._deleteHistory = function (index) {
    this._historyData.splice(index, 1);
    this._renderHistory();
    this.emit('historyChange', this._historyData.slice());
  };

  // ==================== 公共 API ====================

  /**
   * 打开地图弹窗
   * @param {number} [lng] - 可选，打开后定位到此经度
   * @param {number} [lat] - 可选，打开后定位到此纬度
   */
  AmapPicker.prototype.open = function (lng, lat) {
    if (this._destroyed) return;

    var self = this;
    var els = this._elements;

    // 先显示弹窗，让用户看到界面
    els.modalOverlay.classList.add('active');

    // 获取输入框坐标
    var inputLng = parseFloat(els.inputLng.value);
    var inputLat = parseFloat(els.inputLat.value);

    // 优先使用参数传入的坐标
    var targetLng = lng || inputLng;
    var targetLat = lat || inputLat;
    var hasTarget = !isNaN(targetLng) && !isNaN(targetLat) &&
                    targetLng >= -180 && targetLng <= 180 &&
                    targetLat >= -90 && targetLat <= 90;

    // 确保地图脚本已加载，然后初始化地图
    this._ensureAMapLoaded(function () {
      // 使用 requestAnimationFrame 确保 DOM 已渲染
      requestAnimationFrame(function () {
        if (!self._map) {
          self._initMap();
        } else {
          self._map.resize();
        }

        // 显示历史标记
        self._showHistoryMarkers();

        // 如果有目标坐标，显示标记
        if (hasTarget) {
          self._showMarkerOnMap(targetLng, targetLat);
        }
      });
    });

    this.emit('open');
  };

  /**
   * 关闭地图弹窗
   */
  AmapPicker.prototype.close = function () {
    if (this._destroyed) return;

    var els = this._elements;

    els.modalOverlay.classList.remove('active');
    this._selectedLng = null;
    this._selectedLat = null;
    els.selectedCoords.textContent = '未选择';
    els.btnConfirm.disabled = true;

    if (this._marker) {
      this._map.remove(this._marker);
      this._marker = null;
    }
    if (this._infoWindow) {
      this._infoWindow.close();
    }

    // 清除历史标记
    var self = this;
    this._historyMarkers.forEach(function (m) {
      self._map.remove(m);
    });
    this._historyMarkers = [];

    this.emit('close');
  };

  /**
   * 定位到指定坐标（红色标记）
   * @param {number} lng - 经度
   * @param {number} lat - 纬度
   */
  AmapPicker.prototype.locate = function (lng, lat) {
    if (this._destroyed) return;

    lng = parseFloat(lng);
    lat = parseFloat(lat);

    if (isNaN(lng) || isNaN(lat)) {
      this.emit('error', new Error('Invalid coordinates'));
      return;
    }

    this._isFromGotoBtn = true;

    // 回填输入框
    this._elements.inputLng.value = lng;
    this._elements.inputLat.value = lat;

    this.open(lng, lat);
  };

  /**
   * 获取历史记录
   * @returns {Array} 历史记录数组
   */
  AmapPicker.prototype.getHistory = function () {
    return this._historyData.slice();
  };

  /**
   * 清空历史记录
   */
  AmapPicker.prototype.clearHistory = function () {
    this._historyData = [];
    this._renderHistory();
    this.emit('historyChange', []);
  };

  /**
   * 获取当前选中坐标
   * @returns {Object|null} { lng, lat, isFromGotoBtn } 或 null
   */
  AmapPicker.prototype.getSelected = function () {
    if (this._selectedLng === null || this._selectedLat === null) return null;
    return {
      lng: this._selectedLng,
      lat: this._selectedLat,
      isFromGotoBtn: this._isFromGotoBtn
    };
  };

  /**
   * 设置默认中心点
   * @param {number} lng - 经度
   * @param {number} lat - 纬度
   */
  AmapPicker.prototype.setCenter = function (lng, lat) {
    this.options.defaultCenter = [lng, lat];
    if (this._map) {
      this._map.setCenter([lng, lat]);
    }
  };

  /**
   * 设置缩放级别
   * @param {number} zoom - 缩放级别
   */
  AmapPicker.prototype.setZoom = function (zoom) {
    this.options.defaultZoom = zoom;
    if (this._map) {
      this._map.setZoom(zoom);
    }
  };

  /**
   * 销毁组件，释放所有资源
   */
  AmapPicker.prototype.destroy = function () {
    if (this._destroyed) return;
    this._destroyed = true;

    // 销毁地图实例
    if (this._map) {
      this._map.destroy();
      this._map = null;
    }
    if (this._previewMap) {
      this._previewMap.destroy();
      this._previewMap = null;
    }

    // 移除 DOM
    if (this._el && this._el.parentNode) {
      this._el.parentNode.removeChild(this._el);
    }

    // 清理引用
    this._elements = {};
    this._historyData = [];
    this._historyMarkers = [];
    this._marker = null;
    this._infoWindow = null;

    // 清理事件
    this._events = {};

    this.emit('destroy');
  };

  // 版本号
  AmapPicker.version = '1.0.0';

  return AmapPicker;
}));
