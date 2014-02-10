(function() {
  var STATUS_COMPLETE, STATUS_FAIL, STATUS_PANIC, STATUS_PENDING, STATUS_REQUESTING, STATUS_TIMEOUT, Tile, async, bootstrap, checkTimeoutAndFailTiles, failTiles, panicTiles, processErrorTileResponse, processSuccessTileResponse, request, requestFactory, tileBucket, timeoutTiles;

  async = require('async');

  requestFactory = require('../lib/request.js');

  request = requestFactory();

  timeoutTiles = [];

  failTiles = [];

  panicTiles = [];

  STATUS_PENDING = 0;

  STATUS_REQUESTING = 1;

  STATUS_TIMEOUT = 2;

  STATUS_FAIL = 3;

  STATUS_PANIC = 4;

  STATUS_COMPLETE = 5;

  module.exports = {
    onBootstrap: function(callback) {
      if (argv.portals) {
        return bootstrap(function() {
          return callback('end');
        });
      } else {
        return callback();
      }
    }
  };

  bootstrap = function(callback) {
    if (argv["new"] || argv.n) {
      return Tile.prepareNew(function() {
        return Tile.start(callback);
      });
    } else {
      return Entity.requestMissingPortals(function() {
        return Tile.prepareFromDatabase(function() {
          return Tile.start(callback);
        });
      });
    }
  };

  tileBucket = async.cargo(function(tiles, callback) {
    var data, id, _i, _len;
    for (_i = 0, _len = tiles.length; _i < _len; _i++) {
      id = tiles[_i];
      Tile.data[id].status = STATUS_PENDING;
    }
    data = {
      quadKeys: tiles
    };
    return async.eachLimit(tiles, Config.Database.MaxParallel, function(id, callback) {
      return Database.db.collection('Tiles').update({
        _id: id
      }, {
        $set: {
          status: STATUS_PENDING,
          portals: 0
        }
      }, {
        upsert: true
      }, callback);
    }, function(err) {
      request.push({
        action: 'getThinnedEntities',
        data: data,
        onSuccess: function(response, callback) {
          return processSuccessTileResponse(response, tiles, callback);
        },
        onError: function(err, callback) {
          logger.error("[Portals] " + err.message);
          return processErrorTileResponse(tiles, callback);
        },
        afterResponse: function(callback) {
          return checkTimeoutAndFailTiles(function() {
            logger.info("[Portals] " + Math.round(request.done / request.max * 100).toString() + ("%\t[" + request.done + "/" + request.max + "]") + ("\t" + Entity.counter.portals + " portals, " + Entity.counter.links + " links, " + Entity.counter.fields + " fields"));
            return callback();
          });
        }
      });
      return callback();
    });
  }, Config.TileBucket.Max);

  Tile = {
    list: [],
    data: {},
    calculateTileKeys: function() {
      var bounds, ret, tileId, x, x1, x2, y, y1, y2, _i, _j;
      bounds = Utils.clampLatLngBounds(new L.LatLngBounds(new L.LatLng(Config.Region.SouthWest.Lat, Config.Region.SouthWest.Lng), new L.LatLng(Config.Region.NorthEast.Lat, Config.Region.NorthEast.Lng)));
      x1 = Utils.lngToTile(bounds.getWest(), Config.MinPortalLevel);
      x2 = Utils.lngToTile(bounds.getEast(), Config.MinPortalLevel);
      y1 = Utils.latToTile(bounds.getNorth(), Config.MinPortalLevel);
      y2 = Utils.latToTile(bounds.getSouth(), Config.MinPortalLevel);
      ret = [];
      for (y = _i = y1; y1 <= y2 ? _i <= y2 : _i >= y2; y = y1 <= y2 ? ++_i : --_i) {
        for (x = _j = x1; x1 <= x2 ? _j <= x2 : _j >= x2; x = x1 <= x2 ? ++_j : --_j) {
          tileId = Utils.pointToTileId(Config.MinPortalLevel, x, y);
          ret.push(tileId);
        }
      }
      return ret;
    },
    prepareFromDatabase: function(callback) {
      var completedTiles, tiles;
      logger.info("[Portals] Preparing from database: [" + Config.Region.SouthWest.Lat + "," + Config.Region.SouthWest.Lng + "]-[" + Config.Region.NorthEast.Lat + "," + Config.Region.NorthEast.Lng + "], MinPortalLevel=" + Config.MinPortalLevel);
      tiles = Tile.calculateTileKeys();
      completedTiles = {};
      logger.info("[Portals] Querying " + tiles.length + " tile status...");
      return async.eachLimit(tiles, Config.Database.MaxParallel, function(id, callback) {
        return Database.db.collection('Tiles').findOne({
          _id: id,
          status: STATUS_COMPLETE
        }, function(err, tile) {
          if (tile != null) {
            completedTiles[id] = true;
          }
          return callback(err);
        });
      }, function(err) {
        var id, _i, _len;
        for (_i = 0, _len = tiles.length; _i < _len; _i++) {
          id = tiles[_i];
          if (completedTiles[id] == null) {
            Tile.list.push(id);
          }
        }
        return Tile.prepareTiles(callback);
      });
    },
    prepareNew: function(callback) {
      var id, tiles, _i, _len;
      logger.info("[Portals] Preparing new: [" + Config.Region.SouthWest.Lat + "," + Config.Region.SouthWest.Lng + "]-[" + Config.Region.NorthEast.Lat + "," + Config.Region.NorthEast.Lng + "], MinPortalLevel=" + Config.MinPortalLevel);
      tiles = Tile.calculateTileKeys();
      for (_i = 0, _len = tiles.length; _i < _len; _i++) {
        id = tiles[_i];
        Tile.list.push(id);
      }
      return Tile.prepareTiles(callback);
    },
    prepareTiles: function(callback) {
      logger.info("[Portals] Prepared " + Tile.list.length + " tiles");
      return Database.db.collection('Tiles').ensureIndex({
        status: 1
      }, function() {
        var id, _i, _len, _ref;
        _ref = Tile.list;
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          id = _ref[_i];
          Tile.data[id] = {
            status: STATUS_PENDING,
            fails: 0,
            errors: 0,
            portals: 0
          };
        }
        return callback && callback();
      });
    },
    start: function(callback) {
      var id, _i, _len, _ref;
      if (Tile.list.length === 0) {
        logger.info("[Portals] Nothing to request");
        return callback();
      }
      logger.info("[Portals] Begin requesting...");
      _ref = Tile.list;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        id = _ref[_i];
        tileBucket.push(id);
      }
      return request.queue.drain = callback;
    }
  };

  processSuccessTileResponse = function(response, tiles, callback) {
    var id, list, tileValue, _ref, _ref1;
    if (((_ref = response.result) != null ? _ref.map : void 0) == null) {
      return processErrorTileResponse(tiles, callback);
    }
    list = [];
    _ref1 = response.result.map;
    for (id in _ref1) {
      tileValue = _ref1[id];
      list.push({
        id: id,
        tile: tileValue
      });
    }
    return async.eachLimit(list, Config.Database.MaxParallel, function(t, callback) {
      var tile, update;
      id = t.id;
      tile = t.tile;
      update = function() {
        var updater;
        updater = {
          $set: {
            status: Tile.data[id].status,
            portals: Tile.data[id].portals
          }
        };
        return Database.db.collection('Tiles').update({
          _id: id
        }, updater, callback);
      };
      if ((tile.error != null) && Tile.data[id].status === STATUS_PENDING) {
        if (tile.error === 'TIMEOUT') {
          Tile.data[id].status = STATUS_TIMEOUT;
          timeoutTiles.push(id);
        } else {
          Tile.data[id].status = STATUS_FAIL;
          Tile.data[id].fails++;
          if (Tile.data[id].fails > Config.Tiles.MaxFailRetry) {
            logger.error("PANIC: tile id=" + id);
            Tile.data[id].status = STATUS_PANIC;
            panicTiles.push(id);
          } else {
            failTiles.push(id);
          }
        }
        return update();
      } else {
        Tile.data[id].status = STATUS_COMPLETE;
        Tile.data[id].portals = 0;
        if (tile.gameEntities != null) {
          return async.each(tile.gameEntities, function(entity, callback) {
            if (tile.deletedGameEntityGuids.indexOf(entity[0] === -1)) {
              return Entity.add(entity[0], entity[1], entity[2], function(type) {
                if (type === 'portal') {
                  Tile.data[id].portals++;
                }
                return callback();
              });
            } else {
              return callback();
            }
          }, function(err) {
            return update();
          });
        } else {
          return update();
        }
      }
    }, callback);
  };

  processErrorTileResponse = function(tiles, callback) {
    var id, _i, _len;
    for (_i = 0, _len = tiles.length; _i < _len; _i++) {
      id = tiles[_i];
      if (Tile.data[id].status === STATUS_PENDING) {
        Tile.data[id].status = STATUS_FAIL;
        Tile.data[id].errors++;
        if (Tile.data[id].errors > Config.Tile.MaxErrorRetry) {
          logger.error("PANIC: tile id=" + id);
          Tile.data[id].status = STATUS_PANIC;
          panicTiles.push(id);
        } else {
          failTiles.push(id);
        }
      }
    }
    return async.eachLimit(tiles, Config.Database.MaxParallel, function(id, callback) {
      return Database.db.collection('Tiles').update({
        _id: id
      }, {
        $set: {
          status: Tile.data[id].status
        }
      }, callback);
    }, callback);
  };

  checkTimeoutAndFailTiles = function(callback) {
    var id, _i, _j, _len, _len1;
    for (_i = 0, _len = timeoutTiles.length; _i < _len; _i++) {
      id = timeoutTiles[_i];
      tileBucket.push(id);
    }
    for (_j = 0, _len1 = failTiles.length; _j < _len1; _j++) {
      id = failTiles[_j];
      tileBucket.push(id);
    }
    timeoutTiles = [];
    failTiles = [];
    return callback();
  };

}).call(this);
