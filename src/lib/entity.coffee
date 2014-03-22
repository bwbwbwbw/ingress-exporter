async = require 'async'
requestFactory = require './requestfactory.js'
request = requestFactory()

requested_guid = {}

Entity = GLOBAL.Entity = 
    
    counter: 
        portals: 0
        fields:  0
        links:   0

    entityCount: 0

    add: (id, timestamp, data, callback) ->

        # update counter every 100 entities
        
        main = ->

            Entity.entityCount++

            if data.type is 'portal'
                createPortalEntity id, timestamp, data, callback
            else if data.type is 'region'
                createFieldEntity id, timestamp, data, callback
            else if data.type is 'edge'
                createLinkEntity id, timestamp, data, callback
            else
                logger.warn "[Entity] Unknown entity type, id=#{id}, type=#{data.type}"
                callback && callback()

        
        if Entity.entityCount % 100 is 0

            async.parallel [

                (callback) ->
                    
                    Database.db.collection('Portals').count {}, (err, count) ->
                        Entity.counter.portals = count if not err
                        callback()

                , (callback) ->

                    Database.db.collection('Fields').count {}, (err, count) ->
                        Entity.counter.fields = count if not err
                        callback()

                , (callback) ->
                    
                    Database.db.collection('Links').count {}, (err, count) ->
                        Entity.counter.links = count if not err
                        callback()

            ], main

        else
        
            main()

    requestPortalDetail: (guid, outerCallback) ->

        # TODO: WTF?
        return outerCallback() if requested_guid[guid]?

        requested_guid[guid] = true

        t = 0

        request.push

            action: 'getPortalDetails'
            data:
                guid: guid
            beforeRequest: (callback) ->

                    t = Date.now()
                    callback()

            onSuccess: (response, callback) ->

                if response.captured?.capturedTime?
                    response.captured.capturedTime = parseInt response.captured.capturedTime

                Database.db.collection('Portals').update
                    _id: guid
                ,
                    $set: response
                , (err) ->

                    if err
                        logger.error '[Details] Failed to update portal detail (guid=%s) in database: %s', guid, err.message

                    # resolve agent information
                    Agent.resolveFromPortalDetail response, callback

            onError: (err, callback) ->

                logger.error "[Details] #{err.message}"
                callback()

            afterResponse: (callback) ->

                logger.info "[Details] " +
                    Math.round(request.done / request.max * 100).toString() +
                    "%\t[#{request.done}/#{request.max}]\t#{Date.now() - t}ms"

                callback()
                outerCallback()
        
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
                logger.error '[Details] Failed to fetch missing portal list: %s', err.message
                return callback()

            if portals

                async.each portals, (po, callback) ->

                    Entity.requestPortalDetail po._id, callback

                , callback

            else

                callback()

createEntity = (collection, id, timestamp, data, callback) ->
    
    #create proper position field
    pos =
      lat: data.latE6/1e6
      lng: data.lngE6/1e6    
    data.pos = pos

    data.time = timestamp

    Database.db.collection(collection).update
        _id: id
    ,
        $set:
            data
    ,
        upsert: true
    , (err) ->

        if err
            logger.error '[Entity] Failed to insert entity (id=%s) into database: %s', id, err.message

        # ignore error
        callback()

createPortalEntity = (id, timestamp, data, callback) ->

    createEntity 'Portals', id, timestamp, data, ->

        if data.team isnt 'NEUTRAL'
            Entity.requestPortalDetail id, ->
                callback && callback 'portal'
        else
            callback && callback 'portal'

createFieldEntity = (id, timestamp, data, callback) ->

    createEntity 'Fields', id, timestamp, data, ->
        callback && callback 'field'

createLinkEntity = (id, timestamp, data, callback) ->

    createEntity 'Links', id, timestamp, data, ->
        callback && callback 'link'
