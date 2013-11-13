async = require 'async'

ObjectID = Database.db.bson_serializer.ObjectID

STATUS_PENDING     = 0
STATUS_ERROR       = 1
STATUS_NOTCOMPLETE = 2
STATUS_COMPLETE    = 3

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

                logger.info "[Broadcasts] Created #{preparedTasks.length} tasks (all #{Chat.length} tasks)."
                callback && callback.apply this, arguments
    
    prepareFromDatabase: (callback) ->

        logger.info "[Broadcasts] Continue: [#{Config.Region.SouthWest.Lat},#{Config.Region.SouthWest.Lng}]-[#{Config.Region.NorthEast.Lat},#{Config.Region.NorthEast.Lng}]"
        
        # TODO: Maybe should take TimeOffset into consideration?

        TaskManager.begin()

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

        ], ->

            callback()
            TaskManager.end 'Chat.prepareFromDatabase'

    prepareNew: (callback) ->

        logger.info "[Broadcasts] New: [#{Config.Region.SouthWest.Lat},#{Config.Region.SouthWest.Lng}]-[#{Config.Region.NorthEast.Lat},#{Config.Region.NorthEast.Lng}]"
        
        timestampMin = new Date().getTime() - Config.Chat.TraceTimespanMS        
        Chat.createTasks timestampMin, callback

    start: ->

        TaskManager.begin()

        async.series [

            (callback) ->

                Database.db.collection('Chat').ensureIndex {time: -1}, callback

            , (callback) ->

                Database.db.collection('Chat').ensureIndex {'markup.player1.guid': 1}, callback

            , (callback) ->

                Database.db.collection('Chat').ensureIndex {'markup.portal1.guid': 1}, callback

        ], ->
            
            taskList = []
            taskList.push taskId for taskId of Chat.tasks

            if taskList.length is 0
                logger.info "[Broadcasts] Nothing to request"
                TaskManager.end 'Chat.start'
                return

            logger.info "[Broadcasts] Begin requesting..."
            Chat.request taskList[0]
            TaskManager.end 'Chat.start'

    request: (taskId, callback) ->

        TaskManager.begin()

        Chat.tasks[taskId].status = STATUS_PENDING

        Database.db.collection('Chat._queue').update
                _id:    new ObjectID(taskId)
            ,
                $set:
                    status: STATUS_PENDING
            , (err) ->

                Request.add

                    action: 'getPaginatedPlextsV2'
                    data:   Chat.tasks[taskId].data
                    onSuccess: (response) ->

                        rec = response.result[0]
                        insertMessage rec[0], rec[1], rec[2] #for rec in response.result

                    onError: (err) ->

                        logger.error "[Broadcasts] " + err
                        #processErrorTileResponse tileIds, noop

                    afterResponse: ->

                        TaskManager.end 'Chat.request.callback'
                        #checkTimeoutAndFailTiles()

                        #logger.info "[Broadcasts] " +
                        #    Math.round(Request.requested / Request.maxRequest * 100).toString() +
                        #    "%\t[#{Request.requested}/#{Request.maxRequest}]" +
                        #    "\t#{Entity.counter.portals} portals, #{Entity.counter.links} links, #{Entity.counter.fields} fields"

                    beforeRequest: ->

                        null

###########################################
# Database Queue

dbQueue = async.queue (task, callback) ->

    doc = task.data
    doc._id = task.id
    doc.time = task.timestamp

    async.series [

        (callback) ->
        
            Database.db.collection('Chat').insert doc, callback

        , (callback) ->

            # resove player names
            if doc.markup.PLAYER1?

                level = null

                if doc.markup.TEXT1.plain is ' deployed an '
                    level = parseInt doc.markup.TEXT2.plain.substr(1)

                Agent.resolved doc.markup.PLAYER1.guid,
                    name:  doc.markup.PLAYER1.plain
                    team:  Agent.strToTeam(doc.markup.PLAYER1.team)
                    level: level
            
    ], ->
        callback()
        TaskManager.end 'dbQueue.queue.callback'

, Config.Database.MaxParallel

insertMessage = (id, timestamp, data) ->

    TaskManager.begin()

    data2 = data.plext

    # parse markup
    markup = {}
    count = {}

    for m in data.plext.markup
        count[m[0]] = 0 if not count[m[0]]?
        count[m[0]]++
        markup[m[0]+count[m[0]].toString()] = m[1]

    data2.markup = markup

    dbQueue.push
        id:        id
        timestamp: timestamp
        data:      data2