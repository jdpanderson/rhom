var async = require('async');
var should = require('should');
var client = require('fakeredis').createClient(null, null, {fast: true});
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
        res.foo.should.be.exactly(test.foo);
        res.bar.should.be.exactly(String(test.bar));
        res.should.not.be.eql(test);
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
        res.id.should.be.exactly(test.id);
        res.foo.should.be.exactly(test.foo);
        res.bar.should.be.exactly(test.bar);
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

          res.id.should.be.exactly(test.id);
          res.foo.should.be.exactly(test.foo);
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
          should(res[0]).be.exactly(null);
          res[1].should.be.exactly(0);
          done();
        });
      });
    });
  });

  /**
   * Save two objects, get them to make sure they're cached, then delete to make sure they're actually coming from cache.
   */
  it("Can retrieve multiple cached entries", function(done) {
    var test1 = new TestModel();
    test1.foo = "first";
    test1.save(function(err, result) {
      if (err) return done(err);

      var test2 = new TestModel();
      test2.foo = "second";
      test2.save(function(err, result) {
        if (err) return done(err);

        TestModel.get(test1.id, function(err, result) {
          if (err) return done(err);

          result.foo.should.be.exactly(test1.foo);

          TestModel.get([test1.id, test2.id], function(err, result) {
            if (err) return done(err);

            result[0].foo.should.be.exactly(test1.foo);
            result[1].foo.should.be.exactly(test2.foo);

            client.del(TestModel.getKey(test1.id), function(err, result) {
              if (err) return done(err);

              TestModel.get([test1.id, test2.id], function(err, result) {
                if (err) return done(err);

                result[0].foo.should.be.exactly(test1.foo);
                result[1].foo.should.be.exactly(test2.foo);

                done();
              });
            });
          });
        });
      });
    });
  });
});
