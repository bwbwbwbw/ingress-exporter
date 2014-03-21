fs = require 'fs'

module.exports = 

    onBootstrap: (callback) ->

        if argv.export
            bootstrap ->
                callback 'end'
        else
            callback()

bootstrap = (callback) ->

    cursor = Database.db.collection('Portals').find().toArray (err, portals) ->

        if err
            logger.error '[Export] %s', err.message
            return callback()

        for po in portals

            line = []
            line.push po.title.replace(/,/g, '-').trim() if argv.title or argv.t
            line.push po.latE6 / 1e6 if argv.latlng or argv.l
            line.push po.lngE6 / 1e6 if argv.latlng or argv.l
            line.push po.image if argv.image or argv.I
            line.push po._id if argv.id or argv.i

            console.log line.join(',')

        callback()