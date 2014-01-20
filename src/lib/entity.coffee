request_max = 0
request_done = 0

Entity = GLOBAL.Entity = 
    
    counter: 
        portals: 0
        fields:  0
        links:   0

    entityCount: 0

    add: (id, timestamp, data, callback) ->

        # update counter every 100 entities

        if Entity.entityCount % 100 is 0
            Database.db.collection('Portals').count {}, (err, count) ->
                Entity.counter.portals = count
            Database.db.collection('Fields').count {}, (err, count) ->
                Entity.counter.fields = count
            Database.db.collection('Links').count {}, (err, count) ->
                Entity.counter.links = count

        Entity.entityCount++

        if data.type is 'portal'
            createPortalEntity.apply this, arguments
        else if data.type is 'region'
            createFieldEntity.apply this, arguments
        else if data.type is 'edge'
            createLinkEntity.apply this, arguments
        else
            logger.warn "Unknown entity type, id=#{id}, type=#{data.type}"
            callback && callback()

createEntity = (collection, id, timestamp, data, callback) ->

    data.time = timestamp

    TaskManager.begin()

    Database.db.collection(collection).update
        _id: id
    ,
        $set:
            data
    ,
        upsert: true
    , (err) ->
        
        callback && callback.apply this, arguments
        TaskManager.end()

createPortalEntity = (id, timestamp, data, callback) ->

    createEntity 'Portals', id, timestamp, data, callback
    requestPortalDetail id if data.team isnt 'NEUTRAL'
    ###
    createEntity 'Portals', id, timestamp, data, ->

        # resolve agents
        if data.captured?

            Agent.resolve data.captured.capturingPlayerId

            for resonator in data.resonatorArray.resonators

                if not Utils.isSystemPlayer resonator.ownerGuid

                    Agent.resolve resonator.ownerGuid
                    
                    # consider ADA Reflector/Jarvis Virus?
                    Agent.resolved resonator.ownerGuid,
                        level: resonator.level

        callback && callback()
    ###

createFieldEntity = (id, timestamp, data, callback) ->

    createEntity 'Fields', id, timestamp, data, callback

createLinkEntity = (id, timestamp, data, callback) ->

    createEntity 'Links', id, timestamp, data, callback

requestPortalDetail = (guid) ->

    TaskManager.begin()

    request_max++

    Request.unshift

        action: 'getPortalDetails'
        data:
            guid: guid
        onSuccess: (response) ->

            Database.db.collection('Portals').update
                _id: guid
            ,
                $set: response
            , noop

        onError: (err) ->

            logger.error "[Details] " + err

        afterResponse: ->

            request_done++

            logger.info "[Details] " +
                Math.round(request_done / request_max * 100).toString() +
                "%\t[#{request_done}/#{request_max}]"

            TaskManager.end 'Entity.requestPortalDetail.afterResponseCallback'
