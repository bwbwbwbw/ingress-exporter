async = require 'async'

TEAM_ENLIGHTENED = 1
TEAM_RESISTANCE = 2

StrTeamMapping = 
    ENLIGHTENED: TEAM_ENLIGHTENED
    RESISTANCE:  TEAM_RESISTANCE

PlayerLookup = GLOBAL.PlayerLookup = 
    
    guids: []
    resolving: {}

    enqueue: (playerId, callback) ->

        if playerId?

            return if PlayerLookup.resolving[playerId]?
            PlayerLookup.guids.push playerId
            PlayerLookup.resolving[playerId] = true
        
        if PlayerLookup.guids.length >= Config.PlayerLookup.Max or not playerId?

            PlayerLookup.request PlayerLookup.guids, callback
            PlayerLookup.guids = []

        else

            callback && callback()

    request: (guids, callback) ->

        if guids.length is 0
            callback()
            return

        Request.unshift

            action:  'getPlayersByGuids'
            data:
                guids: guids
            onSuccess: (response) ->

                console.log response

            onError: (err) ->

                logger.error "[PlayerLookup] " + err

                TaskManager.begin()

                setTimeout ->

                    PlayerLookup.enqueue guid, noop for guid in guids
                    TaskManager.end 'PlayerLookup.request.onErrorTimeoutCallback'

                , 1000

            afterResponse: ->

                for guid in guids
                    TaskManager.end 'PlayerLookup.request.afterResponseCallback'
                    delete PlayerLookup.resolving[guid]

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

    resolved: (agentId, data) ->

        # data: name, team, level

        need_update = false

        if not Agent.data[agentId]?
            need_update = true
            Agent.data[agentId] = 
                name: null
                team: null
                level: 0
                inUpdateProgress: false

        if data.name? and Agent.data[agentId].name isnt data.name
            need_update = true
            Agent.data[agentId].name = data.name

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
                        name: currentData.name
                        team: currentData.team
                        level: currentData.level
                ,
                    upsert: true
                , (err) ->

                    callback()
                    TaskManager.end 'Agent.resolved.update.callback'

    resolve: (agentId) ->

        try

            if agentId
                return if Agent.data[agentId]?.name?
                return if Utils.isSystemPlayer agentId
                TaskManager.begin()

            PlayerLookup.enqueue agentId, noop

        catch err

            logger.error "[PlayerLookup] Internal error while resolving agent_id=#{agentId}: #{err.message}."

dbQueue = async.queue (task, callback) ->

    task callback

, Config.Database.MaxParallel
