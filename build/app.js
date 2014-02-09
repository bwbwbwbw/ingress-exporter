(function() {
  var async, bootstrap, exitProcess, logger, noop, plugin, pluginList, plugins, pname, stop;

  logger = GLOBAL.logger = require('winston');

  logger.exitOnError = false;

  logger.remove(logger.transports.Console);

  logger.add(logger.transports.Console, {
    colorize: true,
    timestamp: true
  });

  logger.add(logger.transports.File, {
    filename: 'ingress-exporter.log'
  });

  noop = GLOBAL.noop = function() {
    return null;
  };

  exitProcess = GLOBAL.exitProcess = function() {
    logger.info('[DONE]');
    return process.exit(0);
  };

  require('./config.js');

  require('./lib/taskmanager.js');

  require('./lib/leaflet.js');

  require('./lib/utils.js');

  require('./lib/database.js');

  require('./lib/request.js');

  require('./lib/agent.js');

  require('./lib/tile.js');

  require('./lib/entity.js');

  require('./lib/chat.js');

  require('./lib/mungedetector.js');

  GLOBAL.argv = require('optimist').argv;

  async = require('async');

  plugins = require('require-all')({
    dirname: __dirname + '/plugins',
    filter: /(.+)\.js$/
  });

  stop = function() {
    return TaskManager.end('AppMain.callback');
  };

  bootstrap = function() {
    TaskManager.begin();
    return async.series([
      function(callback) {
        return MungeDetector.detect(callback);
      }, function(callback) {
        return Agent.initFromDatabase(callback);
      }
    ], function() {
      return async.each(pluginList, function(plugin, callback) {
        if (plugin.onBootstrap) {
          return plugin.onBootstrap(callback);
        } else {
          return callback();
        }
      }, function(err) {
        if (err) {
          stop(err);
          return;
        }
        return async.series([
          function(callback) {
            if (argv.portals) {
              return Entity.requestMissingPortals(callback);
            } else {
              return callback();
            }
          }, function(callback) {
            if (argv["new"] || argv.n) {
              if (argv.portals) {
                Tile.prepareNew(Tile.start);
              }
              if (argv.broadcasts) {
                Chat.prepareNew(Chat.start);
              }
            } else {
              if (argv.portals) {
                Tile.prepareFromDatabase(Tile.start);
              }
              if (argv.broadcasts) {
                Chat.prepareFromDatabase(Chat.start);
              }
            }
            return callback();
          }
        ], function() {
          return stop();
        });
      });
    });
  };

  pluginList = [];

  for (pname in plugins) {
    plugin = plugins[pname];
    pluginList.push(plugin);
  }

  async.each(pluginList, function(plugin, callback) {
    if (plugin.onInitialize) {
      return plugin.onInitialize(callback);
    } else {
      return callback();
    }
  }, function() {
    return bootstrap();
  });

}).call(this);
