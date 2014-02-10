(function() {
  var Chat, ObjectID, STATUS_COMPLETE, STATUS_ERROR, STATUS_NOTCOMPLETE, STATUS_PENDING, async, bootstrap, dbQueue, insertCount, insertMessage, messageCount, parseChatResponse, request, requestFactory;

  async = require('async');

  requestFactory = require('../lib/request.js');

  request = requestFactory();

  ObjectID = Database.db.bson_serializer.ObjectID;

  STATUS_PENDING = 0;

  STATUS_ERROR = 1;

  STATUS_NOTCOMPLETE = 2;

  STATUS_COMPLETE = 3;

  messageCount = 0;

  insertCount = 0;

  module.exports = {
    onBootstrap: function(callback) {
      if (argv.broadcasts) {
        return bootstrap(function() {
          return callback('end');
        });
      } else {
        return callback();
      }
    }
  };

  bootstrap = function(callback) {
    if (argv["new"] || argv.n) {
      return Chat.prepareNew(function() {
        return Chat.start(callback);
      });
    } else {
      return Chat.prepareFromDatabase(function() {
        return Chat.start(callback);
      });
    }
  };

  Chat = {
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
          logger.info("[Broadcasts] Created " + preparedTasks.length + " tasks (all " + Chat.length + " tasks).");
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
        }
      ], callback);
    },
    prepareNew: function(callback) {
      var timestampMin;
      logger.info("[Broadcasts] New: [" + Config.Region.SouthWest.Lat + "," + Config.Region.SouthWest.Lng + "]-[" + Config.Region.NorthEast.Lat + "," + Config.Region.NorthEast.Lng + "]");
      timestampMin = new Date().getTime() - Config.Chat.TraceTimespanMS;
      return Chat.createTasks(timestampMin, callback);
    },
    start: function(callback) {
      return async.series([
        function(callback) {
          return Database.db.collection('Chat').ensureIndex({
            time: -1
          }, callback);
        }, function(callback) {
          return Database.db.collection('Chat').ensureIndex({
            'markup.player1.guid': 1
          }, callback);
        }, function(callback) {
          return Database.db.collection('Chat').ensureIndex({
            'markup.portal1.guid': 1
          }, callback);
        }
      ], function() {
        var taskId, taskList;
        taskList = [];
        for (taskId in Chat.tasks) {
          taskList.push(taskId);
        }
        if (taskList.length === 0) {
          logger.info("[Broadcasts] Nothing to request");
          return callback();
        }
        logger.info("[Broadcasts] Updateing queue...");
        return async.eachLimit(taskList, Config.Database.MaxParallel, function(taskId, callback) {
          Chat.tasks[taskId].status = STATUS_PENDING;
          return Database.db.collection('Chat._queue').update({
            _id: new ObjectID(taskId)
          }, {
            $set: {
              status: STATUS_PENDING
            }
          }, callback);
        }, function(err) {
          var _i, _len, _results;
          logger.info("[Broadcasts] Begin requesting...");
          request.queue.drain = callback;
          _results = [];
          for (_i = 0, _len = taskList.length; _i < _len; _i++) {
            taskId = taskList[_i];
            _results.push(Chat.request(taskId));
          }
          return _results;
        });
      });
    },
    request: function(taskId) {
      return request.push({
        action: 'getPaginatedPlexts',
        data: Chat.tasks[taskId].data,
        onSuccess: function(response, callback) {
          return parseChatResponse(taskId, response.result, callback);
        },
        onError: function(err, callback) {
          logger.error("[Broadcasts] " + err.message);
          return callback();
        },
        afterResponse: function(callback) {
          logger.info("[Broadcasts] " + Math.round(request.done / request.max * 100).toString() + ("%\t[" + request.done + "/" + request.max + "]") + ("\t" + messageCount + " messages (" + (dbQueue.length()) + " in buffer)"));
          return callback();
        }
      });
    }
  };

  parseChatResponse = function(taskId, response, callback) {
    return async.each(response, function(rec, callback) {
      return insertMessage(rec[0], rec[1], rec[2], callback);
    }, function() {
      var maxTimestamp;
      if (response.length < Config.Chat.FetchItemCount) {
        delete Chat.tasks[taskId];
        Chat.length--;
        return Database.db.collection('Chat._queue').remove({
          _id: new ObjectID(taskId)
        }, {
          single: true
        }, callback);
      } else {
        maxTimestamp = parseInt(response[response.length - 1][1]) - 1;
        Chat.tasks[taskId].data.maxTimestampMs = maxTimestamp;
        Chat.tasks[taskId].status = STATUS_NOTCOMPLETE;
        return Database.db.collection('Chat._queue').update({
          _id: new ObjectID(taskId)
        }, {
          $set: {
            status: STATUS_NOTCOMPLETE,
            'data.maxTimestampMs': maxTimestamp
          }
        }, function() {
          Chat.request(taskId);
          return callback();
        });
      }
    });
  };

  dbQueue = async.queue(function(task, callback) {
    return task(callback);
  }, Config.Database.MaxParallel);

  insertMessage = function(id, timestamp, data, _callback) {
    var main;
    main = function() {
      var count, data2, m, markup, _i, _len, _ref;
      insertCount++;
      data2 = data.plext;
      markup = {};
      count = {};
      _ref = data.plext.markup;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        m = _ref[_i];
        if (count[m[0]] == null) {
          count[m[0]] = 0;
        }
        count[m[0]]++;
        markup[m[0] + count[m[0]].toString()] = m[1];
      }
      data2.markup = markup;
      return dbQueue.push(function(callback) {
        var doc;
        doc = data2;
        doc._id = id;
        doc.time = timestamp;
        return async.series([
          function(callback) {
            return Database.db.collection('Chat').insert(doc, callback);
          }, function(callback) {
            var level;
            if (doc.markup.PLAYER1 != null) {
              level = null;
              if (doc.markup.TEXT1.plain === ' deployed an ') {
                level = parseInt(doc.markup.TEXT2.plain.substr(1));
              }
              return Agent.resolved(doc.markup.PLAYER1.plain, {
                team: Agent.strToTeam(doc.markup.PLAYER1.team),
                level: level
              }, callback);
            } else {
              return callback();
            }
          }
        ], function() {
          callback();
          return _callback();
        });
      });
    };
    if (insertCount % 100 === 0) {
      return Database.db.collection('Chat').count({}, function(err, count) {
        messageCount = count;
        return main();
      });
    } else {
      return main();
    }
  };

}).call(this);
