var async = require('async');
var should = require('should');
var client = require('fakeredis').createClient(null, null, {fast: true});
var Model = require('../lib/Model.js');
var RedisStore = require('../lib/RedisStore.js');

function TestModel() {}
TestModel.properties = ['foo', 'bar'];
Model(TestModel, TestModel.properties);
RedisStore(TestModel, client);

describe("Model utility functions", function() {
  it("generates seqential identifiers", function() {
    var seq1 = Model.sequence();
    seq1().should.be.exactly("0");
    seq1().should.be.exactly("1");

    var seq2 = Model.sequence();
    seq2().should.be.exactly("0");
    seq2().should.be.exactly("1");
    seq1().should.be.exactly("2");
  });

  it("generate UUIDs by default", function() {
    (typeof TestModel._mdl.idgen()).should.be.exactly("string");
    TestModel._mdl.idgen().should.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  });
});

describe("Model class", function(done) {
  beforeEach(function(done) {
    TestModel.purge(done);
  });

  it("has expected static methods", function() {
    (typeof TestModel.get).should.be.exactly("function");
    (typeof TestModel._mdl.idgen).should.be.exactly("function");
    (typeof TestModel.getKey).should.be.exactly("function");
  });

  it("has expected instance methods", function() {
    var test = new TestModel();
    (typeof test.save).should.be.exactly("function");
    (typeof test.toObject).should.be.exactly("function");
  });

  it("(C)reates objects as redis hashes", function(done) {
    var test = new TestModel();
    test.foo = "test one";
    test.bar = 234;
    test.save(function(err, res) {
      if (err) done(err);

      res.should.be.true;

      client.hgetall(TestModel.getKey(test.id), function(err, res) {
        if (err) done(err);

        res.foo.should.be.exactly(test.foo);
        res.bar.should.be.exactly(String(test.bar));
        res.should.not.be.eql(test);
        done();
      });
    }).then(function(result) {
      // Don't need to re-test the result, just that the callback and promise return the same thing.
      result.should.be.true;
    }, function(error) {
      done(error);
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
        res.bar.should.be.exactly(String(test.bar));
        done();
      }).then(function(res) {
        res.id.should.be.exactly(test.id);
        res.foo.should.be.exactly(test.foo);
        res.bar.should.be.exactly(String(test.bar));
      }, function(error) {
        done(error);
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
          should(res[0]).be.exactly(null);
          res[1].should.be.exactly(0);
          done();
        });
      });
    });
  });

  it("Can retrieve several objects at once", function(done) {
    var times = 5;
    async.times(times, function(n, next) {
      var mdl = new TestModel();
      mdl.save(function(err, res) {
        if (err) done(err);

        next(err, mdl.id);
      });
    }, function(err, ids) {
      TestModel.get(ids, function(err, res) {
        if (err) done(err);

        res.length.should.be.exactly(times);
        for (var i = 0; i < ids.length; i++) {
          res[i].id.should.be.exactly(ids[i]);
        }
        done();
      });
    });
  });

  it("Can enumerate keys", function(done) {
    var times = 5;
    async.times(times, function(n, next) {
      var mdl = new TestModel();
      mdl.save(function(err, res) {
        if (err) done(err);
        next(err, mdl.id);
      });
    }, function(err, ids) {
      TestModel.all(function(err, res) {
        if (err) done(err);

        res.length.should.be.exactly(times);
        for (var i = 0 ; i < ids.length; i++) {
          res.indexOf(ids[i]).should.not.eql(-1);
        }

        done();
      });
    });
  });
});
