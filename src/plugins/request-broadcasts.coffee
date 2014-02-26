async = require 'async'
requestFactory = require '../lib/request.js'
request = requestFactory()

ObjectID = Database.db.bson_serializer.ObjectID

STATUS_PENDING     = 0
STATUS_ERROR       = 1
STATUS_NOTCOMPLETE = 2
STATUS_COMPLETE    = 3

messageCount = 0
insertCount  = 0

module.exports = 

    onBootstrap: (callback) ->

        if argv.broadcasts
            bootstrap ->
                callback 'end'
        else
            callback()

bootstrap = (callback) ->

    if argv.new or argv.n
        Chat.prepareNew Chat.TYPE_PUBLIC, ->
            Chat.start callback
    else
        Chat.prepareFromDatabase Chat.TYPE_PUBLIC, ->
            Chat.start callback

Chat = 
    
    TYPE_PUBLIC:  'all'
    TYPE_FACTION: 'faction'

    tasks:  {}
    length: 0

    createTasks: (type, timestampMin, callback) ->

        timestampMax = new Date().getTime()

        preparedTasks = []

        for TSmin in [timestampMin..timestampMax] by Config.Chat.SplitTimespanMS

            TSmax = Math.min(timestampMax, TSmin + Config.Chat.SplitTimespanMS - 1)
            continue if TSmax is TSmin

            preparedTasks.push
                type:  type
                data:
                    desiredNumItems: Config.Chat.FetchItemCount
                    minLatE6:        Math.round(Config.Region.SouthWest.Lat * 1e6)
                    minLngE6:        Math.round(Config.Region.SouthWest.Lng * 1e6)
                    maxLatE6:        Math.round(Config.Region.NorthEast.Lat * 1e6)
                    maxLngE6:        Math.round(Config.Region.NorthEast.Lng * 1e6)
                    minTimestampMs:  TSmin
                    maxTimestampMs:  TSmax
                    chatTab:         type
                status: STATUS_PENDING
                _id:    new ObjectID()

        async.eachLimit preparedTasks, Config.Database.MaxParallel, (task, callback) ->

            Chat.tasks[task._id.toString()] = task
            Chat.length++

            Database.db.collection('chat_queue').insert task, callback

        , ->

            Database.db.collection('chat_data').update
                _id: 'last_task'
            ,    
                $set:
                    'timestamp_' + type: timestampMax
            ,
                upsert: true
            , (err) ->

                logger.info "[Broadcasts.#{type}] Created #{preparedTasks.length} tasks (all #{Chat.length} tasks)."
                callback && callback()
    
    prepareFromDatabase: (type, callback) ->

        logger.info "[Broadcasts.#{type}] Continue: [#{Config.Region.SouthWest.Lat},#{Config.Region.SouthWest.Lng}]-[#{Config.Region.NorthEast.Lat},#{Config.Region.NorthEast.Lng}]"
        
        # TODO: Maybe should take TimeOffset into consideration?
        timestampMin    = new Date().getTime() - Config.Chat.TraceTimespanMS
        timestampMinMax = new Date().getTime() - Config.Chat.MaxTraceTimespanMS

        async.series [

            (callback) ->

                # query queued tasks

                Database.db.collection('chat_queue').find({type: type}).toArray (err, tasks) ->
                    
                    if tasks?
                        for task in tasks
                            Chat.tasks[task._id.toString()] = task
                            Chat.length++

                    callback()

            , (callback) ->

                # get last timestamp

                Database.db.collection('chat_data').findOne {_id: 'last_task'}, (err, data) ->

                    timestampMin = data[type].timestamp + 1 if data?[type]?.timestamp?
                    timestampMin = timestampMinMax if timestampMin < timestampMinMax

                    callback()

            , (callback) ->

                # create tasks

                Chat.createTasks type, timestampMin, callback

        ], callback

    prepareNew: (type, callback) ->

        logger.info "[Broadcasts.#{type}] New: [#{Config.Region.SouthWest.Lat},#{Config.Region.SouthWest.Lng}]-[#{Config.Region.NorthEast.Lat},#{Config.Region.NorthEast.Lng}]"
        
        timestampMin = new Date().getTime() - Config.Chat.TraceTimespanMS        
        Chat.createTasks type, timestampMin, callback

    start: (callback) ->

        # ensure index

        async.series [

            (callback) ->

                Database.db.collection('Chat.all').ensureIndex {time: -1}, callback

            , (callback) ->

                Database.db.collection('Chat.all').ensureIndex {'markup.player1.guid': 1}, callback

            , (callback) ->

                Database.db.collection('Chat.all').ensureIndex {'markup.portal1.guid': 1}, callback
            
            ,(callback) ->

                Database.db.collection('Chat.faction').ensureIndex {time: -1}, callback

            , (callback) ->

                Database.db.collection('Chat.faction').ensureIndex {'markup.player1.guid': 1}, callback

            , (callback) ->

                Database.db.collection('Chat.faction').ensureIndex {'markup.portal1.guid': 1}, callback

        ], ->
            
            taskList = []
            taskList.push taskId for taskId of Chat.tasks

            if taskList.length is 0
                logger.info "[Broadcasts] Nothing to request"
                return callback()

            logger.info "[Broadcasts] Updateing queue..."
            async.eachLimit taskList, Config.Database.MaxParallel, (taskId, callback) ->

                Chat.tasks[taskId].status = STATUS_PENDING

                Database.db.collection('chat_queue').update
                    _id:    new ObjectID(taskId)
                ,
                    $set:
                        status: STATUS_PENDING
                , callback

            , (err) ->

                logger.info "[Broadcasts] Begin requesting..."

                request.queue.drain = callback
                Chat.request taskId for taskId in taskList

    request: (taskId) ->

        chatType = Chat.tasks[taskId].type

        request.push

            action: 'getPaginatedPlexts'
            data:   Chat.tasks[taskId].data
            onSuccess: (response, callback) ->

                parseChatResponse chatType, taskId, response.result, callback

            onError: (err, callback) ->

                # TODO: Recover tasks
                
                logger.error "[Broadcasts.#{chatType}] #{err.message}"
                callback()

            afterResponse: (callback) ->

                logger.info "[Broadcasts.#{chatType}] " +
                    Math.round(request.done / request.max * 100).toString() +
                    "%\t[#{request.done}/#{request.max}]" +
                    "\t#{messageCount} messages (#{dbQueue.length()} in buffer)"

                callback()

parseChatResponse = (type, taskId, response, callback) ->

    async.each response, (rec, callback) ->

        insertMessage type, rec[0], rec[1], rec[2], callback

    , ->

        if response.length < Config.Chat.FetchItemCount

            # no more messages: remove task
            
            delete Chat.tasks[taskId]
            Chat.length--

            Database.db.collection('chat_queue').remove
                _id: new ObjectID(taskId)
            ,
                single: true
            , callback

        else

            # records are in descend order.

            maxTimestamp = parseInt(response[response.length - 1][1]) - 1
            Chat.tasks[taskId].data.maxTimestampMs = maxTimestamp
            Chat.tasks[taskId].status = STATUS_NOTCOMPLETE

            Database.db.collection('chat_queue').update 
                _id: new ObjectID(taskId)
            ,
                $set:
                    status: STATUS_NOTCOMPLETE
                    'data.maxTimestampMs': maxTimestamp
            , ->

                # insert into queue again
                Chat.request taskId
                callback()

###########################################
# Database Queue

dbQueue = async.queue (task, callback) ->

    task callback

, Config.Database.MaxParallel

insertMessage = (type, id, timestamp, data, callback) ->

    async.series [

        (callback) ->

            if insertCount % 100 is 0
                
                Database.db.collection('Chat.' + type).count {}, (err, count) ->
                    messageCount = count
                    callback()

            else

                callback()
        
        , (callback) ->

            insertCount++

            data2 = data.plext

            # parse markup
            markup = {}
            count = {}

            for m in data.plext.markup
                count[m[0]] = 0 if not count[m[0]]?
                count[m[0]]++
                markup[m[0]+count[m[0]].toString()] = m[1]

            data2.markup = markup

            dbQueue.push (done) ->

                doc = data2
                doc._id = id
                doc.time = timestamp

                async.series [

                    (callback) ->
                    
                        Database.db.collection('Chat.' + type).insert doc, callback

                    , (callback) ->

                        # resove player names
                        if doc.markup.PLAYER1?

                            level = 0

                            if doc.markup.TEXT1.plain is ' deployed an '
                                level = parseInt doc.markup.TEXT2.plain.substr(1)

                            Agent.resolved doc.markup.PLAYER1.plain,
                                team:  Agent.strToTeam(doc.markup.PLAYER1.team)
                                level: level
                            , callback

                        else

                            callback()
                        
                ], ->

                    done()
                    callback()
    
    ], callback