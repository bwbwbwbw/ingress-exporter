Entity = GLOBAL.Entity = 
    
    counter: 
        portals: 0
        fields:  0
        links:   0

    entityCount: 0

    add: (id, timestamp, data) ->

        # update counter every 100 entities

        if Entity.entityCount % 100 is 0
            Database.db.collection('Portals').count {}, (err, count) ->
                Entity.counter.portals = count
            Database.db.collection('Fields').count {}, (err, count) ->
                Entity.counter.fields = count
            Database.db.collection('Links').count {}, (err, count) ->
                Entity.counter.links = count

        Entity.entityCount++

        if data.portalV2?
            createPortalEntity.apply this, arguments
        else if data.capturedRegion?
            createFieldEntity.apply this, arguments
        else if data.edge?
            createLinkEntity.apply this, arguments
        else
            logger.warn 'Unknown entity type, id=' + id

createEntity = (collection, id, timestamp, data) ->

    data.time = timestamp

    Database.db.collection(collection).update
        _id: id
    ,
        $set:
            data
    ,
        upsert: true
    , noop

createPortalEntity = (id, timestamp, data) ->

    createEntity 'Portals', id, timestamp, data

createFieldEntity = (id, timestamp, data) ->

    createEntity 'Fields', id, timestamp, data

createLinkEntity = (id, timestamp, data) ->

    createEntity 'Links', id, timestamp, data
