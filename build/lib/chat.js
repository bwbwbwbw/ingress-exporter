(function() {
  var Chat, async;

  async = require('async');

  Chat = GLOBAL.Chat = {
    tasks: {},
    createTasks: function(timestampMin, callback) {
      var timestampMax;
      return timestampMax = new Date().getTime();
    },
    prepareFromDatabase: function(callback) {
      var timestampMin;
      logger.info("[Broadcasts] Continue: [" + Config.Region.SouthWest.Lat + "," + Config.Region.SouthWest.Lng + "]-[" + Config.Region.NorthEast.Lat + "," + Config.Region.NorthEast.Lng + "]");
      timestampMin = -1;
      return async.series([
        function(callback) {
          return Database.db.collection('Chat._queue').find().toArray(function(err, tasks) {
            var task, _i, _len;
            if (tasks != null) {
              for (_i = 0, _len = tasks.length; _i < _len; _i++) {
                task = tasks[_i];
                tasks[task._id] = task;
              }
            }
            return callback();
          });
        }, function(callback) {
          return Database.db.collection('Chat._data').findOne({
            id: 'last_task'
          }, function(err, data) {
            if (data != null) {
              timestampMin = data.timestamp;
            }
            return callback();
          });
        }, function(callback) {
          return Chat.createTasks(timestampMin, callback);
        }, callback
      ]);
    },
    prepareNew: function(callback) {
      logger.info("[Broadcasts] New: [" + Config.Region.SouthWest.Lat + "," + Config.Region.SouthWest.Lng + "]-[" + Config.Region.NorthEast.Lat + "," + Config.Region.NorthEast.Lng + "]");
      return Chat.createTasks(new Date().getTime());
    },
    _start: function() {
      return Request.add({
        action: 'getPaginatedPlextsV2',
        data: data,
        onSuccess: function(response) {
          return processSuccessTileResponse(response, tileIds);
        },
        onError: function(err) {
          logger.error("[Portals] " + err);
          return processErrorTileResponse(tileIds, noop);
        },
        afterResponse: function() {
          checkTimeoutAndFailTiles();
          return logger.info("[Portals] " + Math.round(Request.requested / Request.maxRequest * 100).toString() + ("%\t[" + Request.requested + "/" + Request.maxRequest + "]") + ("\t" + Entity.counter.portals + " portals, " + Entity.counter.links + " links, " + Entity.counter.fields + " fields"));
        },
        beforeRequest: function() {
          return null;
        }
      });
    }
  };

}).call(this);
