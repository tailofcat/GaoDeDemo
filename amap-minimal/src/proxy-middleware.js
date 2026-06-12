/**
 * 高德地图反向代理中间件
 *
 * 用于 Express 应用，将 /_AMapService 请求代理到高德 API，
 * 并自动附加安全密钥 (jscode)
 *
 * @example
 * const { createAmapProxy } = require('amap-picker');
 * app.use('/_AMapService', createAmapProxy({ securityKey: 'your_jscode' }));
 */

/**
 * 代理请求到高德 API
 * @param {object} req - Express request
 * @param {object} res - Express response
 * @param {string} targetBase - 目标基础 URL
 * @param {string} stripPrefix - 需要移除的路径前缀
 * @param {object} extraParams - 附加查询参数
 */
async function proxyRequest(req, res, targetBase, stripPrefix, extraParams) {
  try {
    var subPath = req.path.slice(stripPrefix.length) || '/';
    var url = new URL(subPath, targetBase);

    for (var k in req.query) {
      if (req.query.hasOwnProperty(k)) {
        url.searchParams.set(k, req.query[k]);
      }
    }
    for (var k in extraParams) {
      if (extraParams.hasOwnProperty(k) && !url.searchParams.has(k)) {
        url.searchParams.set(k, extraParams[k]);
      }
    }

    var upstream = await fetch(url.toString(), {
      headers: {
        'User-Agent': req.get('user-agent') || '',
        'Referer': req.get('referer') || '',
      },
    });

    var contentType = upstream.headers.get('content-type') || '';
    res.set('Content-Type', contentType);
    res.status(upstream.status);
    var body = await upstream.text();
    res.send(body);
  } catch (err) {
    console.error('Proxy error:', err.message);
    res.status(502).send('Bad Gateway');
  }
}

/**
 * 创建高德地图代理中间件
 * @param {object} options - 配置项
 * @param {string} options.securityKey - 高德地图安全密钥 (jscode)
 * @param {string} [options.path='/_AMapService'] - 代理路径前缀
 * @returns {function} Express 中间件
 */
function createAmapProxy(options) {
  if (!options || !options.securityKey) {
    throw new Error('createAmapProxy: securityKey is required');
  }

  var securityKey = options.securityKey;

  return function amapProxy(req, res, next) {
    var path = req.path;

    // 样式资源代理到 webapi.amap.com
    if (path.startsWith('/v4/map/styles')) {
      proxyRequest(req, res, 'https://webapi.amap.com', '/v4/map/styles', { jscode: securityKey });
      return;
    }

    // 其他请求代理到 restapi.amap.com
    proxyRequest(req, res, 'https://restapi.amap.com', '/', { jscode: securityKey });
  };
}

module.exports = { createAmapProxy, proxyRequest };
