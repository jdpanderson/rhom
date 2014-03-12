/* Main mixin augments classes with CRUD */
var Model = require('./lib/Model.js');

/* Cache mixin adds transparent caching on top of standard CRUD. */
var Cache = require('./lib/Cache.js');

/* A simple validator */
var Validation = require('./lib/Validation.js');

/* Redis storage for models. */
var RedisStore = require('./lib/redis/RedisStore.js');

/* Relations mixin adds object relationships. */
var RedisRelation = require('./lib/redis/RedisRelation.js');

/* Index a field by value. */
var RedisIndex = require('./lib/redis/RedisIndex.js');

/* Export the simplified interface */
module.exports = function(cls, properties, client, options) {
	Model(cls, properties, options);
	RedisStore(cls, client);

	return {
		cache: function(timeout) {
			Cache(cls, timeout);
			return this;
		},
		validation: function(schema) {
			Validation(cls, schema);
			return this;
		},
		index: function(field) {
			RedisIndex(cls, field);
			return this;
		},
		relates: RedisRelation(cls)
	};
};
module.exports.model = Model;
module.exports.cache = Cache;
module.exports.validation = Validation;
module.exports.relates = RedisRelation;
module.exports.index = RedisIndex;
module.exports.redis = {
	store: RedisStore,
	relates: RedisRelation,
	index: RedisIndex
};

// Placeholder for future ideas. See bottom of README.md for info.
