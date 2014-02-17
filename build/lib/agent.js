(function() {
  var Agent, StrTeamMapping, TEAM_ENLIGHTENED, TEAM_RESISTANCE, async;

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
      return Database.db.collection('Agent').find().toArray(function(err, agents) {
        var agent, _i, _len;
        if (agents) {
          for (_i = 0, _len = agents.length; _i < _len; _i++) {
            agent = agents[_i];
            Agent.data[agent._id] = agent;
          }
        }
        return callback && callback();
      });
    },
    strToTeam: function(val) {
      return StrTeamMapping[val];
    },
    resolveFromPortalDetail: function(portal, callback) {
      var agentTeam;
      if (portal.controllingTeam == null) {
        return callback();
      }
      agentTeam = Agent.strToTeam(portal.controllingTeam.team);
      return async.each(portal.resonatorArray.resonators, function(resonator, callback) {
        if (resonator !== null) {
          return Agent.resolved(resonator.ownerGuid, {
            level: resonator.level,
            team: agentTeam
          }, callback);
        } else {
          return callback();
        }
      }, callback);
    },
    resolved: function(agentId, data, callback) {
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
        return Database.db.collection('Agent').update({
          _id: agentId
        }, {
          $set: {
            team: Agent.data[agentId].team,
            level: Agent.data[agentId].level
          }
        }, {
          upsert: true
        }, function(err) {
          Agent.data[agentId].inUpdateProgress = false;
          return callback && callback();
        });
      } else {
        return callback();
      }
    },
    _resolveDatabase: function(callback) {
      return Database.db.collection('Portals').find({
        team: {
          $ne: 'NEUTRAL'
        },
        resonatorArray: {
          $exists: true
        }
      }, {
        resonatorArray: true,
        controllingTeam: true
      }).toArray(function(err, portals) {
        if (err) {
          callback(err);
          return;
        }
        if (portals != null) {
          return async.eachSeries(portals, Agent.resolveFromPortalDetail, callback);
        } else {
          return callback();
        }
      });
    }
  };

}).call(this);
