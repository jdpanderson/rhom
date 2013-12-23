var inflection = require('inflection');
var runCallback = require('./common.js').runCallback;

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
	 * @param {Class} relation
	 */
	toOne: function(relation) {
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

		var objs = this.intermediary.slice(0);
		objs.shift(this.obj);
		objs.push(relation);

		/**
		 * Create a callback chain
		 */
		this.obj.prototype["get" + relation.name] = function(callback) {
			/* Last callback in the chain runs the final done callback either way. */
			var next = function(err, res) { runCallback(callback, err, res); };

			/* Loop through objects wrapping a new callback around the previous. */
			for (var i = objs.length; i > 0; i--) {
				var getNext = "get" + objs[i].name;
				next = function(n, d, g) {
					return function(err, res) {
						if (err) runCallback(d, err, null);
						res[g](n);
					};
				}(next, callback, getNext);
			}
		};
	},

	toMany: function(relation) {
		console.log("Intermediary one-to-many is not done yet. Do the same as above, but with different pluralization. Probably re-factor a little.");
	}
};

function Relation(obj) {
	return {
		via: function(intermediary) {
			return new Intermediary(obj, intermediary);
		},

		toOne: function(relation) {
			var name = relation.name;

			obj.prototype["get" + name] = function(callback) {
				var key = obj.getKey(this.id + ':' + name);
				obj.client.get(key, function(err, res) {
					if (err) return runCallback(callback, err, null);
					if (!res) return runCallback(callback, null, null);

					relation.get(res, callback);
				});
			};

			obj.prototype["set" + name] = function(relObj, callback) {
				var key = obj.getKey(this.id + ':' + name);

				if (relObj) { 
					obj.client.set(key, relObj.id, function(err, res) {
						if (err) return runCallback(callback, err, null);
						runCallback(callback, null, true);
					});
				} else {
					obj.client.del(key, function(err, res) {
						if (err) return runCallback(callback, err, null);
						runCallback(callback, null, true);
					});
				}
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

			/**
			 * Relation getter: gets related objects.
			 */
			obj.prototype["get" + names] = function(callback) {
				var key = obj.getKey(this.id + ':' + name);
				obj.client.smembers(key, function(err, keys) {
					if (err) return runCallback(callback, err, null);
					if (!keys.length) return runCallback(callback, null, []);

					var client = relation.client.multi();
					for (var i = 0; i < keys.length; i++) {
						client.hgetall(relation.getKey(keys[i]));
					}
					client.exec(function(err, objects) {
						if (err) return runCallback(callback, err, null);

						var results = [];

						for (var i = 0; i < objects.length; i++) {
							if (!objects[i]) continue;

							var result = new relation();
							result.id = keys[i];
							result.fromObject(objects[i]);
							results.push(result);
						}

						runCallback(callback, null, results);
					});
				});
			};

			/**
			 * Add related object
			 *
			 * @param {Object} related An instance to relate, or its identifier.
			 * @param {function} Callback
			 */
			obj.prototype["add" + name] = function(related, callback) {
				var key = obj.getKey(this.id + ':' + name);
				var relid;

				if (related instanceof String || typeof(related) === "string") {
					relid = related;
				} else {
					relid = related.id;
				}

				obj.client.sadd(key, relid, function(err, res) {
					if (err) return runCallback(callback, err, null);
					runCallback(callback, err, true);
				});
			};

			/**
			 * Remove related object
			 *
			 * @param 
			 * 
			 */
			obj.prototype["remove" + name] = function(related, callback) {
				var key = obj.getKey(this.id + ':' + name);
				var relid;

				if (related instanceof String || typeof(related) === "string") {
					relid = related;
				} else {
					relid = related.id;
				}

				obj.client.srem(key, relid, function(err, res) {
					if (err) return runCallback(callback, err, null);
					runCallback(callback, err, true);
				});
			};
		}
	}
}

module.exports = Relation;
module.exports.pluralize = pluralize;