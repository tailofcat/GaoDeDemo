# AmapPicker 接口文档

> 高德地图选点组件 - 可插拔的弹窗式地图选点模块

版本：1.0.0

## 快速开始

### 安装

将 `src/` 目录复制到你的项目中，或通过 npm 安装（如已发布）：

```bash
npm install amap-picker
```

### 前端使用

```html
<!-- 1. 引入组件脚本 -->
<script src="src/amap-picker.js"></script>

<!-- 2. 创建挂载点 -->
<div id="map-picker-mount"></div>

<!-- 3. 初始化 -->
<script>
  var picker = new AmapPicker({
    container: '#map-picker-mount',
    apiKey: '你的高德地图Key',
    securityHost: '/_AMapService',
    defaultCenter: [113.337680, 23.141447],
    defaultZoom: 18
  });

  picker.on('confirm', function(data) {
    console.log('选中:', data.lng, data.lat);
  });
</script>
```

### 服务端配置

```javascript
const { createAmapProxy } = require('amap-picker');
const express = require('express');
const app = express();

// 挂载反向代理中间件
app.use('/_AMapService', createAmapProxy({
  securityKey: process.env.AMAP_SECURITY_KEY
}));
```

---

## 配置项 (Options)

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `container` | `string \| Element` | `'body'` | 组件挂载容器，CSS 选择器或 DOM 元素 |
| `apiKey` | `string` | `''` | **必填** 高德地图 JS API Key |
| `securityHost` | `string` | `'/_AMapService'` | 安全代理路径，对应服务端中间件挂载路径 |
| `defaultCenter` | `[number, number]` | `[113.337680, 23.141447]` | 地图默认中心点 [经度, 纬度] |
| `defaultZoom` | `number` | `18` | 地图默认缩放级别 |
| `placeholder` | `object` | `{lng:'113.337680', lat:'23.141447'}` | 输入框占位符 |
| `titles` | `object` | 见下方 | 区域标题配置 |
| `modalWidth` | `string` | `'90%'` | 弹窗宽度 |
| `modalMaxWidth` | `string` | `'900px'` | 弹窗最大宽度 |
| `modalHeight` | `string` | `'80%'` | 弹窗高度 |
| `previewHeight` | `string` | `'180px'` | 预览框高度 |
| `historyMaxHeight` | `string` | `'300px'` | 历史记录列表最大高度 |
| `markerIcons` | `object` | 见下方 | 标记图标 URL 配置 |
| `AMap` | `object` | `window.AMap` | AMap 引用，可注入用于测试 |

### titles 子配置

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `coordSection` | `'规划站点坐标'` | 坐标输入区域标题 |
| `mapSection` | `'选址地图'` | 地图选点区域标题 |
| `mapTip` | `'点击地图插入候选站点'` | 地图提示文字 |

### markerIcons 子配置

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `red` | `'https://webapi.amap.com/.../mark_r.png'` | 红色标记图标（定位按钮来源） |
| `blue` | `'https://webapi.amap.com/.../mark_b.png'` | 蓝色标记图标（地图点击来源） |

---

## 事件 (Events)

通过 `picker.on(eventName, callback)` 监听。

### `select`

地图上点击选点时触发。

```javascript
picker.on('select', function(data) {
  // data.lng - 经度 (number)
  // data.lat - 纬度 (number)
  // data.isFromGotoBtn - 是否来自定位按钮 (boolean，地图点击始终为 false)
});
```

### `confirm`

用户点击"确认"按钮时触发。

```javascript
picker.on('confirm', function(data) {
  // data.lng - 经度 (number)
  // data.lat - 纬度 (number)
  // data.isFromGotoBtn - 是否来自定位按钮 (boolean)
});
```

### `open`

弹窗打开时触发。

```javascript
picker.on('open', function() {});
```

### `close`

弹窗关闭时触发。

```javascript
picker.on('close', function() {});
```

### `historyChange`

历史记录发生变化时触发（添加、删除、清空）。

```javascript
picker.on('historyChange', function(history) {
  // history - 当前历史记录数组的副本 (Array)
  // 每项: { lng, lat, time, isFromGotoBtn }
});
```

### `useHistory`

用户点击历史记录的"使用"按钮时触发。

```javascript
picker.on('useHistory', function(data) {
  // data.lng - 经度
  // data.lat - 纬度
  // data.isFromGotoBtn - 是否来自定位按钮
});
```

### `error`

发生错误时触发（如无效坐标）。

```javascript
picker.on('error', function(err) {
  // err - Error 对象
});
```

### `destroy`

组件销毁时触发。

```javascript
picker.on('destroy', function() {});
```

---

## 公共方法 (API)

### `open([lng, lat])`

打开地图弹窗。

| 参数 | 类型 | 说明 |
|------|------|------|
| `lng` | `number` | 可选，打开后定位到此经度 |
| `lat` | `number` | 可选，打开后定位到此纬度 |

```javascript
picker.open();                    // 打开弹窗，使用默认中心
picker.open(116.397428, 39.90923); // 打开并定位到指定坐标
```

### `close()`

关闭地图弹窗，清除选中状态和标记。

```javascript
picker.close();
```

### `locate(lng, lat)`

定位到指定坐标，以红色标记显示，并打开弹窗。同时回填输入框。

| 参数 | 类型 | 说明 |
|------|------|------|
| `lng` | `number` | 经度 |
| `lat` | `number` | 纬度 |

```javascript
picker.locate(116.397428, 39.90923);
```

### `getHistory()`

获取历史记录数组的副本。

**返回值：** `Array<{ lng: number, lat: number, time: string, isFromGotoBtn: boolean }>`

```javascript
var history = picker.getHistory();
// [{ lng: 113.5, lat: 23.2, time: '2026/6/11 10:30:00', isFromGotoBtn: true }, ...]
```

### `clearHistory()`

清空所有历史记录。触发 `historyChange` 事件。

```javascript
picker.clearHistory();
```

### `getSelected()`

获取当前选中的坐标。

**返回值：** `{ lng: number, lat: number, isFromGotoBtn: boolean } | null`

```javascript
var selected = picker.getSelected();
// { lng: 113.5, lat: 23.2, isFromGotoBtn: false } 或 null
```

### `setCenter(lng, lat)`

设置地图默认中心点。

| 参数 | 类型 | 说明 |
|------|------|------|
| `lng` | `number` | 经度 |
| `lat` | `number` | 纬度 |

```javascript
picker.setCenter(116.397428, 39.90923);
```

### `setZoom(zoom)`

设置地图默认缩放级别。

| 参数 | 类型 | 说明 |
|------|------|------|
| `zoom` | `number` | 缩放级别（3-20） |

```javascript
picker.setZoom(15);
```

### `on(event, callback)`

监听事件。返回组件实例（支持链式调用）。

### `off(event, [callback])`

移除事件监听。不传 `callback` 则移除该事件的所有监听器。

### `destroy()`

销毁组件，释放地图实例和 DOM 元素。销毁后所有 API 调用安全返回。

```javascript
picker.destroy();
```

---

## 服务端 API

### `createAmapProxy(options)`

创建高德地图反向代理 Express 中间件。

| 参数 | 类型 | 说明 |
|------|------|------|
| `options.securityKey` | `string` | **必填** 高德地图安全密钥 (jscode) |

**返回值：** Express 中间件函数

```javascript
const { createAmapProxy } = require('amap-picker');

app.use('/_AMapService', createAmapProxy({
  securityKey: 'your_jscode_here'
}));
```

中间件行为：
- `/v4/map/styles` 路径代理到 `https://webapi.amap.com`
- 其他路径代理到 `https://restapi.amap.com`
- 自动附加 `jscode` 参数

---

## 标记颜色规则

| 来源 | 颜色 | 说明 |
|------|------|------|
| 定位按钮 | 红色 (`mark_r.png`) | 通过输入坐标点击"定位"按钮产生 |
| 地图点击 | 蓝色 (`mark_b.png`) | 在地图上直接点击选点产生 |

---

## 环境变量

服务端需要配置 `.env` 文件：

```env
AMAP_KEY=你的高德地图APIKey
AMAP_SECURITY_KEY=你的安全密钥
PORT=3001
```

---

## 项目结构

```
amap-picker/
├── src/
│   ├── amap-picker.js       # 前端组件（UMD 模块）
│   ├── proxy-middleware.js   # Express 反向代理中间件
│   └── index.js              # Node.js 入口
├── public/
│   └── index.html            # 演示页面
├── test/
│   ├── amap-picker.test.js   # 组件测试
│   └── proxy-middleware.test.js # 中间件测试
├── server.js                 # 演示服务器
├── package.json
├── .env.example
└── .gitignore
```

---

## 集成到现有项目

### 方式一：脚本引入

```html
<script src="/path/to/amap-picker.js"></script>
<script>
  var picker = new AmapPicker({ ... });
</script>
```

### 方式二：CommonJS

```javascript
var AmapPicker = require('amap-picker');
var picker = new AmapPicker({ ... });
```

### 方式三：服务端中间件

```javascript
var { createAmapProxy } = require('amap-picker');
app.use('/_AMapService', createAmapProxy({ securityKey: 'xxx' }));
```
