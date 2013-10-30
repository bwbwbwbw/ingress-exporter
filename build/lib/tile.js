(function() {
  var ObjectID, STATUS_COMPLETE, STATUS_FAIL, STATUS_PANIC, STATUS_PENDING, STATUS_REQUESTING, STATUS_TIMEOUT, Tile, TileBucket, checkTimeoutAndFailTiles, delayAndExecute, failTiles, panicTiles, processErrorTileResponse, processSuccessTileResponse, timeoutTiles;

  timeoutTiles = [];

  failTiles = [];

  panicTiles = [];

  ObjectID = Database.db.bson_serializer.ObjectID;

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
      if (TileBucket.bucket.length >= Config.TileBucket.Max) {
        TileBucket.request(TileBucket.bucket, callback);
        return TileBucket.bucket = [];
      } else {
        return callback && callback();
      }
    },
    request: function(tileIds, callback) {
      var boundsParamsList, completedQueries, expectedQueries, next, onAllQueriesComplete;
      boundsParamsList = [];
      completedQueries = 0;
      expectedQueries = tileIds.length;
      onAllQueriesComplete = function() {
        var data, requestId;
        if (boundsParamsList.length !== 0) {
          TileBucket.requestCount++;
          requestId = TileBucket.requestCount;
          data = {
            boundsParamsList: boundsParamsList
          };
          Request.add({
            action: 'getThinnedEntitiesV4',
            data: data,
            onSuccess: function(response) {
              return processSuccessTileResponse(response, tileIds);
            },
            onError: function(err) {
              logger.error("[Request] ErrorCode=" + err.code);
              return processErrorTileResponse(tileIds);
            },
            afterResponse: function() {
              logger.info("[Request] " + Math.round(Request.requested / Request.maxRequest * 100).toString() + ("% [" + Request.requested + "/" + Request.maxRequest + "]") + (" timeout=" + timeoutTiles.length + ", fail=" + failTiles.length + ", panic=" + panicTiles.length + " | " + Entity.counter.portals + " portals, " + Entity.counter.links + " links, " + Entity.counter.fields + " fields"));
              return checkTimeoutAndFailTiles();
            },
            beforeRequest: function() {
              return null;
            }
          });
        }
        return callback && callback();
      };
      next = function() {
        var tileId;
        if (completedQueries === expectedQueries) {
          onAllQueriesComplete();
          return;
        }
        tileId = tileIds[completedQueries];
        if (Tile.data[tileId].status !== STATUS_COMPLETE) {
          boundsParamsList.push(Tile.bounds[tileId]);
          Tile.data[tileId].status = STATUS_PENDING;
          return Database.db.collection('Tiles').update({
            _id: tileId
          }, {
            $set: {
              status: STATUS_PENDING
            }
          }, {
            upsert: true
          }, function() {
            completedQueries++;
            return next();
          });
        } else {
          completedQueries++;
          return next();
        }
      };
      return next();
    }
  };

  Tile = GLOBAL.Tile = {
    length: 0,
    bounds: {},
    data: {},
    calculateBounds: function() {
      var bounds, boundsParams, latNorth, latSouth, lngEast, lngWest, tileBounds, tileId, x, x1, x2, y, y1, y2, _i, _j;
      bounds = Utils.clampLatLngBounds(new L.LatLngBounds(new L.LatLng(Config.Region.SouthWest.Lat, Config.Region.SouthWest.Lng), new L.LatLng(Config.Region.NorthEast.Lat, Config.Region.NorthEast.Lng)));
      x1 = Utils.lngToTile(bounds.getWest(), Config.MinPortalLevel);
      x2 = Utils.lngToTile(bounds.getEast(), Config.MinPortalLevel);
      y1 = Utils.latToTile(bounds.getNorth(), Config.MinPortalLevel);
      y2 = Utils.latToTile(bounds.getSouth(), Config.MinPortalLevel);
      tileBounds = [];
      for (y = _i = y1; y1 <= y2 ? _i <= y2 : _i >= y2; y = y1 <= y2 ? ++_i : --_i) {
        for (x = _j = x1; x1 <= x2 ? _j <= x2 : _j >= x2; x = x1 <= x2 ? ++_j : --_j) {
          tileId = Utils.pointToTileId(Config.MinPortalLevel, x, y);
          latNorth = Utils.tileToLat(y, Config.MinPortalLevel);
          latSouth = Utils.tileToLat(y + 1, Config.MinPortalLevel);
          lngWest = Utils.tileToLng(x, Config.MinPortalLevel);
          lngEast = Utils.tileToLng(x + 1, Config.MinPortalLevel);
          boundsParams = Utils.generateBoundsParams(tileId, latSouth, lngWest, latNorth, lngEast);
          tileBounds.push(boundsParams);
        }
      }
      return tileBounds;
    },
    prepareFromDatabase: function(callback) {
      var completedBounds, completedQueries, expectedQueries, next, onAllQueriesComplete, tileBounds;
      logger.info("[Tile] Preparing from database: [" + Config.Region.SouthWest.Lat + "," + Config.Region.SouthWest.Lng + "]-[" + Config.Region.NorthEast.Lat + "," + Config.Region.NorthEast.Lng + "], MinPortalLevel=" + Config.MinPortalLevel);
      tileBounds = Tile.calculateBounds();
      completedQueries = 0;
      expectedQueries = tileBounds.length;
      completedBounds = {};
      onAllQueriesComplete = function() {
        var bounds, _i, _len;
        for (_i = 0, _len = tileBounds.length; _i < _len; _i++) {
          bounds = tileBounds[_i];
          if (completedBounds[bounds.id] == null) {
            Tile.length++;
            Tile.bounds[bounds.id] = bounds;
          }
        }
        return Tile._prepareTiles(callback);
      };
      next = function() {
        var bound;
        if (completedQueries === expectedQueries) {
          onAllQueriesComplete();
          return;
        }
        bound = tileBounds[completedQueries];
        return Database.db.collection('Tiles').findOne({
          _id: bound.id,
          status: STATUS_COMPLETE
        }, function(err, tile) {
          completedQueries++;
          if (tile != null) {
            completedBounds[tile._id] = true;
          }
          return next();
        });
      };
      logger.info("[Tile] Querying " + expectedQueries + " tile status...");
      return next();
    },
    prepareNew: function(callback) {
      var bounds, tileBounds, _i, _len;
      logger.info("[Tile] Preparing new: [" + Config.Region.SouthWest.Lat + "," + Config.Region.SouthWest.Lng + "]-[" + Config.Region.NorthEast.Lat + "," + Config.Region.NorthEast.Lng + "], MinPortalLevel=" + Config.MinPortalLevel);
      tileBounds = Tile.calculateBounds();
      for (_i = 0, _len = tileBounds.length; _i < _len; _i++) {
        bounds = tileBounds[_i];
        Tile.length++;
        Tile.bounds[bounds.id] = bounds;
      }
      return Tile._prepareTiles(callback);
    },
    _prepareTiles: function(callback) {
      logger.success("[Tile] Prepared " + Tile.length + " tiles");
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
      var next, onFinish, pos, req, tileBounds, tileId, _ref;
      logger.info("[Tile] Begin requesting...");
      req = [];
      _ref = Tile.bounds;
      for (tileId in _ref) {
        tileBounds = _ref[tileId];
        req.push(tileId);
      }
      pos = 0;
      onFinish = function() {
        return TileBucket.enqueue();
      };
      next = function() {
        if (pos >= req.length) {
          onFinish();
          return;
        }
        tileId = req[pos];
        return TileBucket.enqueue(tileId, function() {
          pos++;
          return next();
        });
      };
      return next();
    }
  };

  processSuccessTileResponse = function(response, tileIds) {
    var entity, entityCount, m, tileId, tileValue, updater, _i, _len, _ref, _ref1, _results;
    if ((response != null ? (_ref = response.result) != null ? _ref.map : void 0 : void 0) == null) {
      processErrorTileResponse(tileIds);
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

  processErrorTileResponse = function(tileIds) {
    var tileId, _i, _len, _results;
    _results = [];
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
        _results.push(Database.db.collection('Tiles').update({
          _id: tileId
        }, {
          $set: {
            status: Tile.data[tileId].status
          }
        }, noop));
      } else {
        _results.push(void 0);
      }
    }
    return _results;
  };

  checkTimeoutAndFailTiles = function() {
    var pickupCount;
    if (Request.pool.length !== 0) {
      if (timeoutTiles.length >= Config.TileBucket.Min) {
        pickupCount = Math.min(Config.TileBucket.Max, timeoutTiles.length);
        (function(data) {
          return delayAndExecute('DELAY_TIMEOUT', Config.Tile.TimeoutDelay, function() {
            return TileBucket.request(data);
          });
        })(timeoutTiles.slice(0, pickupCount));
        timeoutTiles = timeoutTiles.slice(pickupCount);
      }
      if (failTiles.length >= Config.TileBucket.Min) {
        pickupCount = Math.min(Config.TileBucket.Max, failTiles.length);
        (function(data) {
          return delayAndExecute('DELAY_FAIL', Config.Tile.FailDelay, function() {
            return TileBucket.request(data);
          });
        })(failTiles.slice(0, pickupCount));
        return failTiles = failTiles.slice(pickupCount);
      }
    } else {
      if (timeoutTiles.length > 0) {
        (function(data) {
          return delayAndExecute('DELAY_TIMEOUT', Config.Tile.TimeoutDelay, function() {
            return TileBucket.request(data);
          });
        })(timeoutTiles.slice(0));
        timeoutTiles = [];
      }
      if (failTiles.length > 0) {
        (function(data) {
          return delayAndExecute('DELAY_FAIL', Config.Tile.FailDelay, function() {
            return TileBucket.request(data);
          });
        })(failTiles.slice(0));
        return failTiles = [];
      }
    }
  };

  delayAndExecute = function(delayerId, delay, callback) {
    var _this = this;
    if (this[delayerId] != null) {
      return;
    }
    return this[delayerId] = setTimeout(function() {
      callback();
      return _this[delayerId] = null;
    }, delay);
  };

}).call(this);
