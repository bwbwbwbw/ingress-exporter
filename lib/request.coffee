r = require 'request'
zlib = require 'zlib'
jar = r.jar()
req = r.defaults jar:jar

# Request pools
pool = []
reqCount = 0

# Parse cookie
cookies = {}

for v in Config.Auth.CookieRaw.split(';')

    v = v.trim()

    C = v.split '='
    cookies[C[0]] = unescape C[1]
    jar.add r.cookie(v)

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

        if reqCount < Config.Request.MaxParallel
            sendRequest()

Request.pool = pool
Request.maxRequest = 0
Request.requested = 0

sendRequest = ->

    return if pool.length is 0

    v = pool.shift()
    reqCount++

    buffer = []
    bodyLen = 0

    v.request || v.request()

    req
        url:      'http://www.ingress.com/r/' + v.m
        method:   'POST'
        body:     JSON.stringify v.d
        encoding: null
        headers:
            # user-agent is essential for GZIP response here
            'Accept': 'application/json, text/javascript, */*; q=0.01'
            'Accept-Encoding': 'gzip,deflate'
            'Accept-Language': 'zh-CN,zh;q=0.8'
            'Content-type': 'application/json; charset=utf-8'
            'Host': 'www.ingress.com'
            'Origin': 'http://www.ingress.com'
            'Referer': 'http://www.ingress.com/intel'
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_8_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/30.0.1599.101 Safari/537.36'
            'X-CSRFToken': cookies.csrftoken
    .on 'error', (err) ->
        # may produce multiple errors here
        return if v.errorEmited?

        reqCount--
        Request.requested++
        v.errorEmited = true
        v.error && v.error err
        v.response && v.response err
    .pipe zlib.createGunzip()
    .on 'error', (err) ->
        return if v.errorEmited?

        reqCount--
        Request.requested++
        v.errorEmited = true
        v.error && v.error err
        v.response && v.response err
    .on 'data', (chunk) ->
        buffer.push chunk
        bodyLen += chunk.length
    .on 'end', ->

        reqCount--
        Request.requested++

        body = new Buffer bodyLen
        i = 0
        for chunk in buffer
            chunk.copy body, i, 0, chunk.length
            i += chunk.length

        body = body.toString()

        # not authorized
        if body is 'User not authenticated'
            consoler.error '[Auth] Authorize failed. Please update the cookie.'
            process.exit 0
            return

        try
            body = JSON.parse body
        catch err
            return if v.errorEmited?
            v.errorEmited = true
            v.error && v.error err
            v.response && v.response err
            return

        v.success && v.success body
        v.response && v.response null

        # next request
        sendRequest() for i in [1..Math.min(pool.length, Config.Request.MaxParallel - reqCount)]
