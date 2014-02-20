(function() {
  var AccountInfo, async, request, requestFactory;

  async = require('async');

  requestFactory = require('./request.js');

  request = requestFactory();

  AccountInfo = GLOBAL.AccountInfo = {
    fetch: function(callback) {
      logger.info('[AccountInfo] Fetching current account information...');
      return (function(callback) {
        return request.get('/intel', function(error, response, body) {
          var MAGIC_1, MAGIC_2, e, p1, p2, player;
          if (error) {
            return callback(error);
          }
          body = body.toString();
          MAGIC_1 = 'var PLAYER = ';
          MAGIC_2 = ';';
          p1 = body.indexOf(MAGIC_1);
          p2 = body.indexOf(MAGIC_2, p1 + MAGIC_1.length);
          if (p1 === -1 || p2 === -1) {
            return callback(new Error('Failed to fetch information.'));
          }
          try {
            player = JSON.parse(body.substring(p1 + MAGIC_1.length, p2));
          } catch (_error) {
            e = _error;
            return callback(new Error('Failed to parse player information.'));
          }
          return callback(null, player);
        });
      })(function(err, player) {
        if (err) {
          logger.error('[AccountInfo] %s', err.message);
          process.exit(0);
          return;
        }
        logger.info('[AccountInfo] %s (%s)', player.nickname, player.team);
        logger.warn('[AccountInfo] %s', 'Please immediately press Ctrl+C if you are using an incorrect account.'.yellow.inverse);
        return callback();
      });
    }
  };

}).call(this);
