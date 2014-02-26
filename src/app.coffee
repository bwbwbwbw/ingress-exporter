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

require './config.js'

require './lib/leaflet.js'
require './lib/utils.js'
require './lib/database.js'
require './lib/agent.js'
require './lib/entity.js'
require './lib/mungedetector.js'
require './lib/accountinfo.js'

require 'color'

GLOBAL.argv = require('optimist').argv
async = require('async')

plugins = require('require-all')(
    dirname: __dirname + '/plugins'
    filter : /(.+)\.js$/,
)

#######################
# bootstrap

bootstrap = ->

    async.series [

        (callback) ->

            MungeDetector.detect callback

        , (callback) ->

            AccountInfo.fetch callback

        , (callback) ->

            Agent.initFromDatabase callback

    ], (err) ->

        if not err

            async.eachSeries pluginList, (plugin, callback) ->
                
                if plugin.onBootstrap
                    plugin.onBootstrap callback
                else
                    callback()

            , (err) ->
                
                Database.db.close()

#######################
# main

pluginList = []
pluginList.push plugin for pname, plugin of plugins

# the terminate plugin
pluginList.push
    onBootstrap: (callback) ->
        callback 'end'

async.each pluginList, (plugin, callback) ->
    if plugin.onInitialize
        plugin.onInitialize callback
    else
        callback()
, ->
    bootstrap()
