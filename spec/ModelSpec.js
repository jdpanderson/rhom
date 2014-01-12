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

describe("Model class", function(done) {
  beforeEach(function(done) {
    TestModel.purge(done);
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

  it("(C)reates objects as redis hashes", function(done) {
    var test = new TestModel();
    test.foo = "test one";
    test.bar = 234;
    test.save(function(err, res) {
      if (err) done(err);

      client.hgetall(TestModel.getKey(test.id), function(err, res) {
        if (err) done(err);
        expect(res.foo).toBe(test.foo);
        expect(res.bar).toBe(new String(test.bar).valueOf());
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
        expect(res.foo).toBe(test.foo);
        expect(res.bar).toBe(new String(test.bar).valueOf());
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
          expect(res.foo).toBe(test.foo);
          done();
        });
      });
    });
  });

  it("(D)eletes objects", function(done) {
    test = new TestModel();
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

  it("Can retrieve several objects at once", function() {
    var saved = 0, result, ids = [];
    runs(function() {
      for (var i = 0; i < 5; i++) {
        var mdl = new TestModel();
        mdl.save(function() { saved++; });
        ids.push(mdl.id);
      }
    });

    waitsFor(function() {
      return saved == 5;
    }, "All objects to be saved");

    runs(function() {
      TestModel.get(ids, function(err, res) {
        result = res;
      });
    });

    waitsFor(function() {
      return result !== undefined;
    }, "Objects to be returned", 500);

    runs(function() {
      expect(result.length).toBe(saved);
      for (var i = 0; i < ids.length; i++) {
        expect(result[i].id).toBe(ids[i]);
      }
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
