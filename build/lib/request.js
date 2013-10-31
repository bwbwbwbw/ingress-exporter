(function() {
  var C, Request, cookies, needle, pool, sendRequest, v, _i, _len, _ref;

  needle = require('needle');

  pool = [];

  cookies = {};

  _ref = Config.Auth.CookieRaw.split(';');
  for (_i = 0, _len = _ref.length; _i < _len; _i++) {
    v = _ref[_i];
    C = v.trim().split('=');
    cookies[C[0]] = unescape(C[1]);
  }

  Request = GLOBAL.Request = {
    add: function(options) {
      var activeMunge, methodName, post_data, versionStr;
      activeMunge = Config.Munges.Data[Config.Munges.ActiveSet];
      methodName = 'dashboard.' + options.action;
      versionStr = 'version_parameter';
      methodName = activeMunge[methodName];
      versionStr = activeMunge[versionStr];
      post_data = Utils.requestDataMunge(Utils.extend({
        method: methodName,
        version: versionStr
      }, options.data));
      pool.push({
        m: methodName,
        d: post_data,
        success: options.onSuccess,
        error: options.onError,
        request: options.beforeRequest,
        response: options.afterResponse
      });
      Request.maxRequest++;
      if (Request.activeRequests < Config.Request.MaxParallel) {
        return sendRequest();
      }
    }
  };

  Request.pool = pool;

  Request.maxRequest = 0;

  Request.requested = 0;

  Request.activeRequests = 0;

  sendRequest = function() {
    if (pool.length === 0) {
      return;
    }
    v = pool.shift();
    Request.activeRequests++;
    return needle.post('http://www.ingress.com/r/' + v.m, JSON.stringify(v.d), {
      compressed: true,
      headers: {
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'Content-type': 'application/json; charset=utf-8',
        'Cookie': Config.Auth.CookieRaw,
        'Host': 'www.ingress.com',
        'Origin': 'http://www.ingress.com',
        'Referer': 'http://www.ingress.com/intel',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_8_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/30.0.1599.101 Safari/537.36',
        'X-CSRFToken': cookies.csrftoken
      }
    }, function(error, response, body) {
      var i, _j, _ref1, _results;
      if (v.emitted != null) {
        console.log('ignore re-emitted event', error, body);
        return;
      }
      v.emitted = true;
      Request.activeRequests--;
      Request.requested++;
      if (error) {
        v.error && v.error(error);
        v.response && v.response(error);
        return;
      }
      if (body === 'User not authenticated') {
        logger.error('[Auth] Authorize failed. Please update the cookie.');
        process.exit(0);
        return;
      }
      v.success && v.success(body);
      v.response && v.response(null);
      _results = [];
      for (i = _j = 1, _ref1 = Math.min(pool.length, Config.Request.MaxParallel - Request.activeRequests); 1 <= _ref1 ? _j <= _ref1 : _j >= _ref1; i = 1 <= _ref1 ? ++_j : --_j) {
        _results.push(sendRequest());
      }
      return _results;
    });
  };

}).call(this);
