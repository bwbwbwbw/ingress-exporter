async = require 'async'
requestFactory = require './requestfactory.js'
request = requestFactory()

AccountInfo = GLOBAL.AccountInfo = 
    
    fetch: (callback) ->

        logger.info '[AccountInfo] Fetching current account information...'

        ((callback) ->

            request.get '/intel', (error, response, body) ->

                if error
                    return callback error

                body = body.toString()

                MAGIC_1 = 'var PLAYER = '
                MAGIC_2 = ';'

                p1 = body.indexOf MAGIC_1
                p2 = body.indexOf MAGIC_2, p1 + MAGIC_1.length

                if p1 is -1 or p2 is -1
                    return callback new Error('Failed to fetch information.')

                try
                    player = JSON.parse body.substring(p1 + MAGIC_1.length, p2)
                catch e
                    return callback new Error('Failed to parse player information.')

                callback null, player

        ) (err, player) ->

            if err
                logger.error '[AccountInfo] %s', err.message
                return callback err

            logger.info '[AccountInfo] %s (%s)', player.nickname, player.team
            logger.warn '[AccountInfo] %s', 'Please immediately press Ctrl+C if you are using an incorrect account.'.yellow.inverse

            callback()