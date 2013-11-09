async = require 'async'

NemesisMethodName = null

# use latest munge-set
Munges.ActiveSet = Munges.Data.length - 1 if not Munges.ActiveSet?

MungeDetector = GLOBAL.MungeDetector = 
    
    detect: (callback) ->

        logger.info '[MungeDetector] Initialize: Detecting munge data...'

        async.series [
        
            (callback) ->

                # 1. use the internal munge-set
                logger.info '[MungeDetector] Trying to use internal munge data.'

                tryMungeSet Munges.Data[Munges.ActiveSet], (err) ->

                    if not err?
                        callback 'done'
                        return

                    logger.warn '[MungeDetector] Failed.'
                    callback()

            , (callback) ->

                # 2. get munge-index from JavaScript online
                logger.info '[MungeDetector] Trying to use alternative internal munge data.'

                detectMungeIndex (err) ->

                    if not err?
                        callback 'done'
                        return

                    logger.warn '[MungeDetector] Failed.'
                    callback()
            
            , (callback) ->

                # 3. get munge data from IITC
                logger.info '[MungeDetector] Trying to parse newest IITC munge data.'

                getMungeIITC (err) ->

                    if not err?
                        callback 'done'
                        return

                    logger.warn '[MungeDetector] Failed.'
                    callback()

            , (callback) ->

                # N. fall to here: no useable munge-set
                callback 'fail'

        ], (err) ->

            if err is 'done'
                logger.info '[MungeDetector] Detect successfully.'
                callback && callback()
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

        for munge, index in MungeSet
            if NemesisMethodName.GET_GAME_SCORE is munge['dashboard.getGameScore']
                Munges.Data = MungeSet
                Munges.ActiveSet = index

                # TODO: write new munge-data to local

                callback()
                return

        callback 'fail'