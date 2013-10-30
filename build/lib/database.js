(function() {
  var Database, db, mongo;

  mongo = require('mongoskin');

  db = mongo.db(Config.Database.ConnectString, Config.Database.Options);

  Database = GLOBAL.Database = {};

  Database.db = db;

}).call(this);
