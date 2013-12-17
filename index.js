/**
 * For now, only export the main model and cache. Plan is to add other mixins later.
 */
module.exports = require('./lib/Model.js');
module.exports.cache = require('./lib/Cache.js');

// ... Future? Other ideas?
//module.exports.eventemitter = require('./EventEmitter.js');
//module.exports.index = require('./Index.js');
