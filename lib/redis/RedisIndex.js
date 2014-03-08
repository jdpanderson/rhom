var crypto = require('crypto');
var Promise = require('bluebird');

/**
 * Provides a getter for a single field by tracking changes to that field.
 *
 * Notes:
 *  - This adds a private property in each object for the original indexed value in _<field>
 *  - Index value removal is done asynchronously because its result doesn't matter (much).
 *  - Index value cleanup errors are not tracked. They don't affect operation.
 *
 * Todo:
 *  - Provide a reindex() function to clean and re-compute indexes on an object.
 */
function RedisIndex(cls, field) {
  var mdl = cls._mdl.plugin('RedisIndex:' + field, "Indexed by " + field + " in Redis");
  var client = mdl.option('client');

  /* The name of the getter we're adding */
  var getter = "getBy" + field.substr(0, 1).toUpperCase() + field.substr(1);

  /**
   * Key the key at which the index for the field and value will be stored.
   */
  function getKey(value) {
    var hash = crypto.createHash('sha256');
    hash.update(value);
    var bucket = hash.digest('hex').substr(0, 8);
    return cls.getKey("ix:" + field + ":" + bucket);
  }

  /**
   * Check for field value changes and add/remove indexes as appropriate.
   *
   * @param {Object} obj The model object instance.
   */
  function checkUpdate(obj) {
    var old = obj['_' + field];
    var cur = obj[field];

    /* If the value has changed, wd could update the index value. */
    if (cur != old) {
      /* Try to remove the index for old value. Failure is non-fatal */
      if (old) {
        client.srem(getKey(old), obj.id);
      }

      /* If we have a current value which differs, add to index. Failure isn't fatal. */
      if (cur) {
        client.sadd(getKey(cur), obj.id);
      }

      /* Save the shadow value. */
      obj['_' + field] = obj[field];
    }
  };

  /**
   * After save, we:
   *  - compare the old and new values of the indexed field.
   *  - Clean up the old index, if necessary
   *  - Add a new index, if necessary
   *  - update the shadow value (_field) if necessary
   */
  mdl.on("afterSave", function(event) {
    if (event.error) return;

    checkUpdate(event.target);
  });

  /**
   * Remove a tracked object from the index after delete.
   */
  mdl.on("afterDelete", function(event) {
    var obj = event.target;
    var cur = obj[field];

    if (cur) {
      client.srem(getKey(cur), obj.id);
    }
  });

  /**
   * After get, update the shadow field value.
   */
  mdl.on("afterGet", function(event) {
    if (!event.result) return;

    checkUpdate(event.target);
  });

  /**
   * Clear out any index keys after a purge.
   */
  mdl.on("afterPurge", function(event) {
    /* Get all the keys, and delete them. */
    client.keys(cls.getKey("ix:" + field + ":*"), function(err, res) {
      if (err) {
        console.warn(cls.name + "." + field + " index not cleaned:", err);
        return;
      }

      var multi = client.multi();
      for (var i = 0; i < res.length; i++) {
        multi.del(res[i]);
      }
      multi.exec(function(err, res) {
        if (err) {
          console.warn(cls.name + "." + field + " index not cleaned:", err);
          return;
        }
      });
    });
  });

  /**
   * Populate main getter: getBy<Property>
   *
   * @param {string} value The value to retrieve.
   * @param {function} callback The function to call on success.
   * @return {Promise} A promise representing the result of the getter.
   */
  cls[getter] = function(value, callback) {
    var promise = new Promise(function(resolve, reject) {
      client.smembers(getKey(value), function(err, keys) {
        if (err) return reject(err);
        if (!keys.length) return resolve(keys);

        cls.get(keys, function(err, results) {
          if (err) return reject(err);

          var instances = [];
          for (var i = 0; i < results.length; i++) {
            if (!results[i]) {
              client.srem(getKey(value), keys[i]); // cleanup stale index
              continue; /* No longer exists. */
            }
            if (results[i][field] == value) {
              instances.push(results[i]);
            }
          }

          resolve(instances);
        });
      });
    });
    promise.nodeify(callback);

    return promise;
  }
}
module.exports = RedisIndex;