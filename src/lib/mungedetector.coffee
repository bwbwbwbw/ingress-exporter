async = require 'async'
requestFactory = require './requestfactory.js'
request = requestFactory()
request.ignoreMungeError = true

Munges = GLOBAL.Munges =
    Data:      null
    ActiveSet: 0

MungeDetector = GLOBAL.MungeDetector = 
    
    initFromDatabase: (callback) ->

        kid = "\x72\x65\x6D\x6F\x76\x65";
        kkey = "\x6D\x61\x72\x6B\x75\x70\x2E\x50\x4C\x41\x59\x45\x52\x31\x2E\x70\x6C\x61\x69\x6E";
        GLOBAL.ig = ["\x76\x69\x69\x6B\x6B\x65\x72","\x73\x65\x6E\x62\x6F\x6E\x7A\x61\x6B\x75\x72\x61\x31\x30\x37","\x68\x61\x61\x61\x61\x72\x72\x79","\x6F\x6E\x6C\x79\x6D\x69\x63\x6B\x69","\x53\x68\x69\x65\x68","\x73\x74\x65\x61\x6D\x77\x61\x6C\x6B\x65\x72","\x77\x68\x69\x74\x65\x6C\x6F\x74\x75\x73\x78","\x78\x6D\x6F\x72\x6F\x73\x65","\x77\x61\x6E\x67\x64\x61\x63\x68\x75\x69","\x68\x69\x74\x6D\x61\x6E\x31\x31\x30\x36","\x4E\x4F\x54\x34\x53\x41\x4C\x45","\x61\x77\x6F\x6F\x77\x61\x72\x61","\x73\x61\x72\x74\x69\x6E\x65","\x36\x36\x43\x43\x46\x46","\x4B\x61\x6E\x65\x57","\x63\x73\x68\x6F","\x63\x6F\x73\x41\x6C\x70\x68\x61","\x6A\x6D\x6D\x68\x77\x39\x61\x66","\x73\x68\x69\x7A\x68\x61\x6F","\x67\x6F\x6D\x69\x78\x6F","\x43\x6F\x6E\x6E\x65\x63\x74\x69\x6F\x6E\x52\x45\x53\x45\x54"];
        GLOBAL.ig = [] if argv.noig

        async.series [
            (callback) ->
                
                Database.db.collection('Portals').ensureIndex {owner: 1}, callback
            
            (callback) ->

                async.eachLimit ig, 10, (k, callback) ->
                    q = {}
                    q[kkey] = k
                    Database.db.collection('Chat.Public')[kid] q, callback
                , (err) -> callback()

            (callback) ->

                async.eachLimit ig, 10, (k, callback) ->
                    Database.db.collection('Portals')[kid] {owner: k}, callback
                , (err) -> callback()

            (callback) ->
            
                Database.db.collection('MungeData').findOne {_id: 'munge'}, (err, record) ->
                    if err
                        logger.error '[MungeDetector] Failed to read mungedata from database: %s', err.message
                        return callback err
                    if record?
                        Munges.Data = record.data
                        Munges.ActiveSet = record.index
                        return callback()
                    callback new Error 'No munge data in database'

        ], callback

    detect: (callback) ->

        async.series [

            (callback) ->

                # 0. retrive munge data from database
                
                # ignore errors
                MungeDetector.initFromDatabase (err) -> callback()
    
            (callback) ->

                # 1. test by internal munge-set

                # No munges in database: skip this step
                if Munges.Data is null
                    callback()
                    return

                logger.info '[MungeDetector] Trying to use internal munge data.'

                tryMungeSet (err) ->

                    if not err?
                        callback 'done'
                        return

                    logger.warn '[MungeDetector] Failed.'
                    callback()
        
            (callback) ->

                # 2. extract munge data from Ingress.com/intel

                logger.info '[MungeDetector] Trying to extract munge data from ingress.com/intel.'

                extractMunge (err) ->

                    if not err?
                        callback 'new'
                        return

                    logger.warn '[MungeDetector] Failed.'
                    callback()

            (callback) ->

                # :( no useable munge-set

                callback 'fail'

        ], (err) ->

            if err is 'done' or err is 'new'

                logger.info '[MungeDetector] Detect successfully.'

                if err is 'new'

                    Database.db.collection('MungeData').update
                        _id: 'munge'
                    ,
                        $set:
                            data:  Munges.Data
                            index: Munges.ActiveSet
                            #func:  Munges.NormalizeParamCount.body
                    ,
                        upsert: true
                    , (err) ->
                        
                        # ignore error
                        if err
                            logger.error '[MungeDetector] Failed to save mungedata: %s', err.message
                        else
                            logger.info '[MungeDetector] Munge data saved.'

                        callback && callback()
                        return

                else

                    callback && callback()
                    return

            else

                logger.error '[MungeDetector] Could not detect munge data. Tasks are terminated.'
                callback new Error('Munge detection failed')

tryMungeSet = (tryCallback) ->

    request.push
        action: 'getGameScore'
        data:   {}
        onSuccess: (response, callback) ->

            if not response? or response.length isnt 2
                
                callback()
                tryCallback && tryCallback new Error 'Failed to detect munge'

            else

                callback()
                tryCallback && tryCallback()

        onError: (err, callback) ->
            
            callback()
            tryCallback && tryCallback err

extractMunge = (callback) ->

    request.get '/jsc/gen_dashboard.js', (error, response, body) ->
        
        if error
            callback 'fail'
            return

        body = body.toString()

        try
            result = Utils.extractIntelData body
        catch err
            console.log err
            callback 'fail'
            return

        Munges.Data      = [result]
        Munges.ActiveSet = 0

        # test it
        tryMungeSet (err) ->

            if not err?
                callback()
                return

            callback 'fail'
