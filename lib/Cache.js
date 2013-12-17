var runCallback = require('./common.js').runCallback;

/**
 * Cache mixin. Requires Mixin to be applied first.
 *
 * @param {Object} obj The object to which this mixin should be applied.
 * @param {int} timeout The cache timeout, in seconds.
 * @mixin
 * @todo Garbage collection.
 */
function Cache(obj, timeout) {
	timeout = timeout ? (timeout * 1000) : false;

	var get = obj.get,
		purge = obj.purge,
		save = obj.prototype.save,
		del = obj.prototype.delete,
		cache = {};

	/**
	 * Closure to set a cache entry.
	 *
	 * @param {string} id
	 * @param {Object} entry
	 */
	function setEntry(id, entry) {
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
	 * Caching version of the static get method. Semantics are the same.
	 *
	 * @param {string} id The object identifier.
	 * @param {function} callback The callback to be executed when the get returns.
	 */
	obj.get = function(id, callback) {
		var entry = getEntry(id);
		if (entry !== undefined) {
			runCallback(callback, null, entry);
		} else {
			get.call(this, id, function(err, result) {
				if (result) {
					setEntry(id, result);
				}
				runCallback(callback, err, result);
			});
		}
	};

	/**
	 * Purge the cache and run the object purge.
	 *
	 * @param {string} id The object identifier.
	 * @param {function} callback The callback to be executed when the purge is complete.
	 */
	obj.purge = function(id, callback) {
		cache = {};
		purge.call(this, id, callback);
	};

	/**
	 * Save an object, setting its cache entry.
	 *
	 * @param {function} callback The usual save callback.
	 */
	obj.prototype.save = function(callback) {
		save.call(this, callback);
		setEntry(this.id, this);
	};

	/**
	 * Save an object, deleting its cache entry.
	 *
	 * @param {function} callback THe usual delete callback.
	 */ 
	obj.prototype.delete = function(callback) {
		del.call(this, callback);
		delete cache[this.id];
	}
}

module.exports = Cache;