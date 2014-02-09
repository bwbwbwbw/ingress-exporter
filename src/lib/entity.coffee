request_max = 0
request_done = 0

requested_guid = {}

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

    requestPortalDetail: (guid) ->

        requestPortalDetail guid
        
    requestMissingPortals: (callback) ->

        # request missing portal details

        Database.db.collection('Portals').find(
            team:
                $ne: 'NEUTRAL'
            resonatorArray:
                $exists: false
        ,
            _id: true
        ).toArray (err, portals) ->

            if err
                callback err
                return

            requestPortalDetail po._id for po in portals if portals
            callback()

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

createFieldEntity = (id, timestamp, data, callback) ->

    createEntity 'Fields', id, timestamp, data, callback

createLinkEntity = (id, timestamp, data, callback) ->

    createEntity 'Links', id, timestamp, data, callback

requestPortalDetail = (guid) ->

    # TODO: WTF?
    return if requested_guid[guid]?
    requested_guid[guid] = true

    TaskManager.begin()

    request_max++

    Request.unshift

        action: 'getPortalDetails'
        data:
            guid: guid
        onSuccess: (response) ->

            if response.captured?.capturedTime?
                response.captured.capturedTime = parseInt response.captured.capturedTime

            Database.db.collection('Portals').update
                _id: guid
            ,
                $set: response
            , noop

            # resolve agent information
            Agent.resolveFromPortalDetail response

        onError: (err) ->

            logger.error "[Details] " + err

        afterResponse: ->

            request_done++

            logger.info "[Details] " +
                Math.round(request_done / request_max * 100).toString() +
                "%\t[#{request_done}/#{request_max}]"

            TaskManager.end 'Entity.requestPortalDetail.afterResponseCallback'
