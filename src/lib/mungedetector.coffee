async = require 'async'

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

                # 2. get munge-index from JavaScript online

                # No munges in database: skip this step
                if Munges.Data is null
                    callback()
                    return

                logger.info '[MungeDetector] Trying to use alternative internal munge data.'

                detectMungeIndex (err) ->

                    if not err?
                        callback 'new'
                        return

                    logger.warn '[MungeDetector] Failed.'
                    callback()

            , (callback) ->

                # 3. get munge data from IITC

                logger.info '[MungeDetector] Trying to parse newest IITC munge data.'

                getMungeIITC (err) ->

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
                        logger.info '[MungeDetector] Munge data saved.'
                        callback && callback()
                        return

                else

                    callback && callback()
                    return

            else

                logger.error '[MungeDetector] Could not detect munge data. Tasks are terminated.'
                process.exit 0

tryMungeSet = (munge, callback) ->

    task = Request.generate

        munge:  munge
        action: 'getGameScore'
        data:   {}
        onSuccess: (response) ->
            callback && callback()
        onError: (err) ->
            callback && callback err

    Request.post '/r/' + task.m, task.d, (error, response, body) ->

        if error
            task.error && task.error error
            return

        if not Request.processResponse error, response, body
            logger.error '[DEBUG] Unknown server response'
            return

        # unknown error
        if typeof body is 'string'
            task.error && task.error body
            return

        # maybe 'missing version'
        if body.error?
            task.error && task.error body.error
            return
        
        task.success && task.success body

detectMungeIndex = (callback) ->

    MAGIC_CODE = 'nemesis.dashboard.requests.MethodName = '

    Request.get '/jsc/gen_dashboard.js', (error, response, body) ->

        if error
            callback 'fail'
            return

        body = body.toString()
        p1 = body.indexOf MAGIC_CODE
        p2 = body.indexOf '}', p1

        NemesisMethodName = eval("(" + body.substring(p1 + MAGIC_CODE.length, p2 + 1) + ")")
        
        for munge, index in Munges.Data
            if NemesisMethodName.GET_GAME_SCORE is munge['dashboard.getGameScore']
                Munges.ActiveSet = index
                break

        # test it
        tryMungeSet Munges.Data[Munges.ActiveSet], (err) ->

            if not err?
                callback()
                return

            callback 'fail'

getMungeIITC = (callback) ->

    MAGIC_CODE = 'window.requestParameterMunges = '

    needle = require 'needle'
    needle.get 'https://secure.jonatkins.com/iitc/release/total-conversion-build.user.js', 

        compressed: true
        timeout:    20000

    , (error, response, body) ->

        if error
            callback 'fail'
            return

        body = body.toString()
        p1 = body.indexOf MAGIC_CODE
        p2 = body.indexOf ']', p1

        MungeSet = eval("(" + body.substring(p1 + MAGIC_CODE.length, p2 + 1) + ")")
        Munges.Data = MungeSet

        if NemesisMethodName isnt null

            for munge, index in MungeSet
                if NemesisMethodName.GET_GAME_SCORE is munge['dashboard.getGameScore']
                    Munges.ActiveSet = index
                    break

        else

            Munges.ActiveSet = Munges.Data.length - 1
        
        # test it
        tryMungeSet Munges.Data[Munges.ActiveSet], (err) ->

            if not err?
                callback()
                return

            callback 'fail'