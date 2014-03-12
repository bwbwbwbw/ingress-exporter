async = require 'async'

class delayedQueue

    constructor: (worker, delay) ->

        @lastTS = null
        @worker = worker
        @delay = delay
        @queue = async.queue @_work, 1

    push: (task) =>

        @queue.push task

    _work: (task, callback) =>

        main = =>
            @worker task
            @lastTS = Date.now()
            callback()

        if @lastTS is null
            main()
        else
            TSnow = Date.now()
            if TSnow - @lastTS < @delay
                setTimeout main, @delay - (TSnow - @lastTS)
            else
                main()

module.exports = delayedQueue