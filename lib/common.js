/**
 * Private method for running callbacks
 * @private
 */
module.exports = {
  runCallback: function(callback /*, .. arguments */) {
    if (typeof(callback) === 'function') {
      var args = Array.prototype.slice.call(arguments, 1);
      callback.apply(null, args);
    }
  }
};