(function() {
  var Agent, StrTeamMapping, TEAM_ENLIGHTENED, TEAM_RESISTANCE, async, dbQueue;

  async = require('async');

  TEAM_ENLIGHTENED = 1;

  TEAM_RESISTANCE = 2;

  StrTeamMapping = {
    ENLIGHTENED: TEAM_ENLIGHTENED,
    RESISTANCE: TEAM_RESISTANCE
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
          team: null,
          level: 0,
          inUpdateProgress: false
        };
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
    }
  };

  dbQueue = async.queue(function(task, callback) {
    return task(callback);
  }, Config.Database.MaxParallel);

}).call(this);
