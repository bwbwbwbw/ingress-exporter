needle = require 'needle'

# Request pools
pool = []

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

        pool.push
            m:       methodName,
            d:       post_data,
            success: options.onSuccess,
            error:   options.onError,
            request: options.beforeRequest,
            response:options.afterResponse

        Request.maxRequest++

        if Request.activeRequests < Config.Request.MaxParallel
            sendRequest()

Request.pool = pool
Request.maxRequest = 0
Request.requested = 0
Request.activeRequests = 0

sendRequest = ->

    return if pool.length is 0

    v = pool.shift()
    Request.activeRequests++

    needle.post 'http://www.ingress.com/r/' + v.m, JSON.stringify(v.d),
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

        if v.emitted?
            console.log 'ignore re-emitted event', error, body
            return

        v.emitted = true

        Request.activeRequests--
        Request.requested++

        if error
            v.error && v.error error
            v.response && v.response error
            return

        # not authorized
        if body is 'User not authenticated'
            logger.error '[Auth] Authorize failed. Please update the cookie.'
            process.exit 0
            return
        
        v.success && v.success body
        v.response && v.response null

        # next request
        sendRequest() for i in [1..Math.min(pool.length, Config.Request.MaxParallel - Request.activeRequests)]
