require('dotenv').config();

var express = require('express');
var path = require('path');
var { createAmapProxy } = require('./src/proxy-middleware');

var app = express();
var PORT = process.env.PORT || 3001;

var AMAP_KEY = process.env.AMAP_KEY;
var AMAP_SECURITY_KEY = process.env.AMAP_SECURITY_KEY;

if (!AMAP_KEY || !AMAP_SECURITY_KEY) {
  console.error('Error: AMAP_KEY and AMAP_SECURITY_KEY must be set in .env');
  process.exit(1);
}

// 静态文件
app.use(express.static(path.join(__dirname, 'public')));

// 高德地图反向代理
app.use('/_AMapService', createAmapProxy({ securityKey: AMAP_SECURITY_KEY }));

app.listen(PORT, function () {
  console.log('Server running at http://localhost:' + PORT);
});
