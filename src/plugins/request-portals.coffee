async = require 'async'
scutil = require '../lib/scutil.js'
requestFactory = require '../lib/requestfactory.js'
request = requestFactory()

timeoutTiles = []
failTiles    = []
panicTiles   = []

STATUS_PENDING      = 0
STATUS_REQUESTING   = 1
STATUS_TIMEOUT      = 2
STATUS_FAIL         = 3
STATUS_PANIC        = 4
STATUS_COMPLETE     = 5

module.exports = 

    onBootstrap: (callback) ->

        if argv.portals
            bootstrap ->
                callback 'end'
        else
            callback()

bootstrap = (callback) ->

    if argv.new or argv.n
        async.series [
            Tile.prepareNew
            Tile.start
        ], callback
    else
        async.series [
            if argv.detail isnt 'false' then Entity.requestMissingPortals else (c) -> c()
            Tile.prepareFromDatabase
            Tile.start
        ], callback

tileBucket = async.cargo (tiles, callback) ->

    Tile.data[id].status = STATUS_PENDING for id in tiles

    data = 
        quadKeys: tiles

    # reset status in database
    async.eachLimit tiles, Config.Database.MaxParallel, (id, callback) ->
        
        Database.db.collection('Tiles').update
            _id:    id
        ,
            $set:
                status:  STATUS_PENDING
                portals: 0
        ,
            upsert: true
        , callback

    , (err) ->
        # onFinish
        
        t1 = 0
        t2 = 0

        request.push

            action: 'getThinnedEntities'
            data:   data
            beforeRequest: (callback) ->

                t1 = Date.now()
                callback()

            onSuccess: (response, callback) ->

                t2 = Date.now()
                processSuccessTileResponse response, tiles, callback

            onError: (err, callback) ->

                logger.error "[Portals] #{err.message}"

                t2 = Date.now()
                processErrorTileResponse tiles, callback

            afterResponse: (callback) ->

                checkTimeoutAndFailTiles ->

                    logger.info "[Portals] " +
                        Math.round(request.done / request.max * 100).toString() +
                        "%\t[#{request.done}/#{request.max}]\t#{t2 - t1}ms" +
                        "\t#{Entity.counter.portals} portals, #{Entity.counter.links} links, #{Entity.counter.fields} fields"

                    callback()

        callback()

, Config.TileBucket.Max

Tile = 
    
    list: []
    data: {}

    # calculate region tiles
    calculateTileKeys: ->

        tileParams = Utils.getMapZoomTileParameters Config.ZoomLevel

        polygon = []
        for latlng in Config.Region
            polygon.push [
                Utils.latToTile(Utils.clampLat(latlng[0]), tileParams)
                Utils.lngToTile(Utils.clampLng(latlng[1]), tileParams)
            ]

        tiles = scutil.discretize polygon
        ret = []

        for tile in tiles
            tileId = Utils.pointToTileId tileParams, tile.y, tile.x
            ret.push tileId

        ret

    prepareFromDatabase: (callback) ->

        # get all tiles
        tiles = Tile.calculateTileKeys()
        completedTiles = {}

        logger.info "[Portals] Querying #{tiles.length} tile status..."

        async.eachLimit tiles, Config.Database.MaxParallel, (id, callback) ->
            # find this tile in the database
            Database.db.collection('Tiles').findOne
                _id:    id
                status: STATUS_COMPLETE
            , (err, tile) ->
                # tile exists: it is downloaded, ignore.
                completedTiles[id] = true if tile?                 
                callback err
        , (err) ->
            # TODO: handle error

            # which tile is not downloaded
            for id in tiles
                Tile.list.push id if not completedTiles[id]?

            Tile.prepareTiles callback

    prepareNew: (callback) ->

        tiles = Tile.calculateTileKeys()
        Tile.list.push id for id in tiles

        Tile.prepareTiles callback

    prepareTiles: (callback) ->

        logger.info "[Portals] Prepared #{Tile.list.length} tiles"
        
        Database.db.collection('Tiles').ensureIndex {status: 1}, ->

            for id in Tile.list
            
                Tile.data[id] = 
                    status:  STATUS_PENDING
                    fails:   0
                    errors:  0
                    portals: 0

            callback && callback()

    start: (callback) ->

        if Tile.list.length is 0
            logger.info "[Portals] Nothing to request"
            return callback()

        logger.info "[Portals] Begin requesting..."

        # push each tile into buckets and request them
        tileBucket.push id for id in Tile.list

        request.queue.drain = callback

processSuccessTileResponse = (response, tiles, callback) ->

    # invalid response
    if not response.result?.map?
        return processErrorTileResponse tiles, callback

    list = []
    list.push {id: id, tile: tileValue} for id, tileValue of response.result.map

    async.eachLimit list, Config.Database.MaxParallel, (t, callback) ->

        ((update) ->
        
            if t.tile.error? and Tile.data[t.id].status is STATUS_PENDING

                # FAIL / TIMEOUT
                if t.tile.error is 'TIMEOUT'

                    Tile.data[t.id].status = STATUS_TIMEOUT
                    timeoutTiles.push id

                else

                    Tile.data[t.id].status = STATUS_FAIL
                    Tile.data[t.id].fails++

                    if Tile.data[t.id].fails > Config.Tiles.MaxFailRetry
                        
                        logger.error "PANIC: tile id=#{id}"
                        Tile.data[t.id].status = STATUS_PANIC  # no more try
                        panicTiles.push t.id
                    
                    else

                        failTiles.push t.id

                return update()
            
            else

                Tile.data[t.id].status = STATUS_COMPLETE
                Tile.data[t.id].portals = 0

                if t.tile.gameEntities?

                    async.each t.tile.gameEntities, (entity, callback) ->

                        if t.tile.deletedGameEntityGuids.indexOf(entity[0]) is -1
                            Entity.add entity[0], entity[1], entity[2], (type) ->
                                Tile.data[id].portals++ if type is 'portal'
                                callback()
                        else
                            callback()

                    , (err) ->

                        return update()

                else

                    return update()

        ) () ->

            updater = 
                $set:
                    status:  Tile.data[t.id].status
                    portals: Tile.data[t.id].portals

            Database.db.collection('Tiles').update {_id: t.id}, updater, callback

    , callback

processErrorTileResponse = (tiles, callback) ->

    for id in tiles

        if Tile.data[id].status is STATUS_PENDING

            Tile.data[id].status = STATUS_FAIL
            Tile.data[id].errors++

            if Tile.data[id].errors > Config.Tile.MaxErrorRetry
            
                logger.error "PANIC: tile id=#{id}"
                Tile.data[id].status = STATUS_PANIC
                panicTiles.push id

            else

                failTiles.push id

    async.eachLimit tiles, Config.Database.MaxParallel, (id, callback) ->
        
        Database.db.collection('Tiles').update
            _id: id
        ,
            $set:
                status: Tile.data[id].status
        , callback

    , callback

checkTimeoutAndFailTiles = (callback) ->

    tileBucket.push id for id in timeoutTiles
    tileBucket.push id for id in failTiles

    timeoutTiles = []
    failTiles = []

    callback()