(function() {
  var C, Request, cookies, jar, pool, r, req, reqCount, sendRequest, v, zlib, _i, _len, _ref;

  r = require('request');

  zlib = require('zlib');

  jar = r.jar();

  req = r.defaults({
    jar: jar
  });

  pool = [];

  reqCount = 0;

  cookies = {};

  _ref = Config.Auth.CookieRaw.split(';');
  for (_i = 0, _len = _ref.length; _i < _len; _i++) {
    v = _ref[_i];
    v = v.trim();
    C = v.split('=');
    cookies[C[0]] = unescape(C[1]);
    jar.add(r.cookie(v));
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
      if (reqCount < Config.Request.MaxParallel) {
        return sendRequest();
      }
    }
  };

  Request.pool = pool;

  Request.maxRequest = 0;

  Request.requested = 0;

  sendRequest = function() {
    var bodyLen, buffer;
    if (pool.length === 0) {
      return;
    }
    v = pool.shift();
    reqCount++;
    buffer = [];
    bodyLen = 0;
    v.request || v.request();
    return req({
      url: 'http://www.ingress.com/r/' + v.m,
      method: 'POST',
      body: JSON.stringify(v.d),
      encoding: null,
      headers: {
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'Accept-Encoding': 'gzip,deflate',
        'Accept-Language': 'zh-CN,zh;q=0.8',
        'Content-type': 'application/json; charset=utf-8',
        'Host': 'www.ingress.com',
        'Origin': 'http://www.ingress.com',
        'Referer': 'http://www.ingress.com/intel',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_8_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/30.0.1599.101 Safari/537.36',
        'X-CSRFToken': cookies.csrftoken
      }
    }).on('error', function(err) {
      if (v.errorEmited != null) {
        return;
      }
      reqCount--;
      Request.requested++;
      v.errorEmited = true;
      v.error && v.error(err);
      return v.response && v.response(err);
    }).pipe(zlib.createGunzip().on('error', function(err) {
      if (v.errorEmited != null) {
        return;
      }
      reqCount--;
      Request.requested++;
      v.errorEmited = true;
      v.error && v.error(err);
      return v.response && v.response(err);
    }).on('data', function(chunk) {
      buffer.push(chunk);
      return bodyLen += chunk.length;
    }).on('end', function() {
      var body, chunk, err, i, _j, _k, _len1, _ref1, _results;
      reqCount--;
      Request.requested++;
      body = new Buffer(bodyLen);
      i = 0;
      for (_j = 0, _len1 = buffer.length; _j < _len1; _j++) {
        chunk = buffer[_j];
        chunk.copy(body, i, 0, chunk.length);
        i += chunk.length;
      }
      body = body.toString();
      if (body === 'User not authenticated') {
        logger.error('[Auth] Authorize failed. Please update the cookie.');
        process.exit(0);
        return;
      }
      try {
        body = JSON.parse(body);
      } catch (_error) {
        err = _error;
        if (v.errorEmited != null) {
          return;
        }
        v.errorEmited = true;
        v.error && v.error(err);
        v.response && v.response(err);
        return;
      }
      v.success && v.success(body);
      v.response && v.response(null);
      _results = [];
      for (i = _k = 1, _ref1 = Math.min(pool.length, Config.Request.MaxParallel - reqCount); 1 <= _ref1 ? _k <= _ref1 : _k >= _ref1; i = 1 <= _ref1 ? ++_k : --_k) {
        _results.push(sendRequest());
      }
      return _results;
    }));
  };

}).call(this);
