(function() {
  var async, bootstrap, exitProcess, logger, noop, plugin, pluginList, plugins, pname;

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

  require('./lib/leaflet.js');

  require('./lib/utils.js');

  require('./lib/database.js');

  require('./lib/agent.js');

  require('./lib/entity.js');

  require('./lib/mungedetector.js');

  require('./lib/accountinfo.js');

  require('color');

  GLOBAL.argv = require('optimist').argv;

  async = require('async');

  plugins = require('require-all')({
    dirname: __dirname + '/plugins',
    filter: /(.+)\.js$/
  });

  bootstrap = function() {
    return async.series([
      function(callback) {
        return AccountInfo.fetch(callback);
      }, function(callback) {
        return MungeDetector.detect(callback);
      }, function(callback) {
        return Agent.initFromDatabase(callback);
      }
    ], function() {
      return async.eachSeries(pluginList, function(plugin, callback) {
        if (plugin.onBootstrap) {
          return plugin.onBootstrap(callback);
        } else {
          return callback();
        }
      }, function(err) {
        return Database.db.close();
      });
    });
  };

  pluginList = [];

  for (pname in plugins) {
    plugin = plugins[pname];
    pluginList.push(plugin);
  }

  pluginList.push({
    onBootstrap: function(callback) {
      return callback('end');
    }
  });

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
