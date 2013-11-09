async = require 'async'

Chat = GLOBAL.Chat =
    
    tasks: {}

    createTasks: (timestampMin, callback) ->

        timestampMax = new Date().getTime()

    
    prepareFromDatabase: (callback) ->

        logger.info "[Broadcasts] Continue: [#{Config.Region.SouthWest.Lat},#{Config.Region.SouthWest.Lng}]-[#{Config.Region.NorthEast.Lat},#{Config.Region.NorthEast.Lng}]"
        
        timestampMin = -1

        async.series [
            (callback) ->
                # query queued tasks
                Database.db.collection('Chat._queue').find().toArray (err, tasks) ->
                    tasks[task._id] = task for task in tasks if tasks?
                    callback()
            , (callback) ->
                # get last timestamp
                Database.db.collection('Chat._data').findOne {id: 'last_task'}, (err, data) ->
                    timestampMin = data.timestamp if data?
                    callback()
            , (callback) ->
                # create tasks
                Chat.createTasks timestampMin, callback
            , callback
        ]

    prepareNew: (callback) ->

        logger.info "[Broadcasts] New: [#{Config.Region.SouthWest.Lat},#{Config.Region.SouthWest.Lng}]-[#{Config.Region.NorthEast.Lat},#{Config.Region.NorthEast.Lng}]"
        
        Chat.createTasks new Date().getTime()

    _start: ->


        Request.add

            action: 'getPaginatedPlextsV2'
            data:   data
            onSuccess: (response) ->

                processSuccessTileResponse response, tileIds

            onError: (err) ->

                logger.error "[Portals] " + err
                processErrorTileResponse tileIds, noop

            afterResponse: ->

                checkTimeoutAndFailTiles()

                logger.info "[Portals] " +
                    Math.round(Request.requested / Request.maxRequest * 100).toString() +
                    "%\t[#{Request.requested}/#{Request.maxRequest}]" +
                    "\t#{Entity.counter.portals} portals, #{Entity.counter.links} links, #{Entity.counter.fields} fields"

            beforeRequest: ->

                null