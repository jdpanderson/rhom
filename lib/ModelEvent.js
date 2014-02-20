var Promise = require('bluebird');

/**
 * Represents an event that has occurred on a model.
 *
 * This is an event Emitted by the model, not the emitter itself.
 *
 * @private For use internally in the Model class only.
 *
 * @param {string} type The event type. "save" (C), "get" (R), "save" (U), or "delete" (D)... Also "purge" and "all"
 * @param {Object} target The event target, either the model class (get/all/purge), or the instance (save/delete)
 * @param {variable} data Any relevant data. Varies from call to call. (E.g. the ID(s) for get events.)
 */
function ModelEvent(type, target, data) {
  this.type = type;
  this.target = target;
  this.data = data;

  var evt = this;
  this.promise = new Promise(function(resolve, reject) {
    evt._resolve = resolve;
    evt._reject = reject;
  }).then(function(result) {
    return evt.result = result;
  }).error(function(error) {
    evt.error = error;
  });
}

ModelEvent.prototype = {
  type: null,
  target: null,
  data: null,
  result: null,
  error: null,
  promise: null,

  success: function(result) {
    this._resolve(result);
  },

  failure: function(error) {
    this._reject(error);
  }
};

module.exports = ModelEvent;