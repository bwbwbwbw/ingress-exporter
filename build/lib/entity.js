(function() {
  var Entity, createEntity, createFieldEntity, createLinkEntity, createPortalEntity;

  Entity = GLOBAL.Entity = {
    counter: {
      portals: 0,
      fields: 0,
      links: 0
    },
    entityCount: 0,
    add: function(id, timestamp, data) {
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
        return logger.warn('Unknown entity type, id=' + id);
      }
    }
  };

  createEntity = function(collection, id, timestamp, data) {
    data.time = timestamp;
    return Database.db.collection(collection).update({
      _id: id
    }, {
      $set: data
    }, {
      upsert: true
    }, noop);
  };

  createPortalEntity = function(id, timestamp, data) {
    return createEntity('Portals', id, timestamp, data);
  };

  createFieldEntity = function(id, timestamp, data) {
    return createEntity('Fields', id, timestamp, data);
  };

  createLinkEntity = function(id, timestamp, data) {
    return createEntity('Links', id, timestamp, data);
  };

}).call(this);
