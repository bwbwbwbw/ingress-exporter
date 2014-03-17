moment = require 'moment'

module.exports = 

    onBootstrap: (callback) ->

        if argv.trace
            bootstrap ->
                callback 'end'
        else
            callback()

bootstrap = (callback) ->

    cursor = Database.db.collection('Chat.Public').find(
        'markup.PLAYER1.plain': argv.player
        time:
            $gte: Date.now() - 30 * 24 * 60 * 60 * 1000
    ).sort({time: -1}).limit(500).toArray (err, logs) ->

        for item in logs
            console.log '[%s]\t%s', moment(item.time).format('LLL'), item.text

        callback()