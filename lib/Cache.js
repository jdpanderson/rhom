/**
 * Cache mixin. Requires a storage mixin to be applied first.
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

    /* Don't re-cache entries that come from the cache. */
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

  /**
   * The cache hooks in before the asynchronous get call. It injects a result before an asynch call is necessary.
   */
  cls._mdl.events.on("beforeGet", function(event) {
    var cls = event.target;
    var id = event.data;

    if (id instanceof Array) {
      var entries = [];
      for (var i = 0; i < id.length; i++) {
        var entry = getEntry(id[i]);

        if (!entry) return;

        entries.push(entry);
      }
      event.success(entries);
    } else {
      var entry = getEntry(id);
      if (entry) {
        event.success(entry);
      }
    }
  });

  /**
   * Save the object after it is retrieved elsewhere.
   */
  cls._mdl.events.on("afterGet", function(event) {
    if (event.error) return;

    var res = event.result;

    if (!(res instanceof Array)) res = [res];

    for (var i = 0; i < res.length; i++) {
      setEntry(res[i].id, res[i]);
    }
  });

  /**
   * If something calls purge, we follow suit.
   */
  cls._mdl.events.on("afterPurge", function(event) {
    cache = {};
  });

  /**
   * If something is deleted, clear its cache entry.
   */
  cls._mdl.events.on("afterDelete", function(event) {
    setEntry(event.target.id, undefined);
  });

  /**
   * If something is saved, clear its cache flag.
   */
  cls._mdl.events.on("beforeSave", function(event) {
    var obj = event.target;
    if (obj._cache) {
      delete(obj._cache);
    }
  });

  /**
   * Put an object into cache after saving so long as there was no error.
   */
  cls._mdl.events.on("afterSave", function(event) {
    if (event.error) return;

    var obj = event.target;
    setEntry(obj.id, obj);
  });
}

module.exports = Cache;