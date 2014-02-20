(function() {
  var RequestFactory, async, http, request, zlib;

  http = require('http');

  request = require('request');

  zlib = require('zlib');

  async = require('async');

  RequestFactory = (function() {
    function RequestFactory() {
      var cookie, pair, _i, _len, _ref;
      this.max = 0;
      this.done = 0;
      this.munge = null;
      this.cookies = {};
      this.cookieJar = null;
      _ref = Config.Auth.CookieRaw.split(';');
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        cookie = _ref[_i];
        cookie = cookie.trim();
        if (cookie.length === 0) {
          continue;
        }
        pair = cookie.split('=');
        this.cookies[pair[0]] = unescape(pair[1]);
      }
      this.resetCookies();
      this.queue = async.queue((function(_this) {
        return function(task, callback) {
          return task.before(function() {
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
              if (!error) {
                if (body.error != null) {
                  error = new Error(body.error);
                } else {
                  error = _this.processResponse(error, response, body);
                }
              }
              if (error) {
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
          });
        };
      })(this), Config.Request.MaxParallel);
    }

    RequestFactory.prototype.resetCookies = function() {
      var cookie, _i, _len, _ref, _results;
      this.cookieJar = request.jar();
      _ref = Config.Auth.CookieRaw.split(';');
      _results = [];
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        cookie = _ref[_i];
        cookie = cookie.trim();
        if (cookie.length !== 0) {
          _results.push(this.cookieJar.setCookie(request.cookie(cookie), 'http://www.ingress.com'));
        } else {
          _results.push(void 0);
        }
      }
      return _results;
    };

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
        before: options.beforeRequest || function(callback) {
          return callback();
        },
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
      return request.post({
        url: 'http://www.ingress.com' + url,
        body: JSON.stringify(data),
        jar: this.cookieJar,
        maxSockets: 50,
        encoding: null,
        timeout: 20000,
        headers: {
          'Accept': 'application/json, text/javascript, */*; q=0.01',
          'Accept-Encoding': 'gzip,deflate',
          'Content-type': 'application/json; charset=utf-8',
          'Origin': 'http://www.ingress.com',
          'Referer': 'http://www.ingress.com/intel',
          'User-Agent': Config.Request.UserAgent,
          'X-CSRFToken': this.cookies.csrftoken
        }
      }, this._gzipDecode(this._jsonDecode(callback)));
    };

    RequestFactory.prototype.get = function(url, callback) {
      return request.get({
        url: 'http://www.ingress.com' + url,
        jar: this.cookieJar,
        maxSockets: 50,
        encoding: null,
        timeout: 20000,
        headers: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Encoding': 'gzip,deflate',
          'Cache-Control': 'max-age=0',
          'Origin': 'http://www.ingress.com',
          'Referer': 'http://www.ingress.com/intel',
          'User-Agent': Config.Request.UserAgent
        }
      }, this._gzipDecode(callback));
    };

    RequestFactory.prototype.processResponse = function(error, response, body) {
      if (typeof body === 'string') {
        if (body.indexOf('CSRF verification failed. Request aborted.') > -1) {
          logger.error('[Auth] CSRF verification failed. Please make sure that the cookie is right.');
          process.exit(0);
          return false;
        }
        if (body.indexOf('User not authenticated') > -1) {
          logger.error('[Auth] Authentication failed. Please update the cookie.');
          process.exit(0);
          return false;
        }
        return new Error('Unknown server response');
      }
      return null;
    };

    RequestFactory.prototype._gzipDecode = function(callback) {
      return function(error, response, buffer) {
        var encoding;
        if (error != null) {
          callback(error, response);
          return;
        }
        if (response.headers['content-encoding'] != null) {
          encoding = response.headers['content-encoding'];
          if (encoding === 'gzip') {
            zlib.gunzip(buffer, function(err, body) {
              return callback(err, response, body && body.toString());
            });
            return;
          } else if (encoding === 'deflate') {
            zlib.inflate(buffer, function(err, body) {
              return callback(err, response, body && body.toString());
            });
            return;
          }
        }
        return callback(error, response, buffer && buffer.toString());
      };
    };

    RequestFactory.prototype._jsonDecode = function(callback) {
      return function(error, response, body) {
        var decoded, err;
        if (error != null) {
          callback(error, response);
          return;
        }
        if (response.headers['content-type'] != null) {
          if (response.headers['content-type'].indexOf('json') > -1) {
            try {
              decoded = JSON.parse(body);
            } catch (_error) {
              err = _error;
              callback(err, response, body);
              return;
            }
            callback(err, response, decoded);
            return;
          }
        }
        return callback(error, response, body);
      };
    };

    return RequestFactory;

  })();

  module.exports = function() {
    return new RequestFactory();
  };

}).call(this);
