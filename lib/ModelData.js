var uuid = require('uuid');
var util = require('util');
var events = require('events');

/**
 * Represents internal model data, acts as a hook for model enhancements.
 *
 * @param {string[]} properties An array of property names.
 * @param {function} idGenerator A function used to generate unique IDs. Defaults to uuid.v4.
 * @param {Object} options Any options that were passed to the original
 * @augments events.EventEmitter
 * @private
 */
function ModelData(properties, options) {
  this.properties = (properties === undefined || properties instanceof Array) ? properties : [];
  this.options = options || {};
  this.idgen = this.options.idgen || uuid.v4;
  this.plugins = {};
}
util.inherits(ModelData, events.EventEmitter);

/**
 * Keep track of what functionality has been added to a model.
 *
 * @param {string} name The unique (per class) name of the plugin being registered.
 * @param {string} description A brief description of what the plugin does.
 */
ModelData.prototype.plugin = function(name, description) {
  if (typeof this.plugins[name] !== 'undefined') {
    throw new Error("Plugin " + name + " already registered on this class");
  }

  this.plugins[name] = description;

  return this;
}

/**
 * Option getter/setter
 *
 * @param {string} opt The option name.
 * @param {mixed} val The option value.
 * @returns {mixed} The option value, or undefined if the option is not defined.
 */
ModelData.prototype.option = function(opt, val) {
  if (val !== undefined) {
    this.options[opt] = val;
  }

  return this.options[opt];
}

module.exports = ModelData;