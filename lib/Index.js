var runCallback = require('./common.js').runCallback;
var crypto = require('crypto');

/**
 * XXX THIS CLASS IS NOT READY. DO NOT USE.
 * Todo: figure out how to clean up when an indexed field changes value. (I.e. delete the old entry.)
 * Todo: implement purge
 * Note: this adds a private property for original index value in _indexValues
 * Note: Index value removal is done asynchronously because its result doesn't matter (much).
 */
function Index(cls, field, client) {
  /* The name of the getter we're adding */
  var getter = "getBy" + field.substr(0, 1).toUpperCase() + field.substr(1);

  /**
   * Key the key at which the index for the field and value will be stored.
   */
  function getKey(value) {
    var hash = crypto.createHash('sha256');
    hash.update(value || indexValue);
    var bucket = hash.digest('hex').substr(0, 8);
    return cls.getKey("ix:" + field + ":" + bucket);
  }

  cls._mdl.events.on("afterSave", function(event) {
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

  cls._mdl.events.on("afterDelete", function(event) {
    var obj = event.target;
    var cur = obj[field];

    if (cur) {
      client.srem(getKey(cur), obj.id);
    }
  });

  cls._mdl.events.on("afterGet", function(event) {
    var obj = event.target;

    obj['_' + field] = obj[field];
  });

  /**/
  cls[getter] = function(value, callback) {
    client.smembers(getKey(value), function(err, result) {
      if (err) return runCallback(callback, err, result);
      if (!result.length) return runCallback(callback, err, result);

      cls.get(result, function(err, result) {
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