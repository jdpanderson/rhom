var client = require('fakeredis').createClient();
var Model = require('../lib/Model.js');
var Cache = require('../lib/Cache.js');

function TestModel() {}
TestModel.properties = ['foo', 'bar'];
Model(TestModel, TestModel.properties, client);
Cache(TestModel);

/**
 * The tests here are essentially a copy of the ModelSpec cases - they verify that the cached model works more or less like the plain model.
 *
 * @todo Verify that the data is actually saved to and retrieved from the cache.
 */
describe("Cached Model class", function() {
	beforeEach(function() {
		var purged = false;
		runs(function() {
			TestModel.purge(function() { purged = true; });
		});

		waitsFor(function() {
			return purged;
		});
	});

	it("(C)reates objects as redis hashes", function() {
		var saved = false, test, obj;
		runs(function() {
			test = new TestModel();
			test.foo = "test one";
			test.bar = 234;
			test.save(function(err, res) {
				if (res) saved = true;
			});
		});

		waitsFor(function() { return saved; }, "Object to be saved", 500);

		runs(function() {
			client.hgetall(TestModel.getKey(test.id), function(err, res) {
				obj = res;
			});
		});

		waitsFor(function() { return obj !== undefined; }, "Object to be populated", 500);

		runs(function() {
			expect(obj.foo).toEqual(test.foo);
			expect(obj.bar).toEqual(new String(test.bar).valueOf());
			expect(obj).not.toBe(test);
		});
	});

	it("(R)etrieves saved objects", function() {
		var saved = false, copy, test;
		runs(function() {
			test = new TestModel();
			test.foo = "test one two three";
			test.bar = 23456;
			test.save(function() { saved = true; });
		});

		waitsFor(function() {
			return saved;
		}, "The object to be saved", 500);

		runs(function() {
			TestModel.get(test.id, function(err, res) {
				copy = res;
			});
		});

		waitsFor(function() {
			return (copy !== undefined);
		}, "The copy to be returned", 500);

		runs(function() {
			expect(copy.id).toBe(test.id);
			expect(copy.foo).toEqual(test.foo);
			expect(copy.bar).toEqual(test.bar);			
		});
	});

	it("(U)pdates objects", function() {
		var saved = false, copy, test;
		runs(function() {
			test = new TestModel();
			test.foo = "First save";
			test.save(function() { saved = true; });
		});

		waitsFor(function() {
			return saved;
		}, "The object to be saved", 500);

		runs(function() {
			saved = false;
			test.foo = "Updated value";
			test.save(function() { saved = true});
		});

		waitsFor(function() {
			return saved;
		}, "The object to be updated", 500);

		runs(function() {
			TestModel.get(test.id, function(err, res) {
				copy = res;
			});
		});

		waitsFor(function() {
			return (copy !== undefined);
		}, "The copy to be retrieved", 500);

		runs(function() {
			expect(copy.id).toBe(test.id);
			expect(copy.foo).toEqual(test.foo);
		});
	});

	it("(D)eletes objects", function() {
		var saved = false, test, result;
		runs(function() {
			test = new TestModel();
			test.save(function() { saved = true; });
		});

		waitsFor(function() {
			return saved;
		}, "Object to be saved", 500);

		runs(function() {
			saved = false;
			test.delete(function() { saved = true; });
		});

		waitsFor(function() {
			return saved;
		}, "Object to be deleted", 500);

		runs(function() {
			var m = client.multi();
			var k = TestModel.getKey(test.id);
			m.hgetall(k);
			m.sismember(TestModel.getKey('all'), k);
			m.exec(function(err, res) {
				result = res;
			});
		});

		waitsFor(function() {
			return result !== undefined;
		}, "Data comes back from Redis", 500);

		runs(function() {
			expect(result[0]).toEqual(null);
			expect(result[1]).toBe(0);
		});
	});
});
