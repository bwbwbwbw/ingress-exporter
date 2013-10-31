(function() {
  var argv, exitProcess, logger, noop;

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

  require('./lib/request.js');

  require('./lib/tile.js');

  require('./lib/entity.js');

  argv = require('optimist').argv;

  if (argv["new"] || argv.n) {
    Tile.prepareNew(Tile.start);
  } else {
    Tile.prepareFromDatabase(Tile.start);
  }

}).call(this);
