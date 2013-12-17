var client = require('fakeredis').createClient(null, null, {fast: true});
var Model = require('../lib/Model.js');

function TestModel() {}
TestModel.properties = ['foo', 'bar'];
Model(TestModel, TestModel.properties, client);

describe("Model utility functions", function() {
	it("generate seqential identifiers", function() {
		var seq1 = Model.sequence();
		expect(seq1()).toBe("0");
		expect(seq1()).toBe("1");
		var seq2 = Model.sequence();
		expect(seq2()).toBe("0");
		expect(seq2()).toBe("1");
		expect(seq1()).toBe("2");
	});
	it("generate UUIDs by default", function() {
		expect(typeof(TestModel.idgen())).toBe("string");
		expect(TestModel.idgen()).toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
	});
});

describe("Model class", function() {
	beforeEach(function() {
		var purged = false;
		runs(function() {
			TestModel.purge(function() { purged = true; });
		});

		waitsFor(function() {
			return purged;
		});
	});

	it("has expected static methods", function() {
		expect(typeof(TestModel.get)).toBe("function");
		expect(typeof(TestModel.idgen)).toBe("function");
		expect(typeof(TestModel.getKey)).toBe("function");
	});

	it("has expected instance methods", function() {
		var test = new TestModel();
		expect(typeof(test.save)).toBe("function");
		expect(typeof(test.toObject)).toBe("function");
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
			expect(obj.foo).toBe(test.foo);
			expect(obj.bar).toBe(new String(test.bar).valueOf());
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
			expect(copy.foo).toBe(test.foo);
			expect(copy.bar).toBe(new String(test.bar).valueOf());			
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
			expect(copy.foo).toBe(test.foo);
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

	it("Can enumerate keys", function() {
		var saved = 0, keys;
		runs(function() {
			for (var i = 0; i < 5; i++) {
				(new TestModel()).save(function() { saved++ });
			}
		});

		waitsFor(function() {
			return saved == 5;
		}, "All objects to be saved");

		runs(function() {
			TestModel.all(function(err, res) {
				keys = res;
			});
		});

		waitsFor(function() {
			return keys !== undefined;
		}, "Keys to be returned", 500);

		runs(function() {
			expect(keys.length).toBe(saved);
		});
	});
});
