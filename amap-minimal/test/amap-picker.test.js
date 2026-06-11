/**
 * AmapPicker 自动化测试
 *
 * 测试覆盖：
 * - 构造函数与配置合并
 * - 事件系统 (on/off/emit)
 * - DOM 创建与缓存
 * - 历史记录管理
 * - 公共 API (open/close/locate/getHistory/clearHistory/getSelected/destroy)
 * - 反向代理中间件
 */

var AmapPicker = require('../src/amap-picker');

// ============ Mock AMap ============
function createMockAMap() {
  var markers = [];
  var maps = [];

  function MockLngLat(lng, lat) {
    this._lng = lng;
    this._lat = lat;
    this.getLng = function () { return lng; };
    this.getLat = function () { return lat; };
  }

  function MockPixel(x, y) {
    this._x = x;
    this._y = y;
  }

  function MockSize(w, h) {
    this._w = w;
    this._h = h;
  }

  function MockIcon(opts) {
    this._opts = opts;
  }

  function MockMarker(opts) {
    this._opts = opts;
    this._map = null;
    markers.push(this);
  }
  MockMarker.prototype.setMap = function (map) { this._map = map; };

  function MockInfoWindow(opts) {
    this._opts = opts;
    this._content = '';
    this._isOpen = false;
    this._position = null;
  }
  MockInfoWindow.prototype.setContent = function (c) { this._content = c; };
  MockInfoWindow.prototype.open = function (map, pos) { this._isOpen = true; this._position = pos; };
  MockInfoWindow.prototype.close = function () { this._isOpen = false; };

  function MockMap(container, opts) {
    this._container = container;
    this._opts = opts;
    this._markers = [];
    this._controls = [];
    this._center = opts.center;
    this._zoom = opts.zoom;
    this._destroyed = false;
    this._eventHandlers = {};
    maps.push(this);
  }
  MockMap.prototype.addControl = function (c) { this._controls.push(c); };
  MockMap.prototype.add = function (m) { this._markers.push(m); m._map = this; };
  MockMap.prototype.remove = function (m) {
    this._markers = this._markers.filter(function (item) { return item !== m; });
  };
  MockMap.prototype.setCenter = function (c) { this._center = c; };
  MockMap.prototype.setZoom = function (z) { this._zoom = z; };
  MockMap.prototype.resize = function () {};
  MockMap.prototype.destroy = function () { this._destroyed = true; };
  MockMap.prototype.on = function (event, handler) {
    if (!this._eventHandlers[event]) this._eventHandlers[event] = [];
    this._eventHandlers[event].push(handler);
  };

  // 模拟点击事件
  MockMap.prototype.simulateClick = function (lng, lat) {
    var handlers = this._eventHandlers['click'] || [];
    var e = { lnglat: new MockLngLat(lng, lat) };
    handlers.forEach(function (h) { h(e); });
  };

  function MockScale() {}
  function MockMapType() {}
  function MockGeolocation(opts) { this._opts = opts; }

  var AMap = {
    LngLat: MockLngLat,
    Pixel: MockPixel,
    Size: MockSize,
    Icon: MockIcon,
    Marker: MockMarker,
    InfoWindow: MockInfoWindow,
    Map: MockMap,
    Scale: MockScale,
    MapType: MockMapType,
    Geolocation: MockGeolocation,
    plugin: function (plugins, callback) {
      callback();
    }
  };

  return { AMap: AMap, markers: markers, maps: maps };
}

// ============ 测试 ============

describe('AmapPicker', function () {

  var mockAMap;

  beforeEach(function () {
    mockAMap = createMockAMap();
    document.body.innerHTML = '';
    // 移除之前注入的样式
    var oldStyle = document.getElementById('amap-picker-styles');
    if (oldStyle) oldStyle.remove();
  });

  describe('构造函数', function () {
    test('缺少 apiKey 应抛出错误', function () {
      expect(function () {
        new AmapPicker({ container: 'body' });
      }).toThrow('apiKey is required');
    });

    test('缺少 container 应抛出错误', function () {
      expect(function () {
        new AmapPicker({ apiKey: 'test-key', container: '#nonexistent' });
      }).toThrow('container not found');
    });

    test('使用默认配置创建实例', function () {
      var picker = new AmapPicker({
        apiKey: 'test-key',
        container: 'body',
        AMap: mockAMap.AMap
      });

      expect(picker).toBeDefined();
      expect(picker.options.apiKey).toBe('test-key');
      expect(picker.options.defaultCenter).toEqual([113.337680, 23.141447]);
      expect(picker.options.defaultZoom).toBe(18);
      expect(picker.options.placeholder.lng).toBe('113.337680');
      expect(picker.options.placeholder.lat).toBe('23.141447');

      picker.destroy();
    });

    test('自定义配置覆盖默认值', function () {
      var picker = new AmapPicker({
        apiKey: 'test-key',
        container: 'body',
        AMap: mockAMap.AMap,
        defaultCenter: [116.397428, 39.90923],
        defaultZoom: 15,
        placeholder: { lng: '116.397428', lat: '39.90923' },
        titles: { coordSection: '自定义标题' }
      });

      expect(picker.options.defaultCenter).toEqual([116.397428, 39.90923]);
      expect(picker.options.defaultZoom).toBe(15);
      expect(picker.options.placeholder.lng).toBe('116.397428');
      expect(picker.options.titles.coordSection).toBe('自定义标题');

      picker.destroy();
    });

    test('创建 DOM 元素', function () {
      var picker = new AmapPicker({
        apiKey: 'test-key',
        container: 'body',
        AMap: mockAMap.AMap
      });

      var el = document.querySelector('.amap-picker');
      expect(el).not.toBeNull();
      expect(el.querySelector('.amap-picker-input-lng')).not.toBeNull();
      expect(el.querySelector('.amap-picker-input-lat')).not.toBeNull();
      expect(el.querySelector('.amap-picker-goto-btn')).not.toBeNull();
      expect(el.querySelector('.amap-picker-preview')).not.toBeNull();
      expect(el.querySelector('.amap-picker-modal-overlay')).not.toBeNull();

      picker.destroy();
    });

    test('注入 CSS 样式', function () {
      var picker = new AmapPicker({
        apiKey: 'test-key',
        container: 'body',
        AMap: mockAMap.AMap
      });

      var style = document.getElementById('amap-picker-styles');
      expect(style).not.toBeNull();

      picker.destroy();
    });
  });

  describe('事件系统', function () {
    var picker;

    beforeEach(function () {
      picker = new AmapPicker({
        apiKey: 'test-key',
        container: 'body',
        AMap: mockAMap.AMap
      });
    });

    afterEach(function () {
      picker.destroy();
    });

    test('on/emit 事件监听和触发', function () {
      var received = null;
      picker.on('test', function (data) {
        received = data;
      });
      picker.emit('test', { msg: 'hello' });
      expect(received).toEqual({ msg: 'hello' });
    });

    test('off 取消事件监听', function () {
      var count = 0;
      var handler = function () { count++; };
      picker.on('test', handler);
      picker.emit('test');
      expect(count).toBe(1);

      picker.off('test', handler);
      picker.emit('test');
      expect(count).toBe(1);
    });

    test('多个监听器', function () {
      var count = 0;
      picker.on('test', function () { count++; });
      picker.on('test', function () { count++; });
      picker.emit('test');
      expect(count).toBe(2);
    });

    test('off 不传 handler 清除所有监听器', function () {
      var count = 0;
      picker.on('test', function () { count++; });
      picker.on('test', function () { count++; });
      picker.off('test');
      picker.emit('test');
      expect(count).toBe(0);
    });
  });

  describe('历史记录管理', function () {
    var picker;

    beforeEach(function () {
      picker = new AmapPicker({
        apiKey: 'test-key',
        container: 'body',
        AMap: mockAMap.AMap
      });
    });

    afterEach(function () {
      picker.destroy();
    });

    test('初始历史为空', function () {
      expect(picker.getHistory()).toEqual([]);
    });

    test('addToHistory 添加记录', function () {
      picker._addToHistory(113.337680, 23.141447, true);
      var history = picker.getHistory();
      expect(history.length).toBe(1);
      expect(history[0].lng).toBe(113.337680);
      expect(history[0].lat).toBe(23.141447);
      expect(history[0].isFromGotoBtn).toBe(true);
    });

    test('addToHistory 触发 historyChange 事件', function () {
      var received = null;
      picker.on('historyChange', function (data) { received = data; });
      picker._addToHistory(113.337680, 23.141447, false);
      expect(received).not.toBeNull();
      expect(received.length).toBe(1);
    });

    test('deleteHistory 删除记录', function () {
      picker._addToHistory(113.337680, 23.141447, true);
      picker._addToHistory(116.397428, 39.90923, false);
      // unshift: [116.397428, 113.337680]
      expect(picker.getHistory().length).toBe(2);

      picker._deleteHistory(1);
      expect(picker.getHistory().length).toBe(1);
      // 删除 index 1 后剩下 [116.397428]
      expect(picker.getHistory()[0].lng).toBe(116.397428);
    });

    test('clearHistory 清空所有记录', function () {
      picker._addToHistory(113.337680, 23.141447, true);
      picker._addToHistory(116.397428, 39.90923, false);
      picker.clearHistory();
      expect(picker.getHistory()).toEqual([]);
    });

    test('clearHistory 触发 historyChange 事件', function () {
      var received = null;
      picker.on('historyChange', function (data) { received = data; });
      picker._addToHistory(113.337680, 23.141447, true);
      picker.clearHistory();
      expect(received).toEqual([]);
    });

    test('getHistory 返回副本而非引用', function () {
      picker._addToHistory(113.337680, 23.141447, true);
      var h1 = picker.getHistory();
      h1.push({ lng: 0, lat: 0 });
      var h2 = picker.getHistory();
      expect(h2.length).toBe(1);
    });

    test('记录按时间倒序排列（新记录在前）', function () {
      picker._addToHistory(113.337680, 23.141447, true);
      picker._addToHistory(116.397428, 39.90923, false);
      var history = picker.getHistory();
      expect(history[0].lng).toBe(116.397428);
      expect(history[1].lng).toBe(113.337680);
    });
  });

  describe('公共 API', function () {
    var picker;

    beforeEach(function () {
      picker = new AmapPicker({
        apiKey: 'test-key',
        container: 'body',
        AMap: mockAMap.AMap
      });
    });

    afterEach(function () {
      picker.destroy();
    });

    test('open 打开弹窗', function () {
      picker.open();
      var overlay = document.querySelector('.amap-picker-modal-overlay');
      expect(overlay.classList.contains('active')).toBe(true);
    });

    test('open 触发 open 事件', function () {
      var fired = false;
      picker.on('open', function () { fired = true; });
      picker.open();
      expect(fired).toBe(true);
    });

    test('close 关闭弹窗', function () {
      picker.open();
      picker.close();
      var overlay = document.querySelector('.amap-picker-modal-overlay');
      expect(overlay.classList.contains('active')).toBe(false);
    });

    test('close 触发 close 事件', function () {
      var fired = false;
      picker.on('close', function () { fired = true; });
      picker.open();
      picker.close();
      expect(fired).toBe(true);
    });

    test('locate 定位到坐标', function () {
      picker.locate(116.397428, 39.90923);
      var overlay = document.querySelector('.amap-picker-modal-overlay');
      expect(overlay.classList.contains('active')).toBe(true);
      expect(picker._isFromGotoBtn).toBe(true);
      // parseFloat(116.397428) = 116.397428
      expect(picker._elements.inputLng.value).toBe('116.397428');
      expect(picker._elements.inputLat.value).toBe('39.90923');
    });

    test('locate 无效坐标触发 error 事件', function () {
      var errorReceived = null;
      picker.on('error', function (err) { errorReceived = err; });
      picker.locate(NaN, NaN);
      expect(errorReceived).not.toBeNull();
    });

    test('getSelected 初始为 null', function () {
      expect(picker.getSelected()).toBeNull();
    });

    test('setCenter 更新默认中心点', function () {
      picker.setCenter(116.397428, 39.90923);
      expect(picker.options.defaultCenter).toEqual([116.397428, 39.90923]);
    });

    test('setZoom 更新缩放级别', function () {
      picker.setZoom(12);
      expect(picker.options.defaultZoom).toBe(12);
    });

    test('destroy 销毁组件', function () {
      picker.destroy();
      expect(picker._destroyed).toBe(true);
      expect(document.querySelector('.amap-picker')).toBeNull();
    });

    test('destroy 后 API 调用不报错', function () {
      picker.destroy();
      expect(function () { picker.open(); }).not.toThrow();
      expect(function () { picker.close(); }).not.toThrow();
      expect(function () { picker.locate(1, 2); }).not.toThrow();
    });
  });

  describe('地图交互', function () {
    var picker;

    beforeEach(function () {
      jest.useFakeTimers();
      picker = new AmapPicker({
        apiKey: 'test-key',
        container: 'body',
        AMap: mockAMap.AMap
      });
    });

    afterEach(function () {
      picker.destroy();
      jest.useRealTimers();
    });

    test('打开弹窗后初始化地图', function () {
      picker.open();
      jest.advanceTimersByTime(500);
      expect(picker._map).not.toBeNull();
      expect(mockAMap.maps.length).toBe(1);
    });

    test('地图点击更新选中坐标', function () {
      picker.open();
      jest.advanceTimersByTime(500);
      var mapInstance = mockAMap.maps[0];
      mapInstance.simulateClick(113.5, 23.2);

      expect(picker._selectedLng).toBe(113.5);
      expect(picker._selectedLat).toBe(23.2);
    });

    test('地图点击触发 select 事件', function () {
      var received = null;
      picker.on('select', function (data) { received = data; });

      picker.open();
      jest.advanceTimersByTime(500);
      var mapInstance = mockAMap.maps[0];
      mapInstance.simulateClick(113.5, 23.2);

      expect(received).not.toBeNull();
      expect(received.lng).toBe(113.5);
      expect(received.lat).toBe(23.2);
      expect(received.isFromGotoBtn).toBe(false);
    });

    test('确认选点触发 confirm 事件', function () {
      var received = null;
      picker.on('confirm', function (data) { received = data; });

      picker.open();
      jest.advanceTimersByTime(500);
      var mapInstance = mockAMap.maps[0];
      mapInstance.simulateClick(113.5, 23.2);

      picker._confirmSelection();
      expect(received).not.toBeNull();
      expect(received.lng).toBe(113.5);
      expect(received.lat).toBe(23.2);
    });

    test('确认选点添加到历史记录', function () {
      picker.open();
      jest.advanceTimersByTime(500);
      var mapInstance = mockAMap.maps[0];
      mapInstance.simulateClick(113.5, 23.2);
      picker._confirmSelection();

      var history = picker.getHistory();
      expect(history.length).toBe(1);
      expect(history[0].lng).toBe(113.5);
    });
  });

  describe('定位按钮', function () {
    var picker;

    beforeEach(function () {
      picker = new AmapPicker({
        apiKey: 'test-key',
        container: 'body',
        AMap: mockAMap.AMap
      });
    });

    afterEach(function () {
      picker.destroy();
    });

    test('输入有效坐标点击定位打开弹窗', function () {
      picker._elements.inputLng.value = '113.5';
      picker._elements.inputLat.value = '23.2';
      picker._handleGoto();

      var overlay = document.querySelector('.amap-picker-modal-overlay');
      expect(overlay.classList.contains('active')).toBe(true);
    });

    test('空输入使用 placeholder 值', function () {
      picker._handleGoto();
      // parseFloat('113.337680') = 113.33768，回填时 number input 会去掉尾零
      expect(parseFloat(picker._elements.inputLng.value)).toBeCloseTo(113.33768, 5);
      expect(parseFloat(picker._elements.inputLat.value)).toBeCloseTo(23.141447, 5);
    });

    test('超出范围坐标触发 error 事件', function () {
      var errorReceived = null;
      picker.on('error', function (err) { errorReceived = err; });

      picker._elements.inputLng.value = '999';
      picker._elements.inputLat.value = '23.2';
      picker._handleGoto();

      expect(errorReceived).not.toBeNull();
    });

    test('定位按钮标记 isFromGotoBtn=true', function () {
      picker._elements.inputLng.value = '113.5';
      picker._elements.inputLat.value = '23.2';
      picker._handleGoto();

      expect(picker._isFromGotoBtn).toBe(true);
    });
  });

  describe('版本号', function () {
    test('有版本号属性', function () {
      expect(AmapPicker.version).toBeDefined();
      expect(typeof AmapPicker.version).toBe('string');
    });
  });
});
