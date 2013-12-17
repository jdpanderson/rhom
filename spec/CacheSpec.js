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
describe("Cached Model class", function(done) {
	beforeEach(function(done) {
		TestModel.purge(done);
	});

	it("(C)reates objects as redis hashes", function(done) {
		var test = new TestModel();
		test.foo = "test one";
		test.bar = 234;
		test.save(function(err, res) {
			if (err) done(err);

			client.hgetall(TestModel.getKey(test.id), function(err, res) {
				if (err) done(err);
				expect(res.foo).toEqual(test.foo);
				expect(res.bar).toEqual(new String(test.bar).valueOf());
				expect(res).not.toBe(test);
				done();
			});
		});
	});

	it("(R)etrieves saved objects", function(done) {
		var test = new TestModel();
		test.foo = "test one two three";
		test.bar = 23456;
		test.save(function(err) {
			if (err) done(err);

			TestModel.get(test.id, function(err, res) {
				if (err) done(err);
				expect(res.id).toBe(test.id);
				expect(res.foo).toEqual(test.foo);
				expect(res.bar).toEqual(test.bar);
				done();
			});
		});
	});

	it("(U)pdates objects", function(done) {
		var test = new TestModel();
		test.foo = "First save";
		test.save(function(err) {
			if (err) done(err);
			test.foo = "Updated value";

			test.save(function(err) {
				if (err) done(err);

				TestModel.get(test.id, function(err, res) {
					if (err) done(err);
					expect(res.id).toBe(test.id);
					expect(res.foo).toEqual(test.foo);
					done();
				});
			});
		});
	});

	it("(D)eletes objects", function(done) {
		var test = new TestModel();
		test.save(function(err) {
			if (err) done(err);

			test.delete(function(err) {
				if (err) done(err);
				var m = client.multi();
				var k = TestModel.getKey(test.id);
				m.hgetall(k);
				m.sismember(TestModel.getKey('all'), k);

				m.exec(function(err, res) {
					if (err) done(err);
					expect(res[0]).toEqual(null);
					expect(res[1]).toBe(0);
					done();
				});
			});
		});
	});
});
