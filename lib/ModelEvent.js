var Promise = require('bluebird');

function warnIfNotInitialized() {
  this.handled = true;
  this.result = null;
  this.error = "resolution function called before promise initialization. Did you inherit from the parent class without calling the super constructor?";
}


/**
 * Represents an event that has occurred on a model.
 *
 * This is an event Emitted by the model, not the emitter itself.
 *
 * @private For use internally in the Model and handlers class only.
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
    /* There's probably a better way to do this... */
    evt._resolve = resolve;
    evt._reject = reject;
  });
}

ModelEvent.prototype = {
  /**
   * The event type, get, save, etc.
   *
   * @member {string} type
   */
  type: null,

  /**
   * The target object: the Class for static methods like get, and the instance for instance methods like save.
   *
   * @member {Object} target
   */
  target: null,
  
  /**
   * Any data required to process the event, for example the ID in the case of a get.
   *
   * @member data
   */
  data: null,

  /**
   * The event result, if the event handler was successful.
   * 
   * @member result
   */
  result: null,

  /**
   * The event error, if the event handler failed.
   *
   * @member result
   */
  error: null,

  /**
   * The promise object, to allow alternate means of handling results/errors.
   *
   * @member {Promise} promise
   */
  promise: null,

  /**
   * Denotes that this event has been handled, either success or failure.
   *
   *  @member {boolean} handled
   */
  handled: false,

  /**
   * A reference to the promise resolver function
   *
   * @private
   * @member {function} _resolve
   */
  _resolve: warnIfNotInitialized,
  /**
   * A reference to the promise rejection function
   *
   * @private
   * @member {function} _reject
   */
  _reject: warnIfNotInitialized,

  /**
   * Mark this event as successful with a given result. (Promise resolved.)
   *
   * @param result
   */
  success: function(result) {
    if (this.handled) return;

    this.handled = true;
    this.result = result;
    this._resolve(result);
  },

  /**
   * Mark this event as a failure with a given error. (Promise rejected.)
   *
   * @param error
   */
  failure: function(error) {
    if (this.handled) return;

    this.handled = true;
    this.error = error;
    this._reject(error);
  }
};

module.exports = ModelEvent;