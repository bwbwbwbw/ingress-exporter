(function() {
  var C, RequestFactory, async, cookies, needle, v, _i, _len, _ref;

  needle = require('needle');

  async = require('async');

  cookies = {};

  _ref = Config.Auth.CookieRaw.split(';');
  for (_i = 0, _len = _ref.length; _i < _len; _i++) {
    v = _ref[_i];
    C = v.trim().split('=');
    cookies[C[0]] = unescape(C[1]);
  }

  RequestFactory = (function() {
    function RequestFactory() {
      var _this = this;
      this.max = 0;
      this.done = 0;
      this.munge = null;
      this.queue = async.queue(function(task, callback) {
        return _this.post('/r/' + task.m, task.d, function(error, response, body) {
          if (error) {
            console.log(error.stack);
          }
          if (task.emitted != null) {
            console.warn('[DEBUG] Ignored reemitted event');
            return;
          }
          task.emitted = true;
          _this.done++;
          if (error || !_this.processResponse(error, response, body)) {
            task.error(error, function() {
              return task.response(function() {
                return callback();
              });
            });
            return;
          }
          return task.success(body, function() {
            return task.response(function() {
              return callback();
            });
          });
        });
      }, Config.Request.MaxParallel);
    }

    RequestFactory.prototype.generate = function(options) {
      var activeMunge, methodName, post_data, versionStr;
      if (this.munge === null) {
        activeMunge = Munges.Data[Munges.ActiveSet];
      } else {
        activeMunge = this.munge;
      }
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
        success: options.onSuccess || function(body, callback) {
          return callback();
        },
        error: options.onError || function(error, callback) {
          return callback();
        },
        response: options.afterResponse || function(callback) {
          return callback();
        }
      };
    };

    RequestFactory.prototype.push = function(options) {
      var task;
      this.max++;
      task = this.generate(options);
      return this.queue.push(task);
    };

    RequestFactory.prototype.unshift = function(options) {
      var task;
      this.max++;
      task = this.generate(options);
      return this.queue.unshift(task);
    };

    RequestFactory.prototype.post = function(url, data, callback) {
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
    };

    RequestFactory.prototype.get = function(url, callback) {
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
    };

    RequestFactory.prototype.processResponse = function(error, response, body) {
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
        logger.error('[DEBUG] Unknown server response');
        return false;
      }
      return true;
    };

    return RequestFactory;

  })();

  module.exports = function() {
    return new RequestFactory();
  };

}).call(this);
