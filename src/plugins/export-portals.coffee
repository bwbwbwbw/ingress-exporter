fs = require 'fs'

module.exports = 

    onBootstrap: (callback) ->

        if argv.export
            bootstrap ->
                callback 'end'
        else
            callback()

bootstrap = (callback) ->

    fs.open './export.csv', 'w', (err, fd) ->

        if err
            logger.error '[Export] %s', err.message
            return callback()

        count = 0

        cursor = Database.db.collection('Portals').find().toArray (err, portals) ->

            for po in portals

                count++
                line = []
                line.push po.title.replace(/,/g, '-').trim() if argv.title or argv.t
                line.push po.latE6 / 1e6 if argv.latlng or argv.l
                line.push po.lngE6 / 1e6 if argv.latlng or argv.l
                line.push po._id if argv.id or argv.i
                line.push po.image if argv.image or argv.I

                fs.writeSync fd, line.join(',') + '\n'

            fs.closeSync fd
            
            logger.info '[Export] Exported %d portals.', count
            callback()