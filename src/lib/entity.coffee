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
        data = remap data
        # update counter every 100 entities
 
        main = ->
 
            Entity.entityCount++
 
            if data.type is 'portal'
                createPortalEntity id, timestamp, data, callback
            else if data.type is 'region'
                #createFieldEntity id, timestamp, data, callback
                return callback()
            else if data.type is 'edge'
                #createLinkEntity id, timestamp, data, callback
                return callback()
            else
                logger.warn "[Entity] Unknown entity type, id=#{id}, type=#{data.type}"
                callback && callback()
 
 
        if Entity.entityCount % 100 is 0
 
            async.parallel [
 
                (callback) ->
 
                    Database.db.collection('Portals').count {}, (err, count) ->
                        Entity.counter.portals = count if not err
                        callback()
 
                (callback) ->
 
                    Database.db.collection('Fields').count {}, (err, count) ->
                        Entity.counter.fields = count if not err
                        callback()
 
                (callback) ->
 
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
                response = remap response.result
 
                if response.capturedTime?
                    response.capturedTime = parseInt response.capturedTime
 
                return callback() if ig.indexOf(response.owner) > -1
 
                Database.db.collection('Portals').findAndModify
                    _id: guid   #query
                ,
                    _id: 1      #sort
                ,
                    $set: response  #update
                ,
                    new: true   # options
                , (err, data) ->
 
                    if err
                        logger.error '[Details] Failed to update portal detail (guid=%s) in database: %s', guid, err.message
 
                    # resolve agent information
                    Agent.resolveFromPortalDetail data, callback
 
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
            resonators:
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
 
    data.pos =
        lat: data.latE6 / 1e6
        lng: data.lngE6 / 1e6
 
    createEntity 'Portals', id, timestamp, data, ->
 
        if data.team isnt 'NEUTRAL' and argv.detail isnt 'false'
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
 
 
types = {
    'p' : 'portal'
    'r' : 'region'
    'e' : 'edge'
}
 
teams = {
    'E' : 'ENLIGHTENED'
    'R' : 'RESISTANCE'
    'N' : 'NEUTRAL'
}
 
remap = (data) ->
#TODO: links and fields
    result = {
        type: types[data[0]]
        team: teams[data[1]]
        latE6: data[2]
        lngE6: data[3]
        level: data[4]
        health: data[5]
        resCount: data[6]
        image: data[7]
        title: data[8]
        ornaments: data[9]
    }
    result.mods = remapMods(data[14]) if data[14]
    result.resonators = remapResos(data[15]) if data[15]
    result.owner = data[16] if data[16]
    return result
 
 
remapMods = (mods) ->
    result = []
    for mod in mods
        result.push(if mod then {
            owner: mod[0]
            name: mod[1]
            rarity: mod[2]
            stats: mod[3]
        } else null);
    return result;
 
remapResos = (resos) ->
    result = []
    for reso in resos
        result.push(if reso then {
            owner: reso[0]
            level: reso[1]
            energy: reso[2]
        } else null);
    return result;
