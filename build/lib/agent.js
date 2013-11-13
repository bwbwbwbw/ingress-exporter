(function() {
  var Agent, StrTeamMapping, TEAM_ENLIGHTENED, TEAM_RESISTANCE;

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
        return TaskManager.end('Agent.InitFromDatabase.callback');
      });
    },
    strToTeam: function(val) {
      return StrTeamMapping[val];
    },
    resolved: function(agentId, data) {
      return null;
    },
    resolve: function(agentId) {
      return null;
    }
  };

}).call(this);
