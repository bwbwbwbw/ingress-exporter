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

require './lib/taskmanager.js'
require './lib/leaflet.js'
require './lib/utils.js'
require './lib/database.js'
require './lib/request.js'
require './lib/agent.js'
require './lib/tile.js'
require './lib/entity.js'
require './lib/chat.js'
require './lib/mungedetector.js'

#######################
# bootstrap
argv = require('optimist').argv

taskCount = 0

TaskManager.begin()

MungeDetector.detect ->

    Agent.initFromDatabase ->

        if argv.new or argv.n
            if argv.portals
                Tile.prepareNew Tile.start
                taskCount++
            if argv.broadcasts
                Chat.prepareNew Chat.start
                taskCount++
        else
            if argv.portals
                Tile.prepareFromDatabase Tile.start
                taskCount++
            if argv.broadcasts
                Chat.prepareFromDatabase Chat.start
                taskCount++

        TaskManager.end 'AppMain.callback'

    #process.exit 0 if taskCount is 0