async = require 'async'

TEAM_ENLIGHTENED = 1
TEAM_RESISTANCE = 2

StrTeamMapping = 
    ENLIGHTENED: TEAM_ENLIGHTENED
    RESISTANCE:  TEAM_RESISTANCE

Agent = GLOBAL.Agent = 
    
    data: {}

    initFromDatabase: (callback) ->

        Database.db.collection('Agent').find().toArray (err, agents) ->

            Agent.data[agent._id] = agent for agent in agents if agents
            callback && callback()

    strToTeam: (val) ->

        StrTeamMapping[val]

    resolveFromPortalDetail: (portal, callback) ->

        return callback() if not portal.controllingTeam?

        agentTeam = Agent.strToTeam portal.controllingTeam.team

        async.each portal.resonatorArray.resonators, (resonator, callback) ->

            if resonator isnt null
                
                Agent.resolved resonator.ownerGuid,
                    level: resonator.level
                    team:  agentTeam
                , callback

            else
                callback()
        
        , callback

    resolved: (agentId, data, callback) ->

        # name has been resolved as agentId
        # data: team, level

        need_update = false

        if not Agent.data[agentId]?
            need_update = true
            Agent.data[agentId] = 
                team:             null
                level:            0
                inUpdateProgress: false

        if data.team? and Agent.data[agentId].team isnt data.team
            need_update = true
            Agent.data[agentId].team = data.team

        if data.level? and Agent.data[agentId].level < data.level
            need_update = true
            Agent.data[agentId].level = data.level

        if need_update and not Agent.data[agentId].inUpdateProgress
            
            Agent.data[agentId].inUpdateProgress = true

            Database.db.collection('Agent').update
                _id: agentId
            ,
                $set:
                    team:   Agent.data[agentId].team
                    level:  Agent.data[agentId].level
            ,
                upsert: true
            , (err) ->

                Agent.data[agentId].inUpdateProgress = false
                callback && callback()

        else

            callback()
        
    _resolveDatabase: (callback) ->

        Database.db.collection('Portals').find(
            team:
                $ne: 'NEUTRAL'
            resonatorArray:
                $exists: true
        ,
            resonatorArray:  true
            controllingTeam: true
        ).toArray (err, portals) ->

            if err
                callback err
                return

            # TODO: reduce memory usage
            if portals?
                async.eachSeries portals, Agent.resolveFromPortalDetail, callback
            else
                callback()