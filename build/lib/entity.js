(function() {
  var Entity, async, createEntity, createFieldEntity, createLinkEntity, createPortalEntity, request, requestFactory, requested_guid;

  async = require('async');

  requestFactory = require('./request.js');

  request = requestFactory();

  requested_guid = {};

  Entity = GLOBAL.Entity = {
    counter: {
      portals: 0,
      fields: 0,
      links: 0
    },
    entityCount: 0,
    add: function(id, timestamp, data, callback) {
      var main;
      main = function() {
        Entity.entityCount++;
        if (data.type === 'portal') {
          return createPortalEntity(id, timestamp, data, callback);
        } else if (data.type === 'region') {
          return createFieldEntity(id, timestamp, data, callback);
        } else if (data.type === 'edge') {
          return createLinkEntity(id, timestamp, data, callback);
        } else {
          logger.warn("[Entity] Unknown entity type, id=" + id + ", type=" + data.type);
          return callback && callback();
        }
      };
      if (Entity.entityCount % 100 === 0) {
        return async.parallel([
          function(callback) {
            return Database.db.collection('Portals').count({}, function(err, count) {
              Entity.counter.portals = count;
              return callback();
            });
          }, function(callback) {
            return Database.db.collection('Fields').count({}, function(err, count) {
              Entity.counter.fields = count;
              return callback();
            });
          }, function(callback) {
            return Database.db.collection('Links').count({}, function(err, count) {
              Entity.counter.links = count;
              return callback();
            });
          }
        ], main);
      } else {
        return main();
      }
    },
    requestPortalDetail: function(guid, outerCallback) {
      var t;
      if (requested_guid[guid] != null) {
        return outerCallback();
      }
      requested_guid[guid] = true;
      t = 0;
      return request.push({
        action: 'getPortalDetails',
        data: {
          guid: guid
        },
        beforeRequest: function(callback) {
          t = Date.now();
          return callback();
        },
        onSuccess: function(response, callback) {
          var _ref;
          if (((_ref = response.captured) != null ? _ref.capturedTime : void 0) != null) {
            response.captured.capturedTime = parseInt(response.captured.capturedTime);
          }
          return Database.db.collection('Portals').update({
            _id: guid
          }, {
            $set: response
          }, function() {
            return Agent.resolveFromPortalDetail(response, callback);
          });
        },
        onError: function(err, callback) {
          logger.error("[Details] " + err.message);
          return callback();
        },
        afterResponse: function(callback) {
          logger.info("[Details] " + Math.round(request.done / request.max * 100).toString() + ("%\t[" + request.done + "/" + request.max + "]\t" + (Date.now() - t) + "ms"));
          callback();
          return outerCallback();
        }
      });
    },
    requestMissingPortals: function(callback) {
      return Database.db.collection('Portals').find({
        team: {
          $ne: 'NEUTRAL'
        },
        resonatorArray: {
          $exists: false
        }
      }, {
        _id: true
      }).toArray(function(err, portals) {
        if (err) {
          callback(err);
          return;
        }
        if (portals) {
          return async.each(portals, function(po, callback) {
            return Entity.requestPortalDetail(po._id, callback);
          }, callback);
        } else {
          return callback();
        }
      });
    }
  };

  createEntity = function(collection, id, timestamp, data, callback) {
    data.time = timestamp;
    return Database.db.collection(collection).update({
      _id: id
    }, {
      $set: data
    }, {
      upsert: true
    }, callback);
  };

  createPortalEntity = function(id, timestamp, data, callback) {
    return createEntity('Portals', id, timestamp, data, function() {
      if (data.team !== 'NEUTRAL') {
        return Entity.requestPortalDetail(id, function() {
          return callback && callback('portal');
        });
      } else {
        return callback && callback('portal');
      }
    });
  };

  createFieldEntity = function(id, timestamp, data, callback) {
    return createEntity('Fields', id, timestamp, data, function() {
      return callback && callback('field');
    });
  };

  createLinkEntity = function(id, timestamp, data, callback) {
    return createEntity('Links', id, timestamp, data, function() {
      return callback && callback('link');
    });
  };

}).call(this);
