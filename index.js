/* Main mixin augments classes with CRUD */
module.exports = require('./lib/Model.js');

/* Cache mixin adds transparent caching on top of standard CRUD. */
module.exports.cache = require('./lib/Cache.js');

/* Relations mixin adds object relationships. */
module.exports.relates = require('./lib/Relation.js');

// ... Future? Other ideas?
//module.exports.eventemitter = require('./EventEmitter.js');
//module.exports.index = require('./Index.js');
