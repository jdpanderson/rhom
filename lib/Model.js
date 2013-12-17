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
function Model(cls, properties, client, options) {
  options = options || {};

  var override = options.override === undefined || options.override === true;

  /* Mix in static methods and properties */
  for (s in Model.statics) {
    if ((cls[s] === undefined) || override) {
      cls[s] = Model.statics[s];
    }
  }

  /* Mix in instance methods and properties */
  for (i in Model.instance) {
    if ((cls.prototype[i] === undefined) || override) {
      cls.prototype[i] = Model.instance[i];
    }
  }

  /* Pre-determine this class' prefix. */
  cls.prefix = options.prefix || cls.name;
  if (cls.prefix != "") {
    if (cls.prefix.charAt(cls.prefix.length - 1) != ':') {
      cls.prefix += ':';
    }
  }

  cls.client = client;
  cls.properties = properties || [];
  cls.prototype.self = cls;
}

/**
 * A list of static properties and functions that are mixed in to classes.
 *
 * The {@link Model} function should be used to perform the mixing.
 *
 * @mixin
 */
Model.statics = {
  /**
   * Get the key for an object id.
   *
   * @param {string} id The ID. If not provided, a new ID is generated.
   * @return {string} The key for the given (possibly new) id.
   */
  getKey: function(id) {
    if (id === undefined) {
      id = this.idgen();
    }

    return this.prefix + id;
  },

  /**
   * Retrieve a model by key.
   *
   * @param {string} id The identifier for the object to fetch.
   * @param {Model.statics.getCallback} callback The callback receiving the get result.
   */
  get: function(id, callback) {
    if (typeof(id) === 'undefined') {
      runCallback(callback, "No ID provided", undefined);
      return;
    }

    var self = this;
    this.client.hgetall(this.getKey(id), function(err, result) {
      var mdl = null;
      if (!err) {
        mdl = new self();
        mdl.id = id;
        mdl.fromObject(result);
      }

      runCallback(callback, err, mdl);
    });
  },
  /**
   * @callback Model.statics.getCallback
   * @param {string} error An error string, or null if no error occurred.
   * @param {Model} result The retrieved model object, or null on error.
   */

  /** 
   * Get a list of all object identifiers for this model type.
   *
   * @param {function} callback 
   */
  all: function(callback) {
    this.client.smembers(this.getKey('all'), function(err, res) {
        runCallback(callback, err, res);
    })
  },

  /**
   * Purge all objects of this type from redis
   *
   * @param {function} callback
   */
  purge: function(callback) {
    var self = this;
    this.all(function(err, res) {
      if (res) {
        var client = self.client.multi();
        client.del(self.getKey('all'));
        for (var i = 0; i < res.length; i++) {
          client.del(self.getKey(res[i]));
        }
        client.exec(function(err, res) {
          runCallback(callback, err, err ? null : true);
        });
      }
    });
  },

  /** 
   * Unique ID generator. Defaults to using UUIDs.
   *
   * @kind function
   * @returns {string} A unique identifier.
   */
  idgen: uuid.v4
};

/**
 * Methods and properties that get mixed into object prototypes.
 *
 * The {@link Model} function should be used to perform the mixing.
 *
 * @mixin
 */
Model.instance = {
  /**
   * Save an object to Redis.
   *
   * @param {function} callback
   * @instance
   */
  save: function(callback) {
    if (!this.id) {
      this.id = this.self.idgen();
    }

    var mdl = this,
      key = this.self.getKey(this.id),
      all = this.self.getKey('all'),
      client = this.self.client.multi();

    client.sadd(all, this.id);
    client.hmset(key, this.toObject());
    client.exec(function(err, result) {
      /* The hmset is the critical result, so err on hmset fail. */
      if (result[1] != 'OK') {
        runCallback(callback, result[1], null);
      } else {
        runCallback(callback, null, mdl);
      }
    });
  },

  /**
   * Remove an object.
   *
   * @param {function} callback Method to be called
   * @instance
   */
  delete: function(callback) {
    var key = this.self.getKey(this.id);
    var all = this.self.getKey('all');
    var client = this.self.client.multi();
    client.srem(all, this.id);
    client.del(key);
    client.exec(function(err, result) {
      /* The hash del is the critical result, so err on del fail. */
      if (result[1] !== 1 && result[1] !==0) {
        runCallback(callback, result[1], null);
      } else {
        runCallback(callback, null, result[1]);
      }
    });
  },

  /**
   * Copy properties from an anonymous object into this object.
   *
   * @param {Object} obj
   * @instance
   */
  fromObject: function(obj) {
    for (var p = 0; p < this.self.properties.length; p++) {
      var property = this.self.properties[p];
      if (typeof(obj[property]) !== "undefined") {
        this[property] = obj[property];
      }
    }
  },

  /**
   * Convert a model to an anonymous object.
   *
   * @returns {Object} An anonymous object with properties and values belonging to this class.
   * @instance
   *
   * @example
   * JSON.stringify(mymodel.toObject());
   */
  toObject: function() {
    dst = {};
    for (var p = 0; p < this.self.properties.length; p++) {
      var property = this.self.properties[p];
      dst[property] = this[property] || "";
    }
    return dst;
  }
};

/**
 * Create a new sequence-based unique ID generator.
 *
 * @param {integer} init The initial value. Defaults to 0.
 * @return {function} An ID generator function.
 * @alias sequence
 *
 * @example
 * var init = 123; // Get initial value somehow.
 * function MyModel() {};
 * Model(MyModel);
 * MyModel.idgen = Model.sequence(init);
 */
Model.sequence = function(init) {
  var sequence = (init !== undefined) ? init : 0;
  return function() { return new String(sequence++).valueOf(); };
}

module.exports = Model;
