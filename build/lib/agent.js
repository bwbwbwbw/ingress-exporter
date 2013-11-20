(function() {
  var Agent, PlayerLookup, StrTeamMapping, TEAM_ENLIGHTENED, TEAM_RESISTANCE, dbQueue;

  TEAM_ENLIGHTENED = 1;

  TEAM_RESISTANCE = 2;

  StrTeamMapping = {
    ENLIGHTENED: TEAM_ENLIGHTENED,
    RESISTANCE: TEAM_RESISTANCE
  };

  PlayerLookup = GLOBAL.PlayerLookup = {
    guids: [],
    resolving: {},
    enqueue: function(playerId, callback) {
      if (playerId != null) {
        if (PlayerLookup.resolving[playerId] != null) {
          return;
        }
        PlayerLookup.guids.push(playerId);
        PlayerLookup.resolving[playerId] = true;
      }
      if (PlayerLookup.guids.length >= Config.PlayerLookup.Max || (playerId == null)) {
        PlayerLookup.request(PlayerLookup.guids, callback);
        return PLayerLookup.guids = [];
      } else {
        return callback && callback();
      }
    },
    request: function(guids, callback) {
      if (guids.length === 0) {
        callback();
        return;
      }
      return Request.add({
        action: 'getPlayersByGuids',
        data: {
          guids: guids
        },
        onSuccess: function(response) {
          return console.log(response);
        },
        onError: function(err) {
          logger.error("[PlayerLookup] " + err);
          TaskManager.begin();
          return setTimeout(function() {
            var guid, _i, _len;
            for (_i = 0, _len = guids.length; _i < _len; _i++) {
              guid = guids[_i];
              PlayerLookup.enqueue(guid, noop);
            }
            return TaskManager.end('PlayerLookup.request.onErrorTimeoutCallback');
          }, 1000);
        },
        afterResponse: function() {
          var guid, _i, _len, _results;
          _results = [];
          for (_i = 0, _len = guids.length; _i < _len; _i++) {
            guid = guids[_i];
            TaskManager.end('PlayerLookup.request.afterResponseCallback');
            _results.push(delete PlayerLookup.resolving[guid]);
          }
          return _results;
        }
      });
    }
  };

  Agent = GLOBAL.Agent = {
    data: {},
    initFromDatabase: function(callback) {
      TaskManager.begin();
      return Database.db.collection('Agent').find().toArray(function(err, agents) {
        var agent, _i, _len;
        if (agents) {
          for (_i = 0, _len = agents.length; _i < _len; _i++) {
            agent = agents[_i];
            Agent.data[agent._id] = agent;
          }
        }
        callback && callback();
        return TaskManager.end('Agent.initFromDatabase.callback');
      });
    },
    strToTeam: function(val) {
      return StrTeamMapping[val];
    },
    resolved: function(agentId, data) {
      var need_update;
      need_update = false;
      if (Agent.data[agentId] == null) {
        need_update = true;
        Agent.data[agentId] = {
          name: null,
          team: null,
          level: 0,
          inUpdateProgress: false
        };
      }
      if ((data.name != null) && Agent.data[agentId].name !== data.name) {
        need_update = true;
        Agent.data[agentId].name = data.name;
      }
      if ((data.team != null) && Agent.data[agentId].team !== data.team) {
        need_update = true;
        Agent.data[agentId].team = data.team;
      }
      if ((data.level != null) && Agent.data[agentId].level < data.level) {
        need_update = true;
        Agent.data[agentId].level = data.level;
      }
      if (need_update && !Agent.data[agentId].inUpdateProgress) {
        Agent.data[agentId].inUpdateProgress = true;
        TaskManager.begin();
        return dbQueue.push(function(callback) {
          var currentData;
          currentData = Agent.data[agentId];
          currentData.inUpdateProgress = false;
          return Database.db.collection('Agent').update({
            _id: agentId
          }, {
            $set: {
              name: currentData.name,
              team: currentData.team,
              level: currentData.level
            }
          }, {
            upsert: true
          }, function(err) {
            callback();
            return TaskManager.end('Agent.resolved.update.callback');
          });
        });
      }
    },
    resolve: function(agentId) {
      var _ref;
      if (agentId) {
        if (((_ref = Agent.data[agentId]) != null ? _ref.name : void 0) != null) {
          return;
        }
        if (Utils.isSystemPlayer(agentId)) {
          return;
        }
        TaskManager.begin();
      }
      return PlayerLookup.enqueue(agentId, noop);
    }
  };

  dbQueue = async.queue(function(task, callback) {
    return task(callback);
  }, Config.Database.MaxParallel);

}).call(this);
