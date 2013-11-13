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

        callback = callback || noop

        if data.portalV2?
            createPortalEntity.apply this, arguments
        else if data.capturedRegion?
            createFieldEntity.apply this, arguments
        else if data.edge?
            createLinkEntity.apply this, arguments
        else
            logger.warn 'Unknown entity type, id=' + id
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

    createEntity 'Portals', id, timestamp, data, ->

        # resolve agents
        if data.captured?

            Agent.resolve data.captured.capturingPlayerId

            for resonator in data.resonatorArray.resonators
                # consider ADA Reflector/Jarvis Virus?
                Agent.resolved resonator.ownerGuid,
                    level: resonator.level

        callback()

createFieldEntity = (id, timestamp, data, callback) ->

    createEntity 'Fields', id, timestamp, data, callback

createLinkEntity = (id, timestamp, data, callback) ->

    createEntity 'Links', id, timestamp, data, callback
