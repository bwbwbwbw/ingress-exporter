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
      if (data.type === 'portal') {
        return createPortalEntity.apply(this, arguments);
      } else if (data.type === 'region') {
        return createFieldEntity.apply(this, arguments);
      } else if (data.type === 'edge') {
        return createLinkEntity.apply(this, arguments);
      } else {
        logger.warn("Unknown entity type, id=" + id + ", type=" + data.type);
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
    return createEntity('Portals', id, timestamp, data, callback);
    /*
    createEntity 'Portals', id, timestamp, data, ->
    
        # resolve agents
        if data.captured?
    
            Agent.resolve data.captured.capturingPlayerId
    
            for resonator in data.resonatorArray.resonators
    
                if not Utils.isSystemPlayer resonator.ownerGuid
    
                    Agent.resolve resonator.ownerGuid
                    
                    # consider ADA Reflector/Jarvis Virus?
                    Agent.resolved resonator.ownerGuid,
                        level: resonator.level
    
        callback && callback()
    */

  };

  createFieldEntity = function(id, timestamp, data, callback) {
    return createEntity('Fields', id, timestamp, data, callback);
  };

  createLinkEntity = function(id, timestamp, data, callback) {
    return createEntity('Links', id, timestamp, data, callback);
  };

}).call(this);
