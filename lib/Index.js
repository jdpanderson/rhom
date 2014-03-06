var crypto = require('crypto');
var Promise = require('bluebird');

/**
 * XXX THIS CLASS IS NOT READY. DO NOT USE.
 * Todo: figure out how to clean up when an indexed field changes value. (I.e. delete the old entry.)
 * Todo: implement purge
 * Note: this adds a private property for original index value in _indexValues
 * Note: Index value removal is done asynchronously because its result doesn't matter (much).
 */
function Index(cls, field) {
  var mdl = cls._mdl.plugin('Index:' + field, "Index by " + field);
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

  mdl.on("afterSave", function(event) {
    if (event.error) return;

    var obj = event.target;
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
    }    

    obj['_' + field] = obj[field];
  });

  mdl.on("afterDelete", function(event) {
    var obj = event.target;
    var cur = obj[field];

    if (cur) {
      client.srem(getKey(cur), obj.id);
    }
  });

  mdl.on("afterGet", function(event) {
    var obj = event.target;

    obj['_' + field] = obj[field];
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
module.exports = Index;