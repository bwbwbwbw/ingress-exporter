async = require 'async'
events = require 'events'
requestFactory = require './requestfactory.js'

ObjectID = require('mongoskin').ObjectID

STATUS_PENDING     = 0
STATUS_ERROR       = 1
STATUS_NOTCOMPLETE = 2
STATUS_COMPLETE    = 3

FETCH_ITEM_COUNT   = 50

class BroadcastTasker

    ###
        options:
            type:               all|faction
            splitTimespanMS:    int
            region:             SouthWest {Lat, Lng}, NorthEast {Lat, Lng}
            [instanceId]:       string
        events:
            error (err)
            complete (err)
            receive (obj)
            response (done, max)
            createtask
            taskcreated (preparedLength, allLength)
            taskcompleted (taskid)
            updatequeue
            queueupdated
            beforestart
    ###
    constructor: (options) ->

        @request = requestFactory()
        @emitter = new events.EventEmitter()
        @options = options
        @options.instanceId = Date.now().toString(16) + Math.floor(Math.random() * 0xEFFF + 0x1000).toString(16) if not @options.instanceId?

    addListener: (event, listener) =>

        @emitter.addListener event, listener

    on: (event, listener) =>

        @emitter.on event, listener

    once: (event, listener) =>

        @emitter.once event, listener

    removeListener: (event, listener) =>

        @emitter.removeListener event, listener

    removeAllListeners: (event) =>

        @emitter.removeAllListeners event

    start: (timestampMin, timestampMax, continueTask) =>

        @tasks  = {}
        @length = 0

        continueTask = true if not continueTask?

        if not continueTask

            @createTasks timestampMin, timestampMax, @_start

        else

            tsMin = timestampMin

            async.series [

                (callback) =>

                    # query queued tasks
                    Database.db.collection('chat_queue').find({instance: @options.instanceId}).toArray (err, tasks) =>
                        
                        if tasks?
                            for task in tasks
                                @tasks[task._id.toString()] = task
                                @length++

                        callback()

                (callback) =>

                    # get last timestamp
                    Database.db.collection('chat_meta').findOne {_id: @options.instanceId}, (err, meta) ->

                        tsMin = meta.timestamp - 10 if meta?.timestamp?
                        tsMin = timestampMin if tsMin < timestampMin

                        callback()

                (callback) =>

                    # create tasks
                    @createTasks tsMin, timestampMax, callback

            ], @_start

    createTasks: (timestampMin, timestampMax, taskCreatedCallback) =>

        @emitter.emit 'createtask'

        preparedTasks = []

        for TSmin in [timestampMin..timestampMax] by @options.splitTimespanMS

            TSmax = Math.min(timestampMax, TSmin + @options.splitTimespanMS)
            continue if TSmax is TSmin

            if argv.safe
                REPEAT_TIMES = 3
            else
                REPEAT_TIMES = 1

            for i in [1 .. REPEAT_TIMES]
                preparedTasks.push
                    data:
                        minLatE6:        Math.round(@options.region.SouthWest.Lat * 1e6)
                        minLngE6:        Math.round(@options.region.SouthWest.Lng * 1e6)
                        maxLatE6:        Math.round(@options.region.NorthEast.Lat * 1e6)
                        maxLngE6:        Math.round(@options.region.NorthEast.Lng * 1e6)
                        minTimestampMs:  TSmin - 10
                        maxTimestampMs:  TSmax + 10
                        tab:             @options.type
                    instance: @options.instanceId
                    status:   STATUS_PENDING
                    _id:      new ObjectID()

        async.eachLimit preparedTasks, Config.Database.MaxParallel, (task, callback) =>

            @tasks[task._id.toString()] = task
            @length++

            Database.db.collection('chat_queue').insert task, callback

        , =>

            Database.db.collection('chat_meta').update
                _id: @options.instanceId
            ,
                $set:
                    timestamp: timestampMax
            ,
                upsert: true
            , (err) =>

                if err
                    @emitter.emit 'error', err
                    @emitter.emit 'complete', err
                    return

                @emitter.emit 'taskcreated', preparedTasks.length, @length
                taskCreatedCallback()
    
    _start: =>

        taskList = []
        taskList.push taskId for taskId of @tasks

        if taskList.length is 0
            @emitter.emit 'complete'
            return

        @emitter.emit 'updatequeue'
        async.eachLimit taskList, Config.Database.MaxParallel, (taskId, callback) =>

            @tasks[taskId].status = STATUS_PENDING

            Database.db.collection('chat_queue').update
                _id:    new ObjectID(taskId)
            ,
                $set:
                    status: STATUS_PENDING
            , callback

        , (err) =>

            @emitter.emit 'queueupdated'

            @request.queue.drain = =>
                @emitter.emit 'complete'

            @emitter.emit 'beforestart'

            @requestTask taskId for taskId in taskList

    requestTask: (taskId) =>

        d = JSON.parse(JSON.stringify(@tasks[taskId].data))

        @request.push

            action: 'getPlexts'
            data:   d
            onSuccess: (response, callback) =>

                @emitter.emit 'receive', response.success
                @parseChatResponse taskId, response.success, callback

            onError: (err, callback) =>

                @emitter.emit 'error', err
                @requestTask taskId
                callback()

            afterResponse: (callback) =>

                @emitter.emit 'response', d, @request.done, @request.max
                callback()

    parseChatResponse: (taskId, response, parseCompleteCallback) =>
        
        if response.length < FETCH_ITEM_COUNT

            # no more messages: remove task
            delete @tasks[taskId]
            @length--

            Database.db.collection('chat_queue').remove
                _id: new ObjectID(taskId)
            ,
                single: true
            , =>
                @emitter.emit 'taskcompleted', taskId
                parseCompleteCallback()

        else

            # records are in descend order.
            # set the maxtimestamp equal to mintimestamp of the response
            maxTimestamp = parseInt(response[response.length - 1][1]) - 1

            @tasks[taskId].data.maxTimestampMs = maxTimestamp
            @tasks[taskId].status = STATUS_NOTCOMPLETE

            Database.db.collection('chat_queue').update 
                _id: new ObjectID(taskId)
            ,
                $set:
                    status: STATUS_NOTCOMPLETE
                    'data.maxTimestampMs': maxTimestamp
            , (err) =>

                # insert into queue again
                @requestTask taskId
                parseCompleteCallback()

module.exports = (options) ->

    return new BroadcastTasker options