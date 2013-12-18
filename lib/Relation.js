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

		},

		toOne: function(relation) {
			var name = relation.name;
			var key = obj.getKey(name);

			obj[name] = function(callback) {
				obj.client.get(key, function(err, res) {
					if (err) runCallback(callback, err, null);

					relation.get(res, callback);
				});
			}
		},

		toMany: function(relation) {
			var name = module.exports.pluralize(relation.name);
			var key = obj.getKey(name);

			obj[name] = function(callback) {
				obj.client.smembers(key, function(err, keys) {
					if (err) runCallback(callback, err, null);

					var client = relation.client.multi();
					for (var i = 0; i < keys.length; i++) {
						client.hgetall(relation.getKey(keys[i]));
					}
					client.exec(function(err, objects) {
						if (err) runCallback(callback, err, null);

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