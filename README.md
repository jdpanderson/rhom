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

```javascript
function User() {};
function Group() {};
function Permission() {};

rhom(User, ['username'], client);
rhom(Group, ['name'], client);
rhom(Permission, ['label'], client);

rhom.relates(User).toOne(Group); // 1 to 1. Getter is get<Classname>
rhom.relates(Group).toMany(Permission); // 1 to N. Getter is pluralized get<Classnames>.
rhom.relates(User).via(Group).toMany(Permission); // Indirect

var user1 = /* retrieved instance of User */;
user1.getGroup(function(err, group) {
	if (err) return;

	if (!group) return; // if available, should be a related instance of group

	groups.getPermissions(function(err, permissions) {
		if (err) return;

		permissions; // should be a list of related O3 instances. 
	});
});

user1.getPermissions(function(err, permissions) {
	permissions; // should be a list of indirectly prelated permission instances.
});

/* Ridiculous amounts of chaining should be possible, but only two levels is tested. */
// If these were defined models.
// rhom.relates(User).via(Group).via(Permission).via(x).via(y)toOne(Something);
// toMany also works, but all intermediaries must be defined as one-to-one.
// or
// rhom.relates(User).via([Group, Permission, x, y]).toOne(Something); // Same thing.

/* In case you're curious */
Group.getUser(); // Reverse relationship is not automatically defined.
User.getPermission(); // Singular would not be defined; toMany is pluralized.
```

Notes:
 * Relationships will let you shoot yourself in the foot. If you don't define a relationship and try to call it (e.g. intermediaries), it will blow up.
 * Indirect relationships don't populate writer functions. This is partially because setting an indirect relation would also implicitly set a direct relationship on two other classes that may not have intended it. To give an example based on the sample code above, if user.addPermission() existed you would logically think it would add a permission for that user. It would, but it would also add it for the user's entire group - which isn't obvious. user.getGroup().addPermission() is much clearer.


Indexing
--------

Adds an equality index so that fields can be searched quickly.

```javascript
function User() {};
rhom(User, ['username', 'password', 'name', 'email'], client);
rhom.index(User, "username", client); // Creates User.getByUsername();
rhom.index(User, "email", client); // Creates User.getByEmail();

User.getByUsername('jsmith', function(err, users) {
	if (err) return;

	if (!users) return; // If available, should be a list of users with the given username.
});
```

Promises
========

All the getters on the base object should return promises. Not currently recommended, as some of the periphery modules don't use them yet.

```javascript
Cls.get('foo').then(function(obj) {
	// Do something with the retreived object.
}, function(err) {
	// Do something with the error	
});
// Should work for all asynchronous calls: get/all/purge/save/delete.
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