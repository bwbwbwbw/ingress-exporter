needle = require 'needle'
async = require 'async'

# Parse cookie
cookies = {}

for v in Config.Auth.CookieRaw.split(';')
    C = v.trim().split '='
    cookies[C[0]] = unescape C[1]

Request = GLOBAL.Request = 
    
    add: (options) ->

        activeMunge = Config.Munges.Data[Config.Munges.ActiveSet]

        methodName = 'dashboard.' + options.action
        versionStr = 'version_parameter'

        methodName = activeMunge[methodName]
        versionStr = activeMunge[versionStr]

        post_data = Utils.requestDataMunge Utils.extend({method: methodName, version: versionStr}, options.data)

        delayObject =
            schedule: noop

        Request.queue.push
            m:        methodName
            d:        post_data
            success:  options.onSuccess
            error:    options.onError
            request:  options.beforeRequest
            response: options.afterResponse
            delayobj: delayObject

        Request.maxRequest++

        return delayObject

Request.queue = async.queue (task, callback) ->

    Request.activeRequests++

    func = ->

        needle.post 'http://www.ingress.com/r/' + task.m, JSON.stringify(task.d),
            
            compressed: true
            headers:
                # user-agent is essential for GZIP response here
                'Accept': 'application/json, text/javascript, */*; q=0.01'
                'Content-type': 'application/json; charset=utf-8'
                'Cookie': Config.Auth.CookieRaw
                'Host': 'www.ingress.com'
                'Origin': 'http://www.ingress.com'
                'Referer': 'http://www.ingress.com/intel'
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_8_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/30.0.1599.101 Safari/537.36'
                'X-CSRFToken': cookies.csrftoken

        , (error, response, body) ->

            if task.emitted?
                console.warn '[DEBUG] Ignored reemitted event'
                return

            task.emitted = true

            Request.activeRequests--
            Request.requested++

            if error
                task.error && task.error error
                task.response && task.response error
                callback()
                return

            if typeof body is 'string'

                if body.indexOf 'CSRF verification failed. Request aborted.' > -1
                    logger.error '[Auth] CSRF verification failed. Please make sure that the cookie is right.'
                    process.exit 0
                    return

                if body.indexOf 'User not authenticated' > -1
                    logger.error '[Auth] Authentication failed. Please update the cookie.'
                    process.exit 0
                    return

                logger.error '[DEBUG] Unknown server response'
                callback()
                return
            
            task.success && task.success body
            task.response && task.response null

            callback()

    if task.delayobj.schedule is null   # finished before here
        func()
    else
        task.delayobj.schedule = func   # task not finished: wait until callback

, Config.Request.MaxParallel

# all requests have done
Request.queue.drain = ->
    logger.info '[DONE]'
    process.exit 0

Request.maxRequest = 0
Request.requested = 0
Request.activeRequests = 0