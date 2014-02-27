async = require 'async'
requestFactory = require '../lib/request.js'
broadcastTasker = require '../lib/broadcast.js'
request = requestFactory()

messageCount    = 0
messageReceived = 0
messageInserted = 0
noMoreMessages  = false

taskCount     = 0
taskCompleted = 0

module.exports = 

    onBootstrap: (callback) ->

        if argv.faction
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
        {'markup.SENDER1.plain': 1}
        {'markup.PLAYER1.plain': 1}
    ]

    # ensure indexes
    async.each indexes, (index, callback) ->

        Database.db.collection('Chat.Faction').ensureIndex index, callback

    , ->

        dbQueue.drain = ->
            callback() if noMoreMessages

        broadcast = broadcastTasker
            instanceId:         'req-broadcast-faction'
            type:               'faction'
            splitTimespanMS:    Config.Chat.SplitTimespanMS
            region:             Config.Region

        broadcast.on 'error', (err) ->
            logger.error "[Faction] #{err.message}"

        broadcast.on 'complete', ->
            noMoreMessages = true

        broadcast.on 'receive', (response) ->
            for rec in response
                messageReceived++
                insertMessage rec[0], rec[1], rec[2] 

        broadcast.on 'response', (done, max) ->
            logger.info "[Faction] " +
                    Math.round(taskCompleted / taskCount * 100) + 
                    "% [#{taskCompleted}/#{taskCount}] [#{done}/#{max}]" +
                    "\tReceived #{messageReceived} (all #{messageCount})"

        broadcast.on 'taskcreated', (preparedLength, allLength) ->
            taskCount = allLength
            logger.info "[Faction] Created #{preparedLength} tasks (all #{allLength} tasks)."

        broadcast.on 'taskcompleted', ->
            taskCompleted++

        broadcast.on 'beforestart', ->
            logger.info "[Faction] Begin requesting..."

        if argv.new or argv.n
            logger.info "[Faction] New: [#{Config.Region.SouthWest.Lat},#{Config.Region.SouthWest.Lng}]-[#{Config.Region.NorthEast.Lat},#{Config.Region.NorthEast.Lng}]"
        else
            logger.info "[Faction] Continue: [#{Config.Region.SouthWest.Lat},#{Config.Region.SouthWest.Lng}]-[#{Config.Region.NorthEast.Lat},#{Config.Region.NorthEast.Lng}]"

        tsMax = Date.now()
        tsMin = tsMax - Config.Chat.TraceTimespanMS
        broadcast.start tsMin, tsMax, argv.new or argv.n

insertMessage = (id, timestamp, data) ->

    if messageInserted % 100 is 0
                
        Database.db.collection('Chat.Faction').count {}, (err, count) ->
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

        Database.db.collection('Chat.Faction').insert doc, done