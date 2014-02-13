var runCallback = require('./common.js').runCallback;
var crypto = require('crypto');

/**
 * XXX THIS CLASS IS NOT READY. DO NOT USE.
 * Todo: figure out how to clean up when an indexed field changes value. (I.e. delete the old entry.)
 * Todo: implement purge
 * Note: this adds a private property for original index value in _indexValues
 * Note: Index value removal is done asynchronously because its result doesn't matter (much).
 */
function Index(obj, field) {
  var save = obj.prototype.save;
  var fromObject = obj.prototype.fromObject;
  var del = obj.prototype.delete;

  var indexValue;
  var getter = "getBy" + field.substr(0, 1).toUpperCase() + field.substr(1); 

  /**
   * Key the key at which the index for the field and value will be stored.
   */
  function getKey(value) {
    var hash = crypto.createHash('sha256');
    hash.update(value || indexValue);
    var bucket = hash.digest('hex').substr(0, 8);
    return obj.getKey("ix:" + field + ":" + bucket);
  }

  /**
   * Wrap the save function with a function that adds to the index.
   */
  obj.prototype.save = function(callback) {
    var self = this;
    save.call(self, function(err, result) {
      if (err) return runCallback(callback, err, result);

      /* Try to remove the old index. Failure is non-fatal. */
      if (indexValue && indexValue != self[field]) {
        obj.client.srem(getKey(), self.id);
      }

      indexValue = self[field]; /* Track the new value */

      obj.client.sadd(getKey(), self.id, function(err, result) {
        if (err) return runCallback(callback, err, result);

        runCallback(callback, err, true);
      });
    });
  };

  obj.prototype.fromObject = function(src) {
    indexValue = (typeof(src[field]) !== undefined) ? src[field] : undefined;
    fromObject.call(this, src);
  };

  obj.prototype.delete = function(callback) {
    /* Remove the index key. Failure is non-fatal. */
    obj.client.srem(getKey(), this.id);
    del.call(this, callback);
  };

  /**/
  obj[getter] = function(value, callback) {
    obj.client.smembers(getKey(value), function(err, result) {
      if (err) return runCallback(callback, err, result);
      if (!result.length) return runCallback(callback, err, result);

      obj.get(result, function(err, result) {
        var instances = [];
        for (var i = 0; i < result.length; i++) {
            if (!result[i]) continue; /* No longer exists. */
          if (result[i][field] == value) {
            instances.push(result[i]);
          }
        }

        runCallback(callback, err, instances);
      });
    });
  }
}
module.exports = Index;