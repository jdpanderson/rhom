var uuid = require('uuid');

/**
 * Redis datastore plugin for the Model class.
 *
 * @param {Object} cls The class to enhance with a redis datastore.
 * @param {RedisClient} client The redis client.
 *
 * This function adds store functionality to the base model. It doesn't mix-in any new functions.
 */
function RedisStore(cls, client) {
  var mdl = cls._mdl.plugin("RedisStore", "Redis storage layer");
  this.client = client;

  mdl.option('client', client);
  mdl.on('get', this.get.bind(this));
  mdl.on('all', this.all.bind(this));
  mdl.on('purge', this.purge.bind(this));
  mdl.on('save', this.save.bind(this));
  mdl.on('delete', this.delete.bind(this));

  /* Pre-determine this class' prefix. */
  var prefix = mdl.option('prefix') || cls.name;
  if (prefix != "") {
    if (prefix.charAt(prefix.length - 1) != ':') {
      prefix += ':';
    }
  }
  mdl.option('prefix', prefix);

  /**
   * Mixin: Get the key for an object id.
   *
   * @param {string} id The ID. If not provided, a new ID is generated.
   * @return {string} The key for the given (possibly new) id.
  */
  cls.getKey = function(id) {
    return prefix + id;
  };
}

/**
 * Retrieve one or more models by key.
 *
 * @param {ModelEvent} event The get event to handle
 */
RedisStore.prototype.get = function(event) {
  if (event.handled) return;

  var cls = event.target;
  var id = event.data;

  var cb = function(err, result) {
    if (err) {
      event.failure(err);
    } else {
      var mdl;
      if (result) {
        mdl = cls.hydrate(id, result);
      }
      event.success(mdl);
    }
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
 * @param {ModelEvent} event The all event to handle
 */
RedisStore.prototype.all = function(event) {
  if (event.handled) return;

  var cls = event.target;

  this.client.smembers(cls.getKey('all'), function(err, res) {
    if (err) {
      event.failure(err);
    } else {
      event.success(res);
    }
  });
};

/**
 * Purge all objects of this type from redis
 *
 * @param {ModelEvent} event The purge event to handle
 */
RedisStore.prototype.purge = function(event) {
  var store = this;
  var cls = event.target;
  cls.all(function(err, res) {
    if (err) {
      event.failure(err);
      return;
    }

    /* Populate the event data with the IDs we're going to delete. */
    event.data = res;

    var client = store.client.multi();
    client.del(cls.getKey('all'));
    for (var i = 0; i < res.length; i++) {
      client.del(cls.getKey(res[i]));
    }
    client.exec(function(err, res) {
      err ? event.failure(err) : event.success(true);
    });
  });
};

/**
 * Save an object to Redis.
 *
 * @param {ModelEvent} event The save event to handle
 */
RedisStore.prototype.save = function(event) {
  var mdl = event.target;
  var key = mdl.self.getKey(mdl.id);
  var all = mdl.self.getKey('all');
  var client = this.client.multi();

  client.sadd(all, mdl.id);
  client.hmset(key, mdl.toObject());

  client.exec(function(err, result) {
    /* The hmset is the critical result, so err on hmset fail. */
    if (result[1] != 'OK') {
      event.failure(result[1]);
    } else {
      event.success(true);
    }
  });
};

/**
 * Remove an object.
 *
 * @param {ModelEvent} event The delete event to handle
 */
RedisStore.prototype.delete = function(event) {
  var mdl = event.target;
  var key = mdl.self.getKey(mdl.id);
  var all = mdl.self.getKey('all');
  var client = this.client.multi();
  client.srem(all, mdl.id);
  client.del(key);
  client.exec(function(err, result) {
    /* The hash del is the critical result, so err on del fail. */
    if (result[1] !== 1 && result[1] !==0) {
      event.failure(result[1]);
    } else {
      event.success(true);
    }
  });
};

module.exports = function(cls, client) {
  new RedisStore(cls, client);
};
