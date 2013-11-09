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
require './munges.js'

require './lib/leaflet.js'
require './lib/utils.js'
require './lib/database.js'
require './lib/request.js'
require './lib/tile.js'
require './lib/entity.js'
require './lib/chat.js'
require './lib/mungedetector.js'

#######################
# bootstrap
argv = require('optimist').argv

MungeDetector.detect ->

    if argv.new or argv.n
        Tile.prepareNew Tile.start if argv.portals
        Chat.PrepareNew Chat.start if argv.broadcasts
    else
        Tile.prepareFromDatabase Tile.start if argv.portals
        Chat.prepareFromDatabase Chat.start if argv.broadcasts
