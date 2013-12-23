/* Main mixin augments classes with CRUD */
module.exports = require('./lib/Model.js');

/* Cache mixin adds transparent caching on top of standard CRUD. */
module.exports.cache = require('./lib/Cache.js');

/* Relations mixin adds object relationships. */
module.exports.relates = require('./lib/Relation.js');

// Placeholder for future ideas. See bottom of README.md for info.
//module.exports.eventemitter = require('./EventEmitter.js');
//module.exports.index = require('./Index.js');
