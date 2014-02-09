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

GLOBAL.argv = require('optimist').argv
async = require('async')

plugins = require('require-all')(
    dirname: __dirname + '/plugins'
    filter : /(.+)\.js$/,
)

#######################
# bootstrap

stop = ->

    TaskManager.end 'AppMain.callback'

bootstrap = ->

    TaskManager.begin()

    async.series [

        (callback) ->

            MungeDetector.detect callback

        , (callback) ->

            Agent.initFromDatabase callback

    ], ->

        async.each pluginList, (plugin, callback) ->
            if plugin.onBootstrap
                plugin.onBootstrap callback
            else
                callback()
        , (err) ->
            
            if err
                stop err
                return

            async.series [

                (callback) ->

                    if argv.portals
                        Entity.requestMissingPortals callback
                    else
                        callback()

                , (callback) ->

                    if argv.new or argv.n
                        if argv.portals
                            Tile.prepareNew Tile.start
                        if argv.broadcasts
                            Chat.prepareNew Chat.start
                    else
                        if argv.portals
                            Tile.prepareFromDatabase Tile.start
                        if argv.broadcasts
                            Chat.prepareFromDatabase Chat.start

                    callback()

            ], ->

                stop()

#######################
# main

pluginList = []
pluginList.push plugin for pname, plugin of plugins

async.each pluginList, (plugin, callback) ->
    if plugin.onInitialize
        plugin.onInitialize callback
    else
        callback()
, ->
    bootstrap()
