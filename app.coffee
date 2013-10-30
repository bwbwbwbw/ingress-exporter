GLOBAL.consoler = require('consoler')
GLOBAL.argv = require('optimist').argv
GLOBAL.noop = ->
    null
#process.on 'uncaughtException', (err) ->
#    consoler.error err

require 'colors'

require './config.coffee'

require './lib/leaflet.js'
require './lib/utils.js'
require './lib/database.coffee'
require './lib/request.coffee'
require './lib/tile.coffee'
require './lib/entity.coffee'

if argv.new or argv.n
    Tile.prepareNew Tile.start
else
    Tile.prepareFromDatabase Tile.start