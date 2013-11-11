async = require 'async'

ObjectID = Database.db.bson_serializer.ObjectID

STATUS_PENDING  = 0
STATUS_ERROR    = 1
STATUS_COMPLETE = 2

Chat = GLOBAL.Chat =
    
    tasks: {}
    length: 0

    createTasks: (timestampMin, callback) ->

        timestampMax = new Date().getTime()

        preparedTasks = []

        for TSmin in [timestampMin..timestampMax] by Config.Chat.SplitTimespanMS
            
            TSmax = Math.min(timestampMax, TSmin + Config.Chat.SplitTimespanMS - 1)
            continue if TSmax is TSmin

            preparedTasks.push
                data:
                    desiredNumItems: Config.Chat.FetchItemCount
                    minLatE6:        Math.round(Config.Region.SouthWest.Lat * 1e6)
                    minLngE6:        Math.round(Config.Region.SouthWest.Lng * 1e6)
                    maxLatE6:        Math.round(Config.Region.NorthEast.Lat * 1e6)
                    maxLngE6:        Math.round(Config.Region.NorthEast.Lng * 1e6)
                    minTimestampMs:  TSmin
                    maxTimestampMs:  TSmax
                    chatTab:         'all'
                status: STATUS_PENDING
                _id:    new ObjectID()

        async.eachLimit preparedTasks, Config.Database.MaxParallel, (task, callback) ->

            Chat.tasks[task._id.toString()] = task
            Chat.length++
            Database.db.collection('Chat._queue').insert task, callback

        , ->

            Database.db.collection('Chat._data').update {_id: 'last_task'},
                
                $set:
                    timestamp: timestampMax

            , {upsert: true}, (err) ->

                console.info "[Broadcasts] Created #{preparedTasks.length} tasks (all #{Chat.length} tasks)."
                callback && callback()
    
    prepareFromDatabase: (callback) ->

        logger.info "[Broadcasts] Continue: [#{Config.Region.SouthWest.Lat},#{Config.Region.SouthWest.Lng}]-[#{Config.Region.NorthEast.Lat},#{Config.Region.NorthEast.Lng}]"
        
        # TODO: Maybe should take TimeOffset into consideration?

        timestampMin    = new Date().getTime() - Config.Chat.TraceTimespanMS
        timestampMinMax = new Date().getTime() - Config.Chat.MaxTraceTimespanMS

        async.series [
            (callback) ->

                # query queued tasks

                Database.db.collection('Chat._queue').find().toArray (err, tasks) ->
                    
                    if tasks?
                        for task in tasks
                            Chat.tasks[task._id.toString()] = task
                            Chat.length++

                    callback()

            , (callback) ->

                # get last timestamp

                Database.db.collection('Chat._data').findOne {_id: 'last_task'}, (err, data) ->

                    timestampMin = data.timestamp + 1 if data?.timestamp?
                    timestampMin = timestampMinMax if timestampMin < timestampMinMax

                    callback()

            , (callback) ->

                # create tasks

                Chat.createTasks timestampMin, callback

            , callback
        ]

    prepareNew: (callback) ->

        logger.info "[Broadcasts] New: [#{Config.Region.SouthWest.Lat},#{Config.Region.SouthWest.Lng}]-[#{Config.Region.NorthEast.Lat},#{Config.Region.NorthEast.Lng}]"
        
        timestampMin = new Date().getTime() - Config.Chat.TraceTimespanMS        
        Chat.createTasks timestampMin, callback

    start: ->

        null