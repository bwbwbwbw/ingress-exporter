(function() {
  var Entity, createEntity, createFieldEntity, createLinkEntity, createPortalEntity;

  Entity = GLOBAL.Entity = {
    counter: {
      portals: 0,
      fields: 0,
      links: 0
    },
    entityCount: 0,
    add: function(id, timestamp, data, callback) {
      if (Entity.entityCount % 100 === 0) {
        Database.db.collection('Portals').count({}, function(err, count) {
          return Entity.counter.portals = count;
        });
        Database.db.collection('Fields').count({}, function(err, count) {
          return Entity.counter.fields = count;
        });
        Database.db.collection('Links').count({}, function(err, count) {
          return Entity.counter.links = count;
        });
      }
      Entity.entityCount++;
      if (data.portalV2 != null) {
        return createPortalEntity.apply(this, arguments);
      } else if (data.capturedRegion != null) {
        return createFieldEntity.apply(this, arguments);
      } else if (data.edge != null) {
        return createLinkEntity.apply(this, arguments);
      } else {
        logger.warn('Unknown entity type, id=' + id);
        return callback && callback();
      }
    }
  };

  createEntity = function(collection, id, timestamp, data, callback) {
    data.time = timestamp;
    TaskManager.begin();
    return Database.db.collection(collection).update({
      _id: id
    }, {
      $set: data
    }, {
      upsert: true
    }, function(err) {
      callback && callback.apply(this, arguments);
      return TaskManager.end();
    });
  };

  createPortalEntity = function(id, timestamp, data, callback) {
    return createEntity('Portals', id, timestamp, data, function() {
      var resonator, _i, _len, _ref;
      if (data.captured != null) {
        if (!Utils.isSystemPlayer(data.captured.capturingPlayerId)) {
          Agent.resolve(data.captured.capturingPlayerId);
        }
        _ref = data.resonatorArray.resonators;
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          resonator = _ref[_i];
          if (!Utils.isSystemPlayer(resonator.ownerGuid)) {
            Agent.resolved(resonator.ownerGuid, {
              level: resonator.level
            });
          }
        }
      }
      return callback && callback();
    });
  };

  createFieldEntity = function(id, timestamp, data, callback) {
    return createEntity('Fields', id, timestamp, data, callback);
  };

  createLinkEntity = function(id, timestamp, data, callback) {
    return createEntity('Links', id, timestamp, data, callback);
  };

}).call(this);
