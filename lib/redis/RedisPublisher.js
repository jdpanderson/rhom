var uuid = require('uuid');

/**
 * XXX: this is just an idea. Not tested or referenced.
 *
 * Redis event publisher plugin for the Model class.
 *
 * @param {Object} cls The class to enhance with a redis datastore.
 * @param {RedisClient} client The redis client.
 *
 * Notes:
 *  - This should be seen as an example. It isn't likely useful to anyone as-is.
 *  - This publishes the object and event in the key only. The subscriber would have to act accordingly.
 *  - This may need some way to track which node originates a published event to prevent looping.
 */
function RedisPublisher(cls, client) {
  var mdl = cls._mdl.plugin("RedisPublisher", "Publish object change events to Redis");
  this.nodeid = mdl.option('nodeid');
  if (!this.nodeid) {
    this.nodeid = mdl.option('nodeid', uuid.v4());
  }
  this.client = client;

  mdl.on('purge', this.purge.bind(this));
  mdl.on('save', this.save.bind(this));
  mdl.on('delete', this.delete.bind(this));
}

/**
 * Purge all objects of this type from redis
 *
 * @param {ModelEvent} event The purge event to handle
 */
RedisPublisher.prototype.purge = function(event) {
  /* Key should look like MyObject:purge */
  var chan = event.target.getKey("purge");
  this.client.publish(chan, this.nodeid);
};

/**
 * Save an object to Redis.
 *
 * @param {ModelEvent} event The save event to handle
 */
RedisPublisher.prototype.save = function(event) {
  /* Key should look like MyObject:id:save */
  var chan = event.target.self.getKey(event.target.id + ":save");
  this.client.publish(chan, this.nodeid);
};

/**
 * Remove an object.
 *
 * @param {ModelEvent} event The delete event to handle
 */
RedisPublisher.prototype.delete = function(event) {
  /* Key should look like MyObject:id:delete */
  var chan = event.target.self.getKey(event.target.id + ":save");
  this.client.publish(chan, this.nodeid);
};

module.exports = function(cls, client) {
  new RedisPublisher(cls, client);
};
