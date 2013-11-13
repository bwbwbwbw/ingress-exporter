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

            TaskManager.end 'Agent.InitFromDatabase.callback'

    strToTeam: (val) ->

        StrTeamMapping[val]

    resolved: (agentId, data) ->

        # data: name, team, level

        null

    resolve: (agentId) ->

        null