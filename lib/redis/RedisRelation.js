var inflection = require('inflection');
var Promise = require('bluebird');

/**
 * Pluralize a string.
 *
 * @param {string} str The string to pluralize.
 * @returns {string} The pluralized version of the input string.
 */
function pluralize(str) {
  return inflection.pluralize(str);
}

/**
 * Class representing a chain of intermediaries. Typically one, but supports many.
 */
function Intermediary(obj, intermediary) {
  this.obj = obj;
  this.intermediary = (intermediary instanceof Array) ? intermediary : [intermediary];
}

Intermediary.prototype = {
  /**
   * Chain intermediary relation classes.
   */
  via: function(intermediary) {
    this.intermediary.push(intermediary);

    return this;
  },

  /**
   * Terminate the intermediary chain with a toOne relationship.
   *
   * @private
   * @param {Class} relation The final class to which the original relation is related.
   * @param {bool} pluralize true if the final relation is a one-to-many.
   */
  to: function(relation, pluralize) {
    /**
     * A wants to get D through B and C. (Here A..D represent the classes, and a..d represent instances)
     * A.prototype.getD is a function(done) {}
     * call to a.getD() calls this.getB(callback)
     * callback calls b.getC(callback)
     * callback calls c.getD(callback)
     * callback calls done callback. .prototype.c
     * at any point through the chain, an error must call the done callback with the error. (Early term)
     *
     * To accomplish this, we need to make a callback chain within a function so that the done callback can be passed in later.
     */
    var name = pluralize ? module.exports.pluralize(relation.name) : relation.name;
    var objs = this.intermediary.slice(0);
    objs.push(relation);

    this.obj._mdl.plugin("RedisRelation:" + name, "Relationship to " + name + " in Redis");

    /**
     * Create a callback chain
     */
    this.obj.prototype["get" + name] = function(callback) {
      /* Last callback in the chain runs the final done callback via promise. */
      var next, done;
      var promise = new Promise(function(resolve, reject) {
        done = next = function(err, res) { err ? reject(err) : resolve(res); };
      });
      promise.nodeify(callback);

      /* Loop through objects wrapping a new callback around the previous. */
      for (var i = (objs.length - 1); i > 0; i--) {
        var getter = "get" + ((objs[i] === relation) ? name : objs[i].name); /* Might be plural */
        /**
         * @param {function} n Next
         * @param {function} g Getter
         */
        next = function(n, g) {
          return function(err, res) {
            if (err || !res) return done(err, null);
            res[g](n);
          };
        }(next, getter);
      }

      /* Initiate the callback chain by calling the first getter. */
      this["get" + objs[0].name](next);

      return promise;
    };
  },

  /**
   * Create a one-to-one relationship that terminates the intermediary chain.
   *
   * @param {Object} relation The model class that represents the final relation.
   */
  toOne: function(relation) { this.to(relation, false); },

  /**
   * Create a one-to-many relationship that terminates the intermediary chain.
   *
   * @param {Object} relation The model class that represents the final relation.
   */
  toMany: function(relation) { this.to(relation, true); }
};

/**
 * A relation stores a relation's id(s) in a key or set.
 *
 * E.g. if a User is stored at User:123, the related role ID(s) would be stored at User:123:Role 
 */
function RedisRelation(obj) {
  var client = obj._mdl.option('client');

  return {
    via: function(intermediary) {
      return new Intermediary(obj, intermediary);
    },

    /**
     * Add a direct to-one relationship.
     *
     * This means adding a getter, and a setter.
     *
     * To-do: register a deletion event handler to clean up after deletes.
     */
    toOne: function(relation) {
      var name = relation.name;
      var mdl = obj._mdl.plugin("RedisRelation:" + name, "Relation to " + name + " in Redis");

      obj.prototype["get" + name] = function(callback) {
        var key = obj.getKey(this.id + ':' + name);
        var promise = new Promise(function(resolve, reject) {
          client.get(key, function(err, res) {
            if (err) return reject(err);
            if (!res) return resolve(null);

            relation.get(res).then(
              function(result) { resolve(result); },
              function(error) { reject(error); }
            );
          });  
        });
        promise.nodeify(callback);

        return promise;
      };

      obj.prototype["set" + name] = function(relObj, callback) {
        var key = obj.getKey(this.id + ':' + name);
        var promise = new Promise(function(resolve, reject) {
          if (relObj) { 
            client.set(key, relObj.id, function(err, res) {
              err ? reject(err) : resolve(true);
            });
          } else {
            client.del(key, function(err, res) {
              err ? reject(err) : resolve(true);
            });
          }
        });
        promise.nodeify(callback);
        
        return promise;
      }
    },

    /**
     * A one to many relationship allows getting all related objects, and adding and removing them individually.
     *
     * @param {Object} relation
     */
    toMany: function(relation) {
      var names = module.exports.pluralize(relation.name);
      var name = relation.name;
      var mdl = obj._mdl.plugin("RedisRelation" + names, "Relation to " + names + " in Redis");

      /**
       * Relation getter: gets related objects.
       */
      obj.prototype["get" + names] = function(callback) {
        var key = obj.getKey(this.id + ':' + names);
        var promise = new Promise(function(resolve, reject) {
          client.smembers(key, function(err, keys) {
            if (err) reject(err);
            if (!keys.length) resolve(keys);

            relation.get(keys).then(
              function(result) { resolve(result); },
              function(error) { reject(error); }
            );
          });
        });
        promise.nodeify(callback);

        return promise;
      };

      /**
       * Add related object
       *
       * @param {Object} related An instance to relate, or its identifier.
       * @param {function} Callback
       */
      obj.prototype["add" + name] = function(related, callback) {
        var key = obj.getKey(this.id + ':' + names);
        var relid;

        if (related instanceof String || typeof(related) === "string") {
          relid = related;
        } else {
          relid = related.id;
        }

        var promise = new Promise(function(resolve, reject) {
          client.sadd(key, relid, function(err, res) {
            err ? reject(err) : resolve(true);
          });
        });
        promise.nodeify(callback);
        return promise;
      };

      /**
       * Remove related object
       *
       * @param 
       * 
       */
      obj.prototype["remove" + name] = function(related, callback) {
        var key = obj.getKey(this.id + ':' + names);
        var relid;

        if (related instanceof String || typeof(related) === "string") {
          relid = related;
        } else {
          relid = related.id;
        }

        var promise = new Promise(function(resolve, reject) {
          client.srem(key, relid, function(err, res) {
            err ? reject(err) : resolve(true);
          });
        });
        promise.nodeify(callback);
        return promise;
      };
    }
  }
}

module.exports = RedisRelation;
module.exports.pluralize = pluralize;