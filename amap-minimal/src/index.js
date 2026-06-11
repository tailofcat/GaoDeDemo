/**
 * amap-picker 模块入口
*
* 提供高德地图选点组件和反向代理中间件
*/

var AmapPicker = require('./amap-picker');
var proxyMiddleware = require('./proxy-middleware');

module.exports = AmapPicker;
module.exports.AmapPicker = AmapPicker;
module.exports.createAmapProxy = proxyMiddleware.createAmapProxy;
module.exports.proxyRequest = proxyMiddleware.proxyRequest;
