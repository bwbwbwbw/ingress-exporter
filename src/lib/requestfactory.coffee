delayedQueue = require './delayedqueue.js'
zlib = require 'zlib'
async = require 'async'
request = require 'request'

delayedRequestQueue = new delayedQueue (task) ->

    task()

, Config.Request.MinIntervalMS

delayedRequest =
    
    post: (options, callback) ->

        delayedRequestQueue.push ->
            request.post options, callback

    get: (options, callback) ->

        delayedRequestQueue.push ->
            request.get options, callback

class RequestFactory

    constructor: ->

        @max        = 0
        @done       = 0
        
        @queue = async.queue (task, callback) =>

            task.before =>
                
                @post '/r/' + task.m, task.d, (error, response, body) =>

                    if error
                        console.log error.stack

                    if task.emitted?
                        console.warn '[DEBUG] Ignored reemitted event'
                        return

                    task.emitted = true

                    @done++

                    if not error
                        if body.error?
                            error = new Error(body.error)
                        else
                            error = @processResponse error, response, body

                    if error

                        task.error error, ->
                            task.response ->
                                callback()

                        return

                    task.success body, ->
                        task.response ->
                            callback()

        , Config.Request.MaxParallel

    generate: (options) =>

        activeMunge = Munges.Data[Munges.ActiveSet]
        normalizeFunc = Munges.NormalizeParamCount.func

        methodName = 'dashboard.' + options.action
        versionStr = 'version_parameter'

        methodName = activeMunge[methodName]
        versionStr = activeMunge[versionStr]

        post_data = Utils.requestDataMunge Utils.extend({method: methodName, version: versionStr}, options.data), activeMunge, normalizeFunc

        # return:
        return {
            m:        methodName
            d:        post_data
            before:   options.beforeRequest || (callback) -> callback()
            success:  options.onSuccess     || (body, callback) -> callback()
            error:    options.onError       || (error, callback) -> callback()
            response: options.afterResponse || (callback) -> callback()
        }

    push: (options) =>

        @max++
        task = @generate options
        @queue.push task
    
    unshift: (options) =>

        @max++
        task = @generate options
        @queue.unshift task

    post: (url, data, callback, session) =>

        session = entry.sessions[Math.floor(Math.random() * entry.sessions.length)] if not session?

        delayedRequest.post

            url:        'http://www.ingress.com' + url
            body:       JSON.stringify data
            jar:        session.jar
            maxSockets: 50
            encoding:   null
            timeout:    20000
            headers:
                'Accept': 'application/json, text/javascript, */*; q=0.01'
                'Accept-Encoding': 'gzip,deflate'
                'Content-type': 'application/json; charset=utf-8'
                'Origin': 'http://www.ingress.com'
                'Referer': 'http://www.ingress.com/intel'
                'User-Agent': Config.Request.UserAgent
                'X-CSRFToken': session.cookies.csrftoken

        , @_gzipDecode @_jsonDecode callback

    get: (url, callback, session) =>

        session = entry.sessions[Math.floor(Math.random() * entry.sessions.length)] if not session?

        delayedRequest.get

            url:        'http://www.ingress.com' + url
            jar:        session.jar
            maxSockets: 50
            encoding:   null
            timeout:    20000
            headers:
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
                'Accept-Encoding': 'gzip,deflate'
                'Cache-Control': 'max-age=0'
                'Origin': 'http://www.ingress.com'
                'Referer': 'http://www.ingress.com/intel'
                'User-Agent': Config.Request.UserAgent

        , @_gzipDecode callback

    processResponse: (error, response, body) ->

        if typeof body is 'string'

            if body.indexOf('CSRF verification failed. Request aborted.') > -1
                logger.error '[Auth] CSRF verification failed. Please make sure that the cookie is right.'
                process.exit 0
                return false

            if body.indexOf('User not authenticated') > -1
                logger.error '[Auth] Authentication failed. Please update the cookie.'
                process.exit 0
                return false

            if body.indexOf('but your computer or network may be sending automated queries') > -1
                return new Error 'request rejected'

            if body.trim().length is 0
                return new Error 'Empty server response'

            return new Error 'unknown server response'

        return null

    _gzipDecode: (callback) ->

        return (error, response, buffer) ->

            if error?
                callback error, response
                return

            if response.headers['content-encoding']?

                encoding = response.headers['content-encoding']

                if encoding is 'gzip'

                    zlib.gunzip buffer, (err, body) ->
                        callback err, response, body && body.toString()
                    return

                else if encoding is 'deflate'

                    zlib.inflate buffer, (err, body) ->
                        callback err, response, body && body.toString()
                    return

            callback error, response, buffer && buffer.toString()

    _jsonDecode: (callback) ->

        return (error, response, body) ->

            if error?
                callback error, response
                return

            if response.headers['content-type']?

                if response.headers['content-type'].indexOf('json') > -1

                    try
                        decoded = JSON.parse body
                    catch err
                        callback err, response, body
                        return

                    callback err, response, decoded
                    return

            callback error, response, body


entry = ->

    return new RequestFactory()

entry.sessions = []

if argv.cookie?
    cookieRaw = argv.cookie
else
    cookieRaw = Config.Auth.CookieRaw

# turn into an array
cookieRaw = [cookieRaw] if typeof cookieRaw is 'string'

for cookies, index in cookieRaw

    map = {}
    jar = request.jar()

    for cookie in cookies.split(';')
        
        cookie = cookie.trim()
        continue if cookie.length is 0

        jar.setCookie request.cookie(cookie), 'http://www.ingress.com' if cookie.length isnt 0

        pair = cookie.split '='
        map[pair[0]] = unescape pair[1]

    entry.sessions.push
        index:   index
        cookies: map
        jar:     jar

module.exports = entry