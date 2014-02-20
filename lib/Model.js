var uuid = require('uuid');
var events = require('events');
var ModelEvent = require('./ModelEvent.js');

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
function Model(cls, properties, options) {
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

  /* Properties considered protected */
  cls._mdl = {
    properties: properties || [],
    events: new events.EventEmitter(),
    idgen: options.idgen || uuid.v4
  };
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
      id = this._mdl.idgen();
    }

    return this.prefix + id;
  },

  /**
   * Retrieve one or more models by key.
   *
   * @param {string} id The identifier for the object to fetch. An array of ids is also accepted.
   * @param {Model.statics.getCallback} callback The callback receiving the get result(s).
   */
  get: function(id, callback) {
    if (typeof(id) === 'undefined') {
      if (typeof callback === 'function') {
        callback.call(undefined, "No ID provided", undefined);
      }
      return;
    }

    return emitEvent(this._mdl.events, 'get', this, id, callback).promise;
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
    return emitEvent(this._mdl.events, 'all', this, undefined, callback).promise;
  },

  /**
   * Build one or more objects from an object or array of objects.
   *
   * @param {string} id The unique identifier for the object.
   * @param {Object} result Typically an anonymous hgetall result, or an array of hgetall results.
   */
  hydrate: function(id, result) {
    if (result instanceof Array) {
      var results = [];
      for (var i = 0; i < result.length; i++) {
        results.push(result[i] ? this.hydrate(id[i], result[i]) : result[i]);
      }
      return results;
    } else {
      var mdl = new this();
      mdl.id = id;
      mdl.fromObject(result);
      return mdl;
    }
  },

  /**
   * Purge all objects of this type.
   *
   * @param {function} callback
   */
  purge: function(callback) {
    return emitEvent(this._mdl.events, 'purge', this, undefined, callback).promise;
  }
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
      this.id = this.self._mdl.idgen();
    }

    return emitEvent(this.self._mdl.events, 'save', this, undefined, callback).promise;
  },

  /**
   * Remove an object.
   *
   * @param {function} callback Method to be called
   * @instance
   */
  delete: function(callback) {
    return emitEvent(this.self._mdl.events, 'delete', this, undefined, callback).promise;
  },

  /**
   * Copy properties from an anonymous object into this object.
   *
   * @param {Object} obj
   * @instance
   */
  fromObject: function(obj) {
    var properties = this.self._mdl.properties;
    for (var p = 0; p < properties.length; p++) {
      var property = properties[p];
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
    var dst = {};
    var properties = this.self._mdl.properties;
    for (var p = 0; p < properties.length; p++) {
      var property = properties[p];
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
};

/**
 * Private function to emit the same event pattern for all methods.
 *
 * @param {string} type The event type, e.g. 'get'
 * @param {mixed} target The event target, an object, id, or undefined.
 * @param {function} callback The callback to be called on event completion.
 *
 * This function:
 *  - Creates the callback on the event to call an "after" event for any synchronous postprocessing.
 *  - Emits a "before" event which is expected to do any synchronous preprocessing.
 *  - Emits the event, which may or may not happen asynchronously.
 */
function emitEvent(emitter, type, target, data, callback) {
  var Type = type.substr(0, 1).toUpperCase() + type.substr(1);
  var evt = new ModelEvent(type, target, data);

  evt.promise.nodeify(callback);
  evt.promise.timeout(1000, "No Result: timed out.");
  evt.promise.finally(function() {
    emitter.emit('after' + Type, evt);
  });
  emitter.emit('before' + Type, evt);
  emitter.emit(type, evt);
  return evt;
};

module.exports = Model;
