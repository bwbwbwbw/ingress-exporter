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
    add: function(options) {
      var activeMunge, delayObject, methodName, post_data, versionStr;
      activeMunge = Config.Munges.Data[Config.Munges.ActiveSet];
      methodName = 'dashboard.' + options.action;
      versionStr = 'version_parameter';
      methodName = activeMunge[methodName];
      versionStr = activeMunge[versionStr];
      post_data = Utils.requestDataMunge(Utils.extend({
        method: methodName,
        version: versionStr
      }, options.data));
      delayObject = {
        schedule: noop
      };
      Request.queue.push({
        m: methodName,
        d: post_data,
        success: options.onSuccess,
        error: options.onError,
        request: options.beforeRequest,
        response: options.afterResponse,
        delayobj: delayObject
      });
      Request.maxRequest++;
      return delayObject;
    }
  };

  Request.queue = async.queue(function(task, callback) {
    var func;
    Request.activeRequests++;
    func = function() {
      return needle.post('http://www.ingress.com/r/' + task.m, JSON.stringify(task.d), {
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
        if (typeof body === 'string') {
          if (body.indexOf('CSRF verification failed. Request aborted.' > -1)) {
            logger.error('[Auth] CSRF verification failed. Please make sure that the cookie is right.');
            process.exit(0);
            return;
          }
          if (body.indexOf('User not authenticated' > -1)) {
            logger.error('[Auth] Authentication failed. Please update the cookie.');
            process.exit(0);
            return;
          }
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
