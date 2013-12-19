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

function Relation(obj) {
	return {
		via: function(intermediary) {
			return {
				toOne: function(relation) {
					var rName = relation.name;
					var iName = intermediary.name;
					obj.prototype[rName] = function(callback) {
						this[iName](function(err, res) {
							if (err) return runCallback(err, null);
							if (!res) return runCallback(err, res);

							res[rName](callback);
						})
					}
				},
				toMany: function(relation) {
					var rName = module.exports.pluralize(relation.name);
					var iName = intermediary.name;
					obj.prototype[rName] = function(callback) {
						this[iName](function(err, res) {
							if (err) return runCallback(err, null);
							if (!res) return runCallback(err, res);

							res[rName](callback);
						})
					}
				}
			}
		},

		toOne: function(relation) {
			var name = relation.name;

			obj.prototype[name] = function(callback) {
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

		toMany: function(relation) {
			var name = module.exports.pluralize(relation.name);

			obj.prototype[name] = function(callback) {
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
			}

		}
	}
}

module.exports = Relation;
module.exports.pluralize = pluralize;