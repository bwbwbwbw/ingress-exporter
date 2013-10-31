#######################
# initialize logger
logger = GLOBAL.logger = require 'winston'
logger.exitOnError = false
logger.remove logger.transports.Console
logger.add logger.transports.Console,
    colorize:   true
    timestamp:  true
logger.add logger.transports.File,
    filename:   'ingress-exporter.log'

#######################

noop = GLOBAL.noop = ->
    null

exitProcess = GLOBAL.exitProcess = ->
    logger.info '[DONE]'
    process.exit 0

#######################

require './config.js'

require './lib/leaflet.js'
require './lib/utils.js'
require './lib/database.js'
require './lib/request.js'
require './lib/tile.js'
require './lib/entity.js'

#######################
# bootstrap
argv = require('optimist').argv

if argv.new or argv.n
    Tile.prepareNew Tile.start if argv.portals
else
    Tile.prepareFromDatabase Tile.start if argv.portals