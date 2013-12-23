Redis Hash to Object Mapper
============================

This is a mixin that maps Redis hashes into user-defined objects and vice versa. Its intention is to provide a simple way to perform CRUD on Redis hashes with minimal interference; Redis is great, so details shouldn't be abstracted away to the point that direct client access is hacky.

Example
--------

Adding rhom functionality to a class:

```javascript
var rhom = require('rhom');
var client = require('redis').createClient();

function MyUserModel() {} // Define however you want.
rhom(MyUserModel, ['id', 'name', 'email'], client);

/* Create */
var user1 = new MyUserModel();
user1.name = "John Smith";
user1.email = "jsmith@gmail.com";
user1.save(function(err, res) {
	if (res) console.log("Saved");
}); // Saves a hash at key MyUserModel:id

/* Retrieve based on the autogenerated id from user1 */
var copy1;
MyUserModel.get(user1.id, function(err, res) {
	if (res) copy1 = res;
});

/* Update */
copy1.email = "jsmith@yahoo.com";
copy1.save(function(err, res) {
	if (res) console.log("Saved");
});

/* Delete */
copy1.delete(function(err, res) {
	if (res) console.log("Deleted");
});
// Hash underlying user1 is also gone, because they're the same.
``` 

Additional Mixins
=================

Additional mixins can be applied on top of the base mapper functionality. These include but are not limited to caching and relationships.

Transparent Caching
-------------------

Caching can be applied on top of base mapper functionality by applying the rhom.cache mixin:

```javascript
function MyUserModel() {}
rhom(MyUserModel, [/* properties */], client);
rhom.cache(MyUserModel, 30); /* Cache for 30 seconds. */
```

Relationships
-------------

While I'm not sure it's advisable (consider a relational database), it is possible to create relationships between mapped objects using the rhom.relates mixin. Relationships must be defined explicitly on every level, and relationships are limited. For example, a one-to-one relationship only creates method definitions on the source object. If the reverse is also desired, define that too - it isn't created automatically. Indirect relationships are also possible.

Relationships will also let you shoot yourself in the foot. If you don't define the relationship and try to call it, it will blow up.

```javascript
function O1() {};
function O2() {};
function O3() {};

rhom(O1, [], client);
rhom(O2, [], client);
rhom(O3, [], client);

rhom.relates(O1).toOne(O2); // 1 to 1. Getter is get<Classname>
rhom.relates(O2).toMany(O3); // 1 to N. Getter is pluralized get<Classnames>.
rhom.relates(O1).via(O2).toMany(O3); // Indirect

var o1 = /* retrieved instance of O1 */;
o1.getO2(function(err, o2) {
	if (err) return;

	o2; // should be a related instance of O2.

	o2.getO3s(function(err, o3s) {
		if (err) return;

		o3s; // should be a list of related O3 instances. 
	});
});

o1.getO3s(function(err, o3s) {
	o3s; // should be a list of related O3 instances.
});

/* Ridiculous amounts of chaining should be possible, but only two levels is tested. */
// If these were defined models.
// rhom.relates(O1).via(O2).via(O3).via(O4).via(O5)toOne(O6); // toMany also works, but intermediary must be defined one-to-one.
// or
// rhom.relates(O2).via([O2, O3, O4, O5]).toOne(O6); // Same thing.

/* In case you're curious */
o2.getO1(); // Reverse relationship would not be defined.
o1.getO3(); // Singular would not be defined. 
```

Caveats
=======

Function Definitions
--------------------

Classes must be defined using a named function definition, not an anonymous function assigned to a variable. The named function makes the .name property available, on which some functions rely.

```javascript
// Do this:
function MyClass() { /* ... */ }
MyClass.prototype = { /* ... */ }

// Not this:
var MyClass = function() { /* ... */ }
MyClass.prototype = { /* ... */ }
```

Cleanup
-------

Currently, some things don't clean up after themselves and may leave you with a dirty Redis database (relations for one).  I'm working on that, but this is a very early stage project.

Possible Additions 
==================

Some things I've thought about adding:
 * Local storage with event or pubsub based change tracking. This would be useful for multi-process node classes. (Something like keeping local copies that are automatically updated when changed in redis.)
 * Indexing, either local or using redis features.