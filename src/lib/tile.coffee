async = require 'async'

timeoutTiles = []
failTiles    = []
panicTiles   = []

STATUS_PENDING      = 0
STATUS_REQUESTING   = 1
STATUS_TIMEOUT      = 2
STATUS_FAIL         = 3
STATUS_PANIC        = 4
STATUS_COMPLETE     = 5

request_max = 0
request_done = 0

TileBucket = GLOBAL.TileBucket = 
    
    bucket: []
    requestCount: 0

    enqueue: (tileId, callback) ->

        TileBucket.bucket.push tileId if tileId?
        
        if TileBucket.bucket.length >= Config.TileBucket.Max or not tileId?

            TileBucket.request TileBucket.bucket, callback
            TileBucket.bucket = []

        else

            callback && callback()

    request: (tileIds, callback) ->

        tileList = []

        for tileId in tileIds
            if Tile.data[tileId].status isnt STATUS_COMPLETE
                tileList.push Tile.bounds[tileId].id
                Tile.data[tileId].status = STATUS_PENDING
            
        return if tileList.length is 0

        TileBucket.requestCount++
        requestId = TileBucket.requestCount

        data = quadKeys: tileList

        TaskManager.begin()

        # reset status in database
        async.eachLimit tileList, Config.Database.MaxParallel, (tileId, callback) ->
            
            Database.db.collection('Tiles').update
                _id:    tileId
            ,
                $set:
                    status: STATUS_PENDING
            ,
                upsert: true
            , callback

        , (err) ->
            # onFinish

            request_max++

            Request.add

                action: 'getThinnedEntitiesV4'
                data:   data
                onSuccess: (response) ->

                    processSuccessTileResponse response, tileIds

                onError: (err) ->

                    logger.error "[Portals] " + err
                    processErrorTileResponse tileIds, noop

                afterResponse: ->

                    checkTimeoutAndFailTiles()

                    request_done++

                    logger.info "[Portals] " +
                        Math.round(request_done / request_max * 100).toString() +
                        "%\t[#{request_done}/#{request_max}]" +
                        "\t#{Entity.counter.portals} portals, #{Entity.counter.links} links, #{Entity.counter.fields} fields"

                    TaskManager.end 'TileBucket.request.afterResponseCallback'

            callback && callback()

Tile = GLOBAL.Tile = 
    
    length: 0
    bounds: {}
    data: {}

    # calculate region tiles
    calculateBounds: ->

        bounds = Utils.clampLatLngBounds new L.LatLngBounds(
            new L.LatLng(Config.Region.SouthWest.Lat, Config.Region.SouthWest.Lng),
            new L.LatLng(Config.Region.NorthEast.Lat, Config.Region.NorthEast.Lng)
        )

        x1 = Utils.lngToTile bounds.getWest(), Config.MinPortalLevel
        x2 = Utils.lngToTile bounds.getEast(), Config.MinPortalLevel
        y1 = Utils.latToTile bounds.getNorth(), Config.MinPortalLevel
        y2 = Utils.latToTile bounds.getSouth(), Config.MinPortalLevel

        tileBounds = []

        for y in [y1 .. y2]
            for x in [x1 .. x2]

                tileId = Utils.pointToTileId Config.MinPortalLevel, x, y
                tileBounds.push id: tileId

        return tileBounds

    prepareFromDatabase: (callback) ->

        logger.info "[Portals] Preparing from database: [#{Config.Region.SouthWest.Lat},#{Config.Region.SouthWest.Lng}]-[#{Config.Region.NorthEast.Lat},#{Config.Region.NorthEast.Lng}], MinPortalLevel=#{Config.MinPortalLevel}"

        # get all tiles
        tileBounds = Tile.calculateBounds()
        completedBounds = {}

        logger.info "[Portals] Querying #{tileBounds.length} tile status..."

        TaskManager.begin()

        async.eachLimit tileBounds, Config.Database.MaxParallel, (bound, callback) ->
            # find this tile in the database
            Database.db.collection('Tiles').findOne
                _id:    bound.id
                status: STATUS_COMPLETE
            , (err, tile) ->
                # tile exists: it is downloaded, ignore.
                completedBounds[tile._id] = true if tile?                 
                callback err
        , (err) ->
            # TODO: handle error

            # which tile is not downloaded
            for bounds in tileBounds
                if not completedBounds[bounds.id]?
                    Tile.length++
                    Tile.bounds[bounds.id] = bounds

            Tile._prepareTiles ->
                callback()
                TaskManager.end 'Tile.prepareFromDatabase.callback'

    prepareNew: (callback) ->

        logger.info "[Portals] Preparing new: [#{Config.Region.SouthWest.Lat},#{Config.Region.SouthWest.Lng}]-[#{Config.Region.NorthEast.Lat},#{Config.Region.NorthEast.Lng}], MinPortalLevel=#{Config.MinPortalLevel}"
        
        tileBounds = Tile.calculateBounds()
        for bounds in tileBounds
            Tile.length++
            Tile.bounds[bounds.id] = bounds

        Tile._prepareTiles callback

    _prepareTiles: (callback) ->

        logger.info "[Portals] Prepared #{Tile.length} tiles"
        
        Database.db.collection('Tiles').ensureIndex {status: 1}, ->

            for tileId, bounds of Tile.bounds

                Tile.data[bounds.id] = 
                    status: STATUS_PENDING
                    fails:  0
                    errors: 0

            callback && callback()

    start: ->

        if Tile.length is 0
            logger.info "[Portals] Nothing to request"
            return

        logger.info "[Portals] Begin requesting..."

        # push each tile into buckets and request them
        req = []
        req.push tileId for tileId, tileBounds of Tile.bounds
        
        async.each req, (tileId, callback) ->
            TileBucket.enqueue tileId, callback
        , ->
            TileBucket.enqueue()

processSuccessTileResponse = (response, tileIds) ->

    # invalid response
    if not response?.result?.map?
        processErrorTileResponse tileIds, noop
        return

    m = response.result.map

    for tileId, tileValue of m

        entityCount = 0

        if tileValue.error? and Tile.data[tileId].status is STATUS_PENDING # ignore succeeded

            # FAIL / TIMEOUT
            if tileValue.error is 'TIMEOUT'

                Tile.data[tileId].status = STATUS_TIMEOUT
                timeoutTiles.push tileId

            else

                Tile.data[tileId].status = STATUS_FAIL
                Tile.data[tileId].fails++

                if tileData[tileId].fails > Config.Tiles.MaxFailRetry
                    
                    logger.error "PANIC: tile id=#{tileId}"
                    Tile.data[tileId].status = STATUS_PANIC  # no more try
                    panicTiles.push tileId
                
                else

                    failTiles.push tileId
        
        else

            if tileValue.gameEntities?

                for entity in tileValue.gameEntities
                    if tileValue.deletedGameEntityGuids.indexOf entity[0] is -1
                        entityCount++
                        Entity.add entity[0], entity[1], entity[2]

            Tile.data[tileId].status = STATUS_COMPLETE
            Tile.data[tileId].data = tileValue

        # update status in the database
        updater = 
            $set:
                status: Tile.data[tileId].status

        updater.$set.entityCount = entityCount if entityCount > 0

        TaskManager.begin()
        Database.db.collection('Tiles').update {_id:tileId}, updater, TaskManager.end

processErrorTileResponse = (tileIds, callback) ->

    for tileId in tileIds

        if Tile.data[tileId].status is STATUS_PENDING

            Tile.data[tileId].status = STATUS_FAIL
            Tile.data[tileId].errors++

            if Tile.data[tileId].errors > Config.Tile.MaxErrorRetry
            
                logger.error "PANIC: tile id=#{tileId}"
                Tile.data[tileId].status = STATUS_PANIC
                panicTiles.push tileId

            else

                failTiles.push tileId

    async.eachLimit tileIds, Config.Database.MaxParallel, (tileId, callback) ->
        Database.db.collection('Tiles').update
            _id: tileId
        ,
            $set:
                status: Tile.data[tileId].status
        , callback
    , callback

checkTimeoutAndFailTiles = ->

    if Request.queue.length() isnt 0

        # request queue is not empty: wait tiles until reaching MinPerRequest

        if timeoutTiles.length >= Config.TileBucket.Min

            pickupCount = Math.min Config.TileBucket.Max, timeoutTiles.length

            TileBucket.request timeoutTiles[0...pickupCount]
            timeoutTiles = timeoutTiles[pickupCount..]

        if failTiles.length >= Config.TileBucket.Min

            pickupCount = Math.min Config.TileBucket.Max, failTiles.length

            TileBucket.request failTiles[0...pickupCount]
            failTiles = failTiles[pickupCount..]

    else

        # no more requests in the queue: request them immediately
        # TODO: split within MaxPerRequest

        if timeoutTiles.length > 0

            TileBucket.request timeoutTiles[..]
            timeoutTiles = []

        if failTiles.length > 0

            TileBucket.request failTiles[..]
            failTiles = []
