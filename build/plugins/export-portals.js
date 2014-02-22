(function() {
  var bootstrap, fs;

  fs = require('fs');

  module.exports = {
    onBootstrap: function(callback) {
      if (argv["export"]) {
        return bootstrap(function() {
          return callback('end');
        });
      } else {
        return callback();
      }
    }
  };

  bootstrap = function(callback) {
    return fs.open('./export.csv', 'w', function(err, fd) {
      var count, cursor;
      if (err) {
        logger.error('[Export] %s', err.message);
        return callback();
      }
      count = 0;
      return cursor = Database.db.collection('Portals').find().toArray(function(err, portals) {
        var line, po, _i, _len;
        for (_i = 0, _len = portals.length; _i < _len; _i++) {
          po = portals[_i];
          count++;
          line = [];
          if (argv.title || argv.t) {
            line.push(po.title.replace(/,/g, '-').trim());
          }
          if (argv.latlng || argv.l) {
            line.push(po.latE6 / 1e6);
          }
          if (argv.latlng || argv.l) {
            line.push(po.lngE6 / 1e6);
          }
          if (argv.id || argv.i) {
            line.push(po._id);
          }
          if (argv.image || argv.I) {
            line.push(po.image);
          }
          fs.writeSync(fd, line.join(',') + '\n');
        }
        fs.closeSync(fd);
        logger.info('[Export] Exported %d portals.', count);
        return callback();
      });
    });
  };

}).call(this);
