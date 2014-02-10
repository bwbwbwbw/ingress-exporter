needle = require 'needle'
async = require 'async'

# Parse cookie
cookies = {}

for v in Config.Auth.CookieRaw.split(';')
    C = v.trim().split '='
    cookies[C[0]] = unescape C[1]

class RequestFactory

    constructor: ->

        @max   = 0
        @done  = 0
        @munge = null

        @queue = async.queue (task, callback) =>

            @post '/r/' + task.m, task.d, (error, response, body) =>

                if error
                    console.log error.stack

                if task.emitted?
                    console.warn '[DEBUG] Ignored reemitted event'
                    return

                task.emitted = true

                @done++

                if error or not @processResponse error, response, body

                    task.error error, ->
                        task.response ->
                            callback()

                    return

                task.success body, ->
                    task.response ->
                        callback()

        , Config.Request.MaxParallel

    generate: (options) ->

        if @munge is null
            activeMunge = Munges.Data[Munges.ActiveSet]
        else
            activeMunge = @munge

        methodName = 'dashboard.' + options.action
        versionStr = 'version_parameter'

        methodName = activeMunge[methodName]
        versionStr = activeMunge[versionStr]

        post_data = Utils.requestDataMunge Utils.extend({method: methodName, version: versionStr}, options.data), activeMunge

        # return:
        return {
            m:        methodName
            d:        post_data
            success:  options.onSuccess     || (body, callback) -> callback()
            error:    options.onError       || (error, callback) -> callback()
            response: options.afterResponse || (callback) -> callback()
        }

    push: (options) ->

        @max++
        task = @generate options
        @queue.push task
    
    unshift: (options) ->

        @max++
        task = @generate options
        @queue.unshift task

    post: (url, data, callback) ->

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

        , callback

    get: (url, callback) ->

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

        , callback

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

            logger.error '[DEBUG] Unknown server response'
            return false

        true

module.exports = ->

    return new RequestFactory()
