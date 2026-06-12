/**
 * 反向代理中间件测试
 */

var { createAmapProxy, proxyRequest } = require('../src/proxy-middleware');

describe('createAmapProxy', function () {

  test('缺少 securityKey 应抛出错误', function () {
    expect(function () {
      createAmapProxy();
    }).toThrow('securityKey is required');

    expect(function () {
      createAmapProxy({});
    }).toThrow('securityKey is required');
  });

  test('返回一个中间件函数', function () {
    var middleware = createAmapProxy({ securityKey: 'test-key' });
    expect(typeof middleware).toBe('function');
    expect(middleware.name).toBe('amapProxy');
  });

  test('中间件处理 /v4/map/styles 路径', function () {
    var middleware = createAmapProxy({ securityKey: 'test-jscode' });
    var req = {
      path: '/v4/map/styles',
      query: {},
      get: function () { return ''; }
    };
    var res = {
      set: function () {},
      status: function () { return this; },
      send: function () {}
    };
    var next = function () {};

    // 不应抛出错误
    expect(function () {
      middleware(req, res, next);
    }).not.toThrow();
  });

  test('中间件处理其他路径', function () {
    var middleware = createAmapProxy({ securityKey: 'test-jscode' });
    var req = {
      path: '/v3/geocode/regeo',
      query: { location: '113.337,23.141' },
      get: function () { return ''; }
    };
    var res = {
      set: function () {},
      status: function () { return this; },
      send: function () {}
    };
    var next = function () {};

    expect(function () {
      middleware(req, res, next);
    }).not.toThrow();
  });
});

describe('proxyRequest', function () {

  test('是可导出的函数', function () {
    expect(typeof proxyRequest).toBe('function');
  });
});
