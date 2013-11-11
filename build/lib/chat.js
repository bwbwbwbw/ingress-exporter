(function() {
  var Chat, ObjectID, STATUS_COMPLETE, STATUS_ERROR, STATUS_PENDING, async;

  async = require('async');

  ObjectID = Database.db.bson_serializer.ObjectID;

  STATUS_PENDING = 0;

  STATUS_ERROR = 1;

  STATUS_COMPLETE = 2;

  Chat = GLOBAL.Chat = {
    tasks: {},
    length: 0,
    createTasks: function(timestampMin, callback) {
      var TSmax, TSmin, preparedTasks, timestampMax, _i, _ref;
      timestampMax = new Date().getTime();
      preparedTasks = [];
      for (TSmin = _i = timestampMin, _ref = Config.Chat.SplitTimespanMS; _ref > 0 ? _i <= timestampMax : _i >= timestampMax; TSmin = _i += _ref) {
        TSmax = Math.min(timestampMax, TSmin + Config.Chat.SplitTimespanMS - 1);
        if (TSmax === TSmin) {
          continue;
        }
        preparedTasks.push({
          data: {
            desiredNumItems: Config.Chat.FetchItemCount,
            minLatE6: Math.round(Config.Region.SouthWest.Lat * 1e6),
            minLngE6: Math.round(Config.Region.SouthWest.Lng * 1e6),
            maxLatE6: Math.round(Config.Region.NorthEast.Lat * 1e6),
            maxLngE6: Math.round(Config.Region.NorthEast.Lng * 1e6),
            minTimestampMs: TSmin,
            maxTimestampMs: TSmax,
            chatTab: 'all'
          },
          status: STATUS_PENDING,
          _id: new ObjectID()
        });
      }
      return async.eachLimit(preparedTasks, Config.Database.MaxParallel, function(task, callback) {
        Chat.tasks[task._id.toString()] = task;
        Chat.length++;
        return Database.db.collection('Chat._queue').insert(task, callback);
      }, function() {
        return Database.db.collection('Chat._data').update({
          _id: 'last_task'
        }, {
          $set: {
            timestamp: timestampMax
          }
        }, {
          upsert: true
        }, function(err) {
          console.info("[Broadcasts] Created " + preparedTasks.length + " tasks (all " + Chat.length + " tasks).");
          return callback && callback();
        });
      });
    },
    prepareFromDatabase: function(callback) {
      var timestampMin, timestampMinMax;
      logger.info("[Broadcasts] Continue: [" + Config.Region.SouthWest.Lat + "," + Config.Region.SouthWest.Lng + "]-[" + Config.Region.NorthEast.Lat + "," + Config.Region.NorthEast.Lng + "]");
      timestampMin = new Date().getTime() - Config.Chat.TraceTimespanMS;
      timestampMinMax = new Date().getTime() - Config.Chat.MaxTraceTimespanMS;
      return async.series([
        function(callback) {
          return Database.db.collection('Chat._queue').find().toArray(function(err, tasks) {
            var task, _i, _len;
            if (tasks != null) {
              for (_i = 0, _len = tasks.length; _i < _len; _i++) {
                task = tasks[_i];
                Chat.tasks[task._id.toString()] = task;
                Chat.length++;
              }
            }
            return callback();
          });
        }, function(callback) {
          return Database.db.collection('Chat._data').findOne({
            _id: 'last_task'
          }, function(err, data) {
            if ((data != null ? data.timestamp : void 0) != null) {
              timestampMin = data.timestamp + 1;
            }
            if (timestampMin < timestampMinMax) {
              timestampMin = timestampMinMax;
            }
            return callback();
          });
        }, function(callback) {
          return Chat.createTasks(timestampMin, callback);
        }, callback
      ]);
    },
    prepareNew: function(callback) {
      var timestampMin;
      logger.info("[Broadcasts] New: [" + Config.Region.SouthWest.Lat + "," + Config.Region.SouthWest.Lng + "]-[" + Config.Region.NorthEast.Lat + "," + Config.Region.NorthEast.Lng + "]");
      timestampMin = new Date().getTime() - Config.Chat.TraceTimespanMS;
      return Chat.createTasks(timestampMin, callback);
    },
    start: function() {
      return null;
    }
  };

}).call(this);
