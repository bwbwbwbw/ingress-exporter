async = require 'async'
requestFactory = require './request.js'
request = requestFactory()

NemesisMethodName = null

Munges = GLOBAL.Munges =
    Data:      null
    ActiveSet: 0

MungeDetector = GLOBAL.MungeDetector = 
    
    detect: (callback) ->

        async.series [

            (callback) ->

                # 0. retrive munge data from database

                Database.db.collection('MungeData').findOne {_id: 'munge'}, (err, record) ->

                    if err
                        logger.error '[MungeDetector] Failed to read mungedata from database: %s', err.message
                        return callback err

                    if record?
                        Munges.Data = record.data
                        Munges.ActiveSet = record.index

                    callback()

            , (callback) ->

                # 1. test by internal munge-set

                # No munges in database: skip this step
                if Munges.Data is null
                    callback()
                    return

                logger.info '[MungeDetector] Trying to use internal munge data.'

                tryMungeSet Munges.Data[Munges.ActiveSet], (err) ->

                    if not err?
                        callback 'done'
                        return

                    logger.warn '[MungeDetector] Failed.'
                    callback()

            , (callback) ->

                # 2. extract munge data from Ingress.com/intel

                logger.info '[MungeDetector] Trying to extract munge data from ingress.com/intel.'

                extractMunge (err) ->

                    if not err?
                        callback 'new'
                        return

                    logger.warn '[MungeDetector] Failed.'
                    callback()

            , (callback) ->

                # :( no useable munge-set

                callback 'fail'

        ], (err) ->

            if err is 'done' or err is 'new'
                
                logger.info '[MungeDetector] Detect successfully.'

                if err is 'new'

                    Database.db.collection('MungeData').update {_id: 'munge'},
                        $set:
                            data:  Munges.Data
                            index: Munges.ActiveSet
                    , {upsert: true}
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

tryMungeSet = (munge, tryCallback) ->

    request.munge = munge

    request.push
        action: 'getGameScore'
        data:   {}
        onSuccess: (response, callback) ->

            if not response?.result?.resistanceScore?
                
                callback()
                tryCallback && tryCallback err

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

        # some hacks
        export_obj = {}
        google =
            maps:
                OverlayView: ->
                    null
        eval body + ';export_obj.nemesis = nemesis;'

        try
            result = Utils.extractMungeFromStock export_obj.nemesis
        catch err
            callback 'fail'
            return

        Munges.Data      = [result]
        Munges.ActiveSet = 0

        # test it
        tryMungeSet Munges.Data[Munges.ActiveSet], (err) ->

            if not err?
                callback()
                return

            callback 'fail'
