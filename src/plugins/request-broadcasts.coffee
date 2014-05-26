moment = require 'moment'
async = require 'async'
scutil = require '../lib/scutil.js'
broadcastTasker = require '../lib/broadcast.js'

messageCount    = 0
messageReceived = 0
messageInserted = 0
noMoreMessages  = false

taskCount     = 0
taskCompleted = 0

module.exports = 

    onBootstrap: (callback) ->

        if argv.broadcasts
            bootstrap ->
                callback 'end'
        else
            callback()

dbQueue = async.queue (task, callback) ->

    task callback

, Config.Database.MaxParallel

bootstrap = (callback) ->

    indexes = [
        {time: -1}
        {'markup.PLAYER1.plain': 1}
        {'markup.PORTAL1.guid': 1}
    ]

    # ensure indexes
    async.each indexes, (index, callback) ->

        Database.db.collection('Chat.Public').ensureIndex index, callback

    , ->

        dbQueue.drain = ->
            callback() if noMoreMessages

        region = scutil.getLatLngRegion Config.Region

        broadcast = broadcastTasker
            instanceId:         'req-broadcast-all'
            type:               'all'
            splitTimespanMS:    Config.Chat.SplitTimespanMS.Broadcast
            region:             region

        broadcast.on 'error', (err) ->
            logger.error "[Broadcasts] #{err.message}"

        broadcast.on 'complete', ->
            noMoreMessages = true

        broadcast.on 'receive', (response) ->
            for rec in response
                messageReceived++
                insertMessage rec[0], rec[1], rec[2] 

        broadcast.on 'response', (data, done, max) ->
            logger.info '[Broadcasts] [%s - %s] %d% [%d/%d] [%d/%d]\tReceived %d (all %d)',
                moment(data.minTimestampMs).format('MMM Do, HH:mm:ss'),
                moment(data.maxTimestampMs).format('MMM Do, HH:mm:ss'),
                Math.round(taskCompleted / taskCount * 100),
                taskCompleted,
                taskCount,
                done,
                max,
                messageReceived,
                messageCount

        broadcast.on 'taskcreated', (preparedLength, allLength) ->
            taskCount = allLength
            logger.info "[Broadcasts] Created #{preparedLength} tasks (all #{allLength} tasks)."

        broadcast.on 'taskcompleted', ->
            taskCompleted++
            callback() if dbQueue.length() is 0 and taskCompleted is taskCount

        broadcast.on 'beforestart', ->
            logger.info "[Broadcasts] Begin requesting..."

        tsMax = Date.now()
        
        if argv.tracedays
            tsMin = tsMax - parseFloat(argv.tracedays) * 24 * 60 * 60 * 1000
        else
            tsMin = tsMax - Config.Chat.TraceTimespanMS
        
        broadcast.start tsMin, tsMax, not (argv.new or argv.n)

insertMessage = (id, timestamp, data) ->

    if messageInserted % 100 is 0
                
        Database.db.collection('Chat.Public').count {}, (err, count) ->
            messageCount = count if count

    messageInserted++

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
            
                Database.db.collection('Chat.Public').insert doc, callback

            (callback) ->

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
                
        ], done
