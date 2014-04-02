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

        if err
            logger.error '[Trace] %s', err.message
            return callback()

        lines = []
        
        for item in logs

            line = []
            line.push JSON.stringify item.text.toString()
            line.push JSON.stringify moment(item.time).format('LLLL').toString()

            lines.push line.join(',')
        
        if argv.output
            fs = require 'fs'
            fs.writeFileSync argv.output, lines.join('\n')
            logger.info '[Trace] Outputed %d records', lines.length
        else
            console.log lines.join('\n')

        callback()