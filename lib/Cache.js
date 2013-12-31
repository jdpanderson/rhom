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
	 * Multi-get. Could be more efficient.
	 *
	 * @param {string[]} ids An array of entry IDs.
	 * @param {function} callback 
	 */
	function mget(ids, callback) {
		var entries = [], missing = [];

		/* Split out the entries that exist, and which don't */
		for (var i = 0; i < ids.length; i++) {
			var entry = getEntry(ids[i]);
			entries.push(entry);
			if (!entry) {
				missing.push(ids[i]);
			}
		}

		/* If none are missing, return now. */
		if (!missing.length) {
			runCallback(callback, null, entries);
		}

		/* Get the missing entries, cache them, and merge them into the result. */
		get.call(obj, missing, function(err, result) {
			if (err) {
				runCallback(err, null);
			}

			for (var i = 0; i < missing.length; i++) {
				if (!result[i]) continue;

				var idx;

				setEntry(missing[i], result[i]);
				if ((idx = ids.indexOf(missing[i])) >= 0) {
					entries[idx] = result[i];
				}
			}

			runCallback(callback, null, entries);
		});
	}

	/**
	 * Caching version of the static get method. Semantics are the same.
	 *
	 * @param {string} id The object identifier.
	 * @param {function} callback The callback to be executed when the get returns.
	 */
	obj.get = function(id, callback) {
		/* Dispatch to the multi-get version. */
		if (id instanceof Array) {
			mget(id, callback);
			return;
		}

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