(function() {
  var STATUS_COMPLETE, STATUS_FAIL, STATUS_PANIC, STATUS_PENDING, STATUS_REQUESTING, STATUS_TIMEOUT, Tile, TileBucket, async, checkTimeoutAndFailTiles, failTiles, panicTiles, processErrorTileResponse, processSuccessTileResponse, timeoutTiles;

  async = require('async');

  timeoutTiles = [];

  failTiles = [];

  panicTiles = [];

  STATUS_PENDING = 0;

  STATUS_REQUESTING = 1;

  STATUS_TIMEOUT = 2;

  STATUS_FAIL = 3;

  STATUS_PANIC = 4;

  STATUS_COMPLETE = 5;

  TileBucket = GLOBAL.TileBucket = {
    bucket: [],
    requestCount: 0,
    enqueue: function(tileId, callback) {
      if (tileId != null) {
        TileBucket.bucket.push(tileId);
      }
      if (TileBucket.bucket.length >= Config.TileBucket.Max || (tileId == null)) {
        TileBucket.request(TileBucket.bucket, callback);
        return TileBucket.bucket = [];
      } else {
        return callback && callback();
      }
    },
    request: function(tileIds, callback) {
      var data, delayObject, requestId, tileId, tileList, _i, _len;
      tileList = [];
      for (_i = 0, _len = tileIds.length; _i < _len; _i++) {
        tileId = tileIds[_i];
        if (Tile.data[tileId].status !== STATUS_COMPLETE) {
          tileList.push(Tile.bounds[tileId].id);
          Tile.data[tileId].status = STATUS_PENDING;
        }
      }
      if (tileList.length === 0) {
        return;
      }
      TileBucket.requestCount++;
      requestId = TileBucket.requestCount;
      data = {
        quadKeys: tileList
      };
      delayObject = Request.add({
        action: 'getThinnedEntitiesV4',
        data: data,
        onSuccess: function(response) {
          return processSuccessTileResponse(response, tileIds);
        },
        onError: function(err) {
          logger.error("[Portals] " + err);
          return processErrorTileResponse(tileIds, noop);
        },
        afterResponse: function() {
          checkTimeoutAndFailTiles();
          return logger.info("[Portals] " + Math.round(Request.requested / Request.maxRequest * 100).toString() + ("%\t[" + Request.requested + "/" + Request.maxRequest + "]") + ("\t" + Entity.counter.portals + " portals, " + Entity.counter.links + " links, " + Entity.counter.fields + " fields"));
        },
        beforeRequest: function() {
          return null;
        }
      });
      return async.eachLimit(tileList, Config.Database.MaxParallel, function(tileId, callback) {
        return Database.db.collection('Tiles').update({
          _id: tileId
        }, {
          $set: {
            status: STATUS_PENDING
          }
        }, {
          upsert: true
        }, callback);
      }, function(err) {
        delayObject.schedule();
        delayObject.schedule = null;
        return callback && callback();
      });
    }
  };

  Tile = GLOBAL.Tile = {
    length: 0,
    bounds: {},
    data: {},
    calculateBounds: function() {
      var bounds, tileBounds, tileId, x, x1, x2, y, y1, y2, _i, _j;
      bounds = Utils.clampLatLngBounds(new L.LatLngBounds(new L.LatLng(Config.Region.SouthWest.Lat, Config.Region.SouthWest.Lng), new L.LatLng(Config.Region.NorthEast.Lat, Config.Region.NorthEast.Lng)));
      x1 = Utils.lngToTile(bounds.getWest(), Config.MinPortalLevel);
      x2 = Utils.lngToTile(bounds.getEast(), Config.MinPortalLevel);
      y1 = Utils.latToTile(bounds.getNorth(), Config.MinPortalLevel);
      y2 = Utils.latToTile(bounds.getSouth(), Config.MinPortalLevel);
      tileBounds = [];
      for (y = _i = y1; y1 <= y2 ? _i <= y2 : _i >= y2; y = y1 <= y2 ? ++_i : --_i) {
        for (x = _j = x1; x1 <= x2 ? _j <= x2 : _j >= x2; x = x1 <= x2 ? ++_j : --_j) {
          tileId = Utils.pointToTileId(Config.MinPortalLevel, x, y);
          tileBounds.push({
            id: tileId
          });
        }
      }
      return tileBounds;
    },
    prepareFromDatabase: function(callback) {
      var completedBounds, tileBounds;
      logger.info("[Portals] Preparing from database: [" + Config.Region.SouthWest.Lat + "," + Config.Region.SouthWest.Lng + "]-[" + Config.Region.NorthEast.Lat + "," + Config.Region.NorthEast.Lng + "], MinPortalLevel=" + Config.MinPortalLevel);
      tileBounds = Tile.calculateBounds();
      completedBounds = {};
      logger.info("[Portals] Querying " + tileBounds.length + " tile status...");
      return async.eachLimit(tileBounds, Config.Database.MaxParallel, function(bound, callback) {
        return Database.db.collection('Tiles').findOne({
          _id: bound.id,
          status: STATUS_COMPLETE
        }, function(err, tile) {
          if (tile != null) {
            completedBounds[tile._id] = true;
          }
          return callback(err);
        });
      }, function(err) {
        var bounds, _i, _len;
        for (_i = 0, _len = tileBounds.length; _i < _len; _i++) {
          bounds = tileBounds[_i];
          if (completedBounds[bounds.id] == null) {
            Tile.length++;
            Tile.bounds[bounds.id] = bounds;
          }
        }
        return Tile._prepareTiles(callback);
      });
    },
    prepareNew: function(callback) {
      var bounds, tileBounds, _i, _len;
      logger.info("[Portals] Preparing new: [" + Config.Region.SouthWest.Lat + "," + Config.Region.SouthWest.Lng + "]-[" + Config.Region.NorthEast.Lat + "," + Config.Region.NorthEast.Lng + "], MinPortalLevel=" + Config.MinPortalLevel);
      tileBounds = Tile.calculateBounds();
      for (_i = 0, _len = tileBounds.length; _i < _len; _i++) {
        bounds = tileBounds[_i];
        Tile.length++;
        Tile.bounds[bounds.id] = bounds;
      }
      return Tile._prepareTiles(callback);
    },
    _prepareTiles: function(callback) {
      logger.info("[Portals] Prepared " + Tile.length + " tiles");
      return Database.db.collection('Tiles').ensureIndex([['status', 1]], false, function() {
        var bounds, tileId, _ref;
        _ref = Tile.bounds;
        for (tileId in _ref) {
          bounds = _ref[tileId];
          Tile.data[bounds.id] = {
            status: STATUS_PENDING,
            fails: 0,
            errors: 0
          };
        }
        return callback && callback();
      });
    },
    start: function() {
      var req, tileBounds, tileId, _ref;
      if (Tile.length === 0) {
        logger.info("[Portals] Nothing to request");
        if (Request.queue.length() === 0) {
          exitProcess();
        }
        return;
      }
      logger.info("[Portals] Begin requesting...");
      req = [];
      _ref = Tile.bounds;
      for (tileId in _ref) {
        tileBounds = _ref[tileId];
        req.push(tileId);
      }
      return async.each(req, function(tileId, callback) {
        return TileBucket.enqueue(tileId, callback);
      }, function() {
        return TileBucket.enqueue();
      });
    }
  };

  processSuccessTileResponse = function(response, tileIds) {
    var entity, entityCount, m, tileId, tileValue, updater, _i, _len, _ref, _ref1, _results;
    if ((response != null ? (_ref = response.result) != null ? _ref.map : void 0 : void 0) == null) {
      processErrorTileResponse(tileIds, noop);
      return;
    }
    m = response.result.map;
    _results = [];
    for (tileId in m) {
      tileValue = m[tileId];
      entityCount = 0;
      if ((tileValue.error != null) && Tile.data[tileId].status === STATUS_PENDING) {
        if (tileValue.error === 'TIMEOUT') {
          Tile.data[tileId].status = STATUS_TIMEOUT;
          timeoutTiles.push(tileId);
        } else {
          Tile.data[tileId].status = STATUS_FAIL;
          Tile.data[tileId].fails++;
          if (tileData[tileId].fails > Config.Tiles.MaxFailRetry) {
            logger.error("PANIC: tile id=" + tileId);
            Tile.data[tileId].status = STATUS_PANIC;
            panicTiles.push(tileId);
          } else {
            failTiles.push(tileId);
          }
        }
      } else {
        if (tileValue.gameEntities != null) {
          _ref1 = tileValue.gameEntities;
          for (_i = 0, _len = _ref1.length; _i < _len; _i++) {
            entity = _ref1[_i];
            if (tileValue.deletedGameEntityGuids.indexOf(entity[0] === -1)) {
              entityCount++;
              Entity.add(entity[0], entity[1], entity[2]);
            }
          }
        }
        Tile.data[tileId].status = STATUS_COMPLETE;
        Tile.data[tileId].data = tileValue;
      }
      updater = {
        $set: {
          status: Tile.data[tileId].status
        }
      };
      if (entityCount > 0) {
        updater.$set.entityCount = entityCount;
      }
      _results.push(Database.db.collection('Tiles').update({
        _id: tileId
      }, updater, noop));
    }
    return _results;
  };

  processErrorTileResponse = function(tileIds, callback) {
    var tileId, _i, _len;
    for (_i = 0, _len = tileIds.length; _i < _len; _i++) {
      tileId = tileIds[_i];
      if (Tile.data[tileId].status === STATUS_PENDING) {
        Tile.data[tileId].status = STATUS_FAIL;
        Tile.data[tileId].errors++;
        if (Tile.data[tileId].errors > Config.Tile.MaxErrorRetry) {
          logger.error("PANIC: tile id=" + tileId);
          Tile.data[tileId].status = STATUS_PANIC;
          panicTiles.push(tileId);
        } else {
          failTiles.push(tileId);
        }
      }
    }
    return async.eachLimit(tileIds, Config.Database.MaxParallel, function(tileId, callback) {
      return Database.db.collection('Tiles').update({
        _id: tileId
      }, {
        $set: {
          status: Tile.data[tileId].status
        }
      }, callback);
    }, callback);
  };

  checkTimeoutAndFailTiles = function() {
    var pickupCount;
    if (Request.queue.length() !== 0) {
      if (timeoutTiles.length >= Config.TileBucket.Min) {
        pickupCount = Math.min(Config.TileBucket.Max, timeoutTiles.length);
        TileBucket.request(timeoutTiles.slice(0, pickupCount));
        timeoutTiles = timeoutTiles.slice(pickupCount);
      }
      if (failTiles.length >= Config.TileBucket.Min) {
        pickupCount = Math.min(Config.TileBucket.Max, failTiles.length);
        TileBucket.request(failTiles.slice(0, pickupCount));
        return failTiles = failTiles.slice(pickupCount);
      }
    } else {
      if (timeoutTiles.length > 0) {
        TileBucket.request(timeoutTiles.slice(0));
        timeoutTiles = [];
      }
      if (failTiles.length > 0) {
        TileBucket.request(failTiles.slice(0));
        return failTiles = [];
      }
    }
  };

}).call(this);
