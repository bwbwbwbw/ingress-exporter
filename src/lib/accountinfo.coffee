async = require 'async'
requestFactory = require './requestfactory.js'
request = requestFactory()

AccountInfo = GLOBAL.AccountInfo = 
    
    getAccount: (session, callback) ->

        request.get '/intel', (error, response, body) ->

            return callback error if error
                
            body = body.toString()

            MAGIC_1 = 'var PLAYER = '
            MAGIC_2 = ';'

            p1 = body.indexOf MAGIC_1
            p2 = body.indexOf MAGIC_2, p1 + MAGIC_1.length

            return callback new Error('Failed to fetch information. (#' + session.index + ')') if p1 is -1 or p2 is -1

            try
                player = JSON.parse body.substring(p1 + MAGIC_1.length, p2)
            catch e
                return callback new Error('Failed to parse player information. (#' + session.index + ')')

            callback null, player

        , session

    fetch: (callback) ->

        logger.info '[AccountInfo] Fetching current account information...'

        accounts = []

        async.each requestFactory.sessions, (session, callback) ->

            AccountInfo.getAccount session, (err, player) ->

                if err
                    callback err
                else
                    accounts.push player
                    callback()

        , (err) ->

            if err
                logger.error '[AccountInfo] %s', err.message
                return callback err

            logger.info '[AccountInfo] %s (%s)', player.nickname, player.team for player in accounts
            logger.warn '[AccountInfo] %s', 'Please immediately press Ctrl+C if you are using an incorrect account.'.yellow

            callback()
