needle = require 'needle'
async = require 'async'

# Parse cookie
cookies = {}

for v in Config.Auth.CookieRaw.split(';')
    C = v.trim().split '='
    cookies[C[0]] = unescape C[1]

Request = GLOBAL.Request = 
    
    generate: (options) ->

        activeMunge = if options.munge? then options.munge else Munges.Data[Munges.ActiveSet]

        methodName = 'dashboard.' + options.action
        versionStr = 'version_parameter'

        methodName = activeMunge[methodName]
        versionStr = activeMunge[versionStr]

        post_data = Utils.requestDataMunge Utils.extend({method: methodName, version: versionStr}, options.data), activeMunge

        # return:
        return {
            m:        methodName
            d:        post_data
            success:  options.onSuccess
            error:    options.onError
            request:  options.beforeRequest
            response: options.afterResponse
        }

    add: (options) ->

        task = Request.generate options

        Request.queue.push task
        Request.maxRequest++

    post: (url, data, callback) ->

        TaskManager.begin()

        needle.post 'http://www.ingress.com' + url, JSON.stringify(data),

            compressed: true
            timeout:    20000
            headers:
                'Accept': 'application/json, text/javascript, */*; q=0.01'
                'Content-type': 'application/json; charset=utf-8'
                'Cookie': Config.Auth.CookieRaw
                'Host': 'www.ingress.com'
                'Origin': 'http://www.ingress.com'
                'Referer': 'http://www.ingress.com/intel'
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_8_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/30.0.1599.101 Safari/537.36'
                'X-CSRFToken': cookies.csrftoken

        , ->

            callback.apply this, arguments
            TaskManager.end 'Request.post (url='+url+')'

    get: (url, callback) ->

        TaskManager.begin()

        needle.get 'http://www.ingress.com' + url, 

            compressed: true
            timeout:    20000
            headers:
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
                'Cookie': Config.Auth.CookieRaw
                'Host': 'www.ingress.com'
                'Cache-Control': 'max-age=0'
                'Origin': 'http://www.ingress.com'
                'Referer': 'http://www.ingress.com/intel'
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_8_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/30.0.1599.101 Safari/537.36'

        , ->

            callback.apply this, arguments
            TaskManager.end 'Request.get'

    processResponse: (error, response, body) ->

        if typeof body is 'string'

            if body.indexOf 'CSRF verification failed. Request aborted.' > -1
                logger.error '[Auth] CSRF verification failed. Please make sure that the cookie is right.'
                process.exit 0
                return false

            if body.indexOf 'User not authenticated' > -1
                logger.error '[Auth] Authentication failed. Please update the cookie.'
                process.exit 0
                return false

            return false

        true

Request.queue = async.queue (task, callback) ->

    TaskManager.begin()

    Request.activeRequests++
    Request.post '/r/' + task.m, task.d, (error, response, body) ->

        if task.emitted?
            console.warn '[DEBUG] Ignored reemitted event'
            return

        task.emitted = true

        Request.activeRequests--
        Request.requested++

        if error
            console.log error.stack
            task.error && task.error error
            task.response && task.response error

            callback()
            TaskManager.end 'Request.queue.postCallback'
            return

        if not Request.processResponse error, response, body
            logger.error '[DEBUG] Unknown server response'

            callback()
            TaskManager.end 'Request.queue.postCallback'
            return
        
        task.success && task.success body
        task.response && task.response null

        callback()
        TaskManager.end 'Request.queue.postCallback'

, Config.Request.MaxParallel

Request.maxRequest = 0
Request.requested = 0
Request.activeRequests = 0