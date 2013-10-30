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

#######################

require './config.coffee'

require './lib/leaflet.js'
require './lib/utils.js'
require './lib/database.coffee'
require './lib/request.coffee'
require './lib/tile.coffee'
require './lib/entity.coffee'

#######################
# bootstrap
argv = require('optimist').argv

if argv.new or argv.n
    Tile.prepareNew Tile.start
else
    Tile.prepareFromDatabase Tile.start