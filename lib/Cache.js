var runCallback = require('./common.js').runCallback;

/**
 * Cache mixin. Requires Mixin to be applied first.
 *
 * @param {Object} cls The class/object to which this mixin should be applied.
 * @param {int} timeout The cache timeout, in seconds.
 * @mixin
 * @todo Garbage collection.
 */
function Cache(cls, timeout) {
  timeout = timeout ? (timeout * 1000) : false;

  var cache = {};

  /**
   * Closure to set a cache entry.
   *
   * @param {string} id
   * @param {Object} entry
   */
  function setEntry(id, entry) {
    /* Set an entry to undefined to delete it. */
    if (entry === undefined) {
      delete cache[id];
      return;
    }

    /* Reject entries that come from the cache. */
    if (entry._cache) return;

    entry._cache = true;
    cache[id] = [
      timeout ? new Date().valueOf() + timeout : false,
      entry
    ];
  }

  /**
   * Closure to get a local cache entry.
   *
   * @param {string} id
   * @return {Object} The entry, if found and not expired. Undefined otherwise.
   */
  function getEntry(id) {
    var entry;
    if (cache[id]) {
      if (!timeout || (new Date().valueOf() < cache[id][0])) {
        return cache[id][1]
      }
      delete cache[id];
    }
    return undefined;
  }

  cls._mdl.events.on("beforeGet", function(event) {
    if (event.finished) return;

    var cls = event.target;
    var id = event.data;

    if (id instanceof Array) {
      var entries = [];
      for (var i = 0; i < id.length; i++) {
        var entry = getEntry(id[i]);

        if (!entry) return;

        entries.push(entry);
      }
      event.done(null, entries);
    } else {
      var entry = getEntry(id);
      if (entry) {
        event.done(null, entry);
      }
    }
  });

  cls._mdl.events.on("afterGet", function(event) {
    if (!event.finished) return;

    var err = event.result[0];
    var res = event.result[1];

    if (err) return;

    if (!(res instanceof Array)) res = [res];

    for (var i = 0; i < res.length; i++) {
      setEntry(res[i].id, res[i]);
    }
  });

  cls._mdl.events.on("afterPurge", function(event) {
    cache = {};
  });

  cls._mdl.events.on("afterDelete", function(event) {
    setEntry(event.target.id, undefined);
  });

  cls._mdl.events.on("beforeSave", function(event) {
    var obj = event.target;
    if (obj._cache) delete(obj._cache);
  });

  cls._mdl.events.on("afterSave", function(event) {
    if (!event.finished) return;

    var obj = event.target;
    setEntry(obj.id, obj);
  });
}

module.exports = Cache;