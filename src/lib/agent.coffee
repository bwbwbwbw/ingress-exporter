async = require 'async'

TEAM_ENLIGHTENED = 1
TEAM_RESISTANCE = 2

StrTeamMapping = 
    ENLIGHTENED: TEAM_ENLIGHTENED
    RESISTANCE:  TEAM_RESISTANCE

Agent = GLOBAL.Agent = 
    
    data: {}

    initFromDatabase: (callback) ->

        TaskManager.begin()

        Database.db.collection('Agent').find().toArray (err, agents) ->

            Agent.data[agent._id] = agent for agent in agents if agents
            callback && callback()

            TaskManager.end 'Agent.initFromDatabase.callback'

    strToTeam: (val) ->

        StrTeamMapping[val]

    resolveFromPortalDetail: (portal) ->

        agentTeam = Agent.strToTeam portal.controllingTeam.team

        for resonator in portal.resonatorArray.resonators

            # consider ADA Reflector/Jarvis Virus?
            
            if resonator?

                Agent.resolved resonator.ownerGuid,
                    level: resonator.level
                    team:  agentTeam

    resolved: (agentId, data) ->

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

            TaskManager.begin()

            dbQueue.push (callback) ->

                currentData = Agent.data[agentId]
                currentData.inUpdateProgress = false

                Database.db.collection('Agent').update
                    _id: agentId
                ,
                    $set:
                        team: currentData.team
                        level: currentData.level
                ,
                    upsert: true
                , (err) ->

                    callback()
                    TaskManager.end 'Agent.resolved.update.callback'
        
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
            Agent.resolveFromPortalDetail portal for portal in portals if portals?
            callback()

dbQueue = async.queue (task, callback) ->

    task callback

, Config.Database.MaxParallel
