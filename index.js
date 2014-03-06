/* Main mixin augments classes with CRUD */
var Model = require('./lib/Model.js');

/* Redis storage for models. */
var RedisStore = require('./lib/RedisStore.js');

/* Cache mixin adds transparent caching on top of standard CRUD. */
var Cache = require('./lib/Cache.js');

/* Relations mixin adds object relationships. */
var Relation = require('./lib/Relation.js');

/* Index a field by value. */
var Index = require('./lib/Index.js');

/* Export the simplified interface */
module.exports = function(cls, properties, client, options) {
	Model(cls, properties, options);
	RedisStore(cls, client);

	return {
		cache: function(timeout) {
			Cache(cls, timeout);
			return this;
		},
		index: function(field) {
			Index(cls, field);
			return this;
		},
		relates: function() {
			Relation(cls);
			return this;
		}
	};
};
module.exports.model = Model;
module.exports.redis = RedisStore;
module.exports.cache = Cache;
module.exports.relates = Relation;
module.exports.index = Index;

// Placeholder for future ideas. See bottom of README.md for info.
