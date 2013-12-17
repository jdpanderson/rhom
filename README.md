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
user1.save(); // Saves a hash at key MyUserModel:id

/* Retrieve */
var copy1 = MyUserModel.get(someidentifier');

/* Update */
copy1.email = "jsmith@yahoo.com";
copy1.save();

/* Delete */
copy1.delete();
// Hash underlying user1 is also gone, because they're the same.
``` 

Adding local caching to the above:
```javascript
// Where previously we used this line:
rhom(MyUserModel, ['id', 'name', 'email'], client);

// Simply add this line:
rhom.cache(MyUserModel, 60); // 60 second cache, or leave out for infinite cache.
```