var uuid = require('uuid');
var runCallback = require('./common.js').runCallback;

/**
 * Conventions:
 *  - The "id" property is always used as the unique ID for classes.
 *  - Classes should be defined then extended as:
 *      function Cls(..) { .. }; // Makes class name available.
 *      Model(Cls);
 *  - Classes have a "self" property that references the static class.
 */

/**
 * Mix model functions into a class.
 *
 * Static methods mixed in to classes are documented under {@link Model.statics}.
 * Instance methods are documented under {@link Model.instance}.
 *
 * @param {Object} cls A class to imbue with Model functionality.
 * @param {string[]} properties A list of properties to be stored in a redis hash.
 * @param {Redis} client A redis client to be used for this model.
 * @param {Object} options An object containing options used for this model.
 *
 * @example
 * var redis = require('redis').createClient();
 * function MyModelClass() {}
 * Model(MyModelClass, ['name'], redis);
 * 
 * // Create
 * var mdl = new MyModelClass();
 * mdl.name = "John Smith";
 * mdl.save();
 * var id = mdl.id;
 *
 * // Retrieve
 * mdl = MyModelClass.get(id);
 *
 * // Update
 * mdl.name = "John Smythe";
 * mdl.save();
 *
 * // Delete
 * mdl.delete();
 */
function RedisStore(cls, client) {
  this.client = client;
  cls.events.on('modelGet', this.get.bind(this));
  cls.events.on('modelAll', this.all.bind(this));
  cls.events.on('modelPurge', this.purge.bind(this));
  cls.events.on('modelSave', this.save.bind(this));
  cls.events.on('modelDelete', this.delete.bind(this));
}

/**
 * Retrieve one or more models by key.
 *
 * @param {string} id The identifier for the object to fetch. An array of ids is also accepted.
 * @param {Model.statics.getCallback} callback The callback receiving the get result(s).
 */
RedisStore.prototype.get = function(event) {
  /* Don't bother if something else has already claimed this event. */
  if (!event.mine()) return;

  var cls = event.target;
  var id = event.data;

  var cb = function(err, result) {
    var mdl;
    if (!err && result) {
      mdl = cls.hydrate(id, result);
    }

    event.done(err, mdl);
  };

  if (id instanceof Array) {
    /* If for some reason we're not getting anything, this makes sure we return something coherent. */
    if (!id.length) return cb(null, []);

    var multi = this.client.multi();
    for (var i = 0; i < id.length; i++) {
      multi.hgetall(cls.getKey(id[i]));
    }
    multi.exec(cb);
  } else {
    this.client.hgetall(cls.getKey(id), cb);
  }
}

/** 
 * Get a list of all object identifiers for this model type.
 *
 * @param {function} callback 
 */
RedisStore.prototype.all = function(event) {
  if (!event.mine()) return;

  var cls = event.target;

  this.client.smembers(cls.getKey('all'), function(err, res) {
    event.done(err, res);
  });
};

/**
 * Purge all objects of this type from redis
 *
 * @param {function} callback
 */
RedisStore.prototype.purge = function(event) {
  if (!event.mine()) return;

  var store = this;
  var cls = event.target;
  cls.all(function(err, res) {
    if (!res) return event.done(err, res);

    var client = store.client.multi();
    client.del(cls.getKey('all'));
    for (var i = 0; i < res.length; i++) {
      client.del(cls.getKey(res[i]));
    }
    client.exec(function(err, res) {
      event.done(err, err ? null : true);
    });
  });
};

/**
 * Save an object to Redis.
 *
 * @param {function} callback
 * @instance
 */
RedisStore.prototype.save = function(event) {
  if (!event.mine()) return;

  var mdl = event.target;
  var key = mdl.self.getKey(mdl.id);
  var all = mdl.self.getKey('all');
  var client = this.client.multi();

  client.sadd(all, mdl.id);
  client.hmset(key, mdl.toObject());

  client.exec(function(err, result) {
    /* The hmset is the critical result, so err on hmset fail. */
    if (result[1] != 'OK') {
      event.done(result[1], null);
    } else {
      event.done(null, mdl);
    }
  });
};

/**
 * Remove an object.
 *
 * @param {function} callback Method to be called
 * @instance
 */
RedisStore.prototype.delete = function(event) {
  if (!event.mine()) return;

  var mdl = event.target;
  var key = mdl.self.getKey(mdl.id);
  var all = mdl.self.getKey('all');
  var client = this.client.multi();
  client.srem(all, mdl.id);
  client.del(key);
  client.exec(function(err, result) {
    /* The hash del is the critical result, so err on del fail. */
    if (result[1] !== 1 && result[1] !==0) {
      event.done(result[1], null);
    } else {
      event.done(null, result[1]);
    }
  });
};

function mixin(cls, client) {
  var store = new RedisStore(cls, client);
}

module.exports = mixin;
