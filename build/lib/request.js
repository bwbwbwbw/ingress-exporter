(function() {
  var C, Request, async, cookies, needle, v, _i, _len, _ref;

  needle = require('needle');

  async = require('async');

  cookies = {};

  _ref = Config.Auth.CookieRaw.split(';');
  for (_i = 0, _len = _ref.length; _i < _len; _i++) {
    v = _ref[_i];
    C = v.trim().split('=');
    cookies[C[0]] = unescape(C[1]);
  }

  Request = GLOBAL.Request = {
    generate: function(options) {
      var activeMunge, methodName, post_data, versionStr;
      activeMunge = options.munge != null ? options.munge : Munges.Data[Munges.ActiveSet];
      methodName = 'dashboard.' + options.action;
      versionStr = 'version_parameter';
      methodName = activeMunge[methodName];
      versionStr = activeMunge[versionStr];
      post_data = Utils.requestDataMunge(Utils.extend({
        method: methodName,
        version: versionStr
      }, options.data), activeMunge);
      return {
        m: methodName,
        d: post_data,
        success: options.onSuccess,
        error: options.onError,
        request: options.beforeRequest,
        response: options.afterResponse,
        delayobj: {
          schedule: noop
        }
      };
    },
    add: function(options) {
      var task;
      task = Request.generate(options);
      Request.queue.push(task);
      Request.maxRequest++;
      return task.delayobj;
    },
    post: function(url, data, callback) {
      return needle.post('http://www.ingress.com' + url, JSON.stringify(data), {
        compressed: true,
        timeout: 20000,
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
      }, callback);
    },
    get: function(url, callback) {
      return needle.get('http://www.ingress.com' + url, {
        compressed: true,
        timeout: 20000,
        headers: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Cookie': Config.Auth.CookieRaw,
          'Host': 'www.ingress.com',
          'Cache-Control': 'max-age=0',
          'Origin': 'http://www.ingress.com',
          'Referer': 'http://www.ingress.com/intel',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_8_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/30.0.1599.101 Safari/537.36'
        }
      }, callback);
    },
    processResponse: function(error, response, body) {
      if (typeof body === 'string') {
        if (body.indexOf('CSRF verification failed. Request aborted.' > -1)) {
          logger.error('[Auth] CSRF verification failed. Please make sure that the cookie is right.');
          process.exit(0);
          return false;
        }
        if (body.indexOf('User not authenticated' > -1)) {
          logger.error('[Auth] Authentication failed. Please update the cookie.');
          process.exit(0);
          return false;
        }
        return false;
      }
      return true;
    }
  };

  Request.queue = async.queue(function(task, callback) {
    var func;
    Request.activeRequests++;
    func = function() {
      return Request.post('/r/' + task.m, task.d, function(error, response, body) {
        if (task.emitted != null) {
          console.warn('[DEBUG] Ignored reemitted event');
          return;
        }
        task.emitted = true;
        Request.activeRequests--;
        Request.requested++;
        if (error) {
          task.error && task.error(error);
          task.response && task.response(error);
          callback();
          return;
        }
        if (!Request.processResponse(error, response, body)) {
          logger.error('[DEBUG] Unknown server response');
          callback();
          return;
        }
        task.success && task.success(body);
        task.response && task.response(null);
        return callback();
      });
    };
    if (task.delayobj.schedule === null) {
      return func();
    } else {
      return task.delayobj.schedule = func;
    }
  }, Config.Request.MaxParallel);

  Request.queue.drain = exitProcess;

  Request.maxRequest = 0;

  Request.requested = 0;

  Request.activeRequests = 0;

}).call(this);
