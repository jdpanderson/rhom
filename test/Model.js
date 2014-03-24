var async = require('async');
var should = require('should');
var client = require('fakeredis').createClient(null, null, {fast: true});
var rhom = require('../index.js');

function TestModel() {}
TestModel.properties = ['foo', 'bar'];
rhom(TestModel, TestModel.properties, client);

/* An object without defined properties just saves everything. */
function AnonModel() {}
rhom(AnonModel, undefined, client);

describe("Model utility functions", function() {
  it("generates seqential identifiers", function() {
    var seq1 = rhom.model.sequence();
    seq1().should.be.exactly("0");
    seq1().should.be.exactly("1");

    var seq2 = rhom.model.sequence();
    seq2().should.be.exactly("0");
    seq2().should.be.exactly("1");
    seq1().should.be.exactly("2");

    var seq3 = rhom.model.sequence(123);
    seq3().should.be.exactly("123");
    seq3().should.be.exactly("124");
    seq1().should.be.exactly("3");
  });

  it("generate UUIDs by default", function() {
    (typeof TestModel._mdl.idgen()).should.be.exactly("string");
    TestModel._mdl.idgen().should.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  });
});

describe("Model class", function(done) {
  beforeEach(function(done) {
    TestModel.purge(function(err, res) {
      AnonModel.purge(done)
    });
  });

  it("doesn't let the same plugin register twice", function(done) {
    var mdlBefore = TestModel._mdl;
    rhom.model(TestModel).should.be.exactly(mdlBefore);

    try {
      rhom.redis.store(TestModel, client);
    } catch (e) {
      return done();
    }
    done("Error never happened")
  });

  it("overrides only when asked", function() {
    function TmpModel() {};
    TmpModel.get = "keepme";
    TmpModel.prototype.save = "keepmetoo";
    rhom(TmpModel);

    TmpModel.get.should.be.exactly("keepme");
    TmpModel.prototype.save.should.be.exactly("keepmetoo");

    function TmpModel2() {};
    TmpModel2.get = "throw";
    TmpModel2.prototype.save = "throwalso";
    rhom(TmpModel2, [], client, { override: true });

    (typeof TmpModel2.get).should.be.exactly("function");
    (typeof TmpModel2.prototype.save).should.be.exactly("function");
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

  it("Can store arbitrary objects", function(done) {
    var anon = new AnonModel();
    anon.foo = "bar";
    anon.blah = "blah blah";
    anon.zippityDooDah = "zippity day!";

    anon.save(function(err, res) {
      if (err) return done(err);
      AnonModel.get(anon.id, function(err, anonCopy) {
        if (err) return done(err);

        should(anonCopy instanceof AnonModel).be.true;
        anonCopy.foo.should.be.exactly(anon.foo);
        anonCopy.blah.should.be.exactly(anon.blah);
        anonCopy.zippityDooDah.should.be.exactly(anon.zippityDooDah);
        done();
      });
    });
  });

  /* Regression test */
  it("Catches missing argument to getter", function(done) {
    TestModel.get(undefined, function(err, res) {
      err.should.not.be.null;
    }).then(function(result) {
      done("Result not expected")
    }, function(error) {
      done();
    });
  });

  it("Handles both promises and callbacks as first-class citizens", function(done) {
    /* Hook in a promise and make sure it does the same as the callback. */
    function EvtTst() {};
    rhom.model(EvtTst, ['a']);

    EvtTst._mdl.on("beforeGet", function(evt) { evt.failure("Test Error"); });
    EvtTst._mdl.on("beforeSave", function(evt) { evt.success("Test Success"); });
    EvtTst.get("irrelevant").then(
      function(s) { done("An error was expected, not success"); },
      function(e) {
        new EvtTst().save().then(
          function(s) { done(); },
          function(e) { done(e); }
        );
      }
    );
  });

  /* Regression test: add a bunch of objects and test the structure manually.  */
  it("Generates expected structure in redis", function(done) {
    var t1 = new TestModel();
    t1.id = "t1";
    t1.foo = "t1-foo";
    t1.bar = "t2-bar";

    var t2 = new TestModel();
    t2.id = "t2";
    t2.foo = "t2_foo";
    t2.bar = "t2_bar";

    var t3 = new TestModel();
    t3.id = "t3";
    t3.foo = "t3+foo";
    t3.bar = "t3+bar";

    async.parallel(
      [
        function(cb) { t1.save(cb); },
        function(cb) { t2.save(cb); },
        function(cb) { t3.save(cb); }
      ],
      function(err, res) {
        if (err) return done(err);

        t2.foo = "t2@foo";

        async.parallel(
          [
            function(cb) { t2.save(cb); },
            function(cb) { t3.delete(cb); }
          ],
          function(err, res) {
            if (err) return done(err);

            client.getKeyspace({map: true}, function(err, res) {
              res.should.be.eql({
                'TestModel:all': [ 't1', 't2' ],
                'TestModel:t1': [ 'bar', 't2-bar', 'foo', 't1-foo' ],
                'TestModel:t2': [ 'bar', 't2_bar', 'foo', 't2@foo' ]
              });
              done();
            });
          }
        );
      }
    );
  });
});
