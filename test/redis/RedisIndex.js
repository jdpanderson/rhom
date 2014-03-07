var should = require('should');
var async = require('async');
var client = require('fakeredis').createClient(null, null, {fast: true});
var rhom = require('../../index.js');
var crypto = require('crypto');

function TestModel() {}
TestModel.properties = ['foo', 'bar'];
rhom(TestModel, TestModel.properties, client);
rhom.index(TestModel, "foo", client);

/**
 * The tests here are essentially a copy of the ModelSpec cases - they verify that the cached model works more or less like the plain model.
 *
 * @todo Verify that the data is actually saved to and retrieved from the cache.
 */
describe("Indexed Model class", function(done) {
  beforeEach(function(done) {
    TestModel.purge(done);
  });

  it("has an autogenerated getter", function() {
    (typeof TestModel.getByFoo).should.be.exactly("function");
  });

  it("saves and retrieves values by index", function(done) {
    var t = new TestModel();
    t.foo = "blah";
    t.bar = "asdf";
    t.save(function(err, res) {
      if (err) return done(err);

      /* Allow the afterSave handler to finish. */
      setTimeout(function() {
        TestModel.getByFoo("blah", function(err, res) {
          res.length.should.be.exactly(1);
          res[0].foo.should.be.exactly("blah");
          done();
        });
      }, 0);
    });
  });

  it("updates index values", function(done) {
    var t = new TestModel();
    t.foo = "blah";
    t.bar = "asdf";

    var t2 = new TestModel();
    t.foo = "other 1";
    t.bar = "other 2";

    async.parallel(
      [
        function(cb) { t.save(cb); },
        function(cb) { t2.save(cb); }
      ],
      function(err, res) {
        if (err) return done(err);

        t.foo = "updated value";
        t.save(function(err, res) {
          if (err) return done(err);

          setTimeout(function() {
            TestModel.getByFoo("updated value", function(err, res) {
              if (err) return done(err);

              res.length.should.be.exactly(1);
              res[0].foo.should.be.exactly("updated value");

              TestModel.getByFoo("blah", function(err, res) {
                  if (err) return done(err);

                  res.length.should.be.exactly(0);
                  done();
              });
            });
          }, 0);
        });
      }
    );
  });

  it("Deletes objects from the index set when the object itself is deleted", function(done) {
    var t = new TestModel();
    t.foo = "bar";
    t.bar = "baz";

    /* XXX this is a copy/paste from the internal impl */
    var hash = crypto.createHash('sha256');
    hash.update("bar");
    var key = TestModel.getKey("ix:foo:" + hash.digest('hex').substr(0, 8));
    
    t.save(function(err, res) {
      if (err) return done(err);
      var id = t.id;

      setTimeout(function() {
        client.smembers(key, function(err, res) {
          if (err) return done(err);
          res.length.should.be.exactly(1);
          res[0].should.be.exactly(id);

          t.delete(function(err, res) {
            if (err) return done(err);
            res.should.be.exactly(true);

            setTimeout(function() {
              client.smembers(key, function(err, res) {
                res.length.should.be.exactly(0);
                done();
              });
            }, 0);
          });
        });
      }, 0);
    });
  });

  it("Bails out early if nothing is found", function(done) {
    var listener = function(evt) {
      TestModel._mdl.removeListener("get", listener);
      throw new Error("No get should have been executed.");
    };

    /* A little odd: hook into internal model event for testing. */
    TestModel._mdl.on("get", listener);

    TestModel.getByFoo("bar", function(err, res) {
      should(err).be.exactly(null);
      res.length.should.be.exactly(0);
      TestModel._mdl.removeListener("get", listener);
      done();
    });
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

            setTimeout(function() {
              client.getKeyspace({map: true}, function(err, res) {
                res.should.be.eql({
                  'TestModel:all': [ 't1', 't2' ],
                  'TestModel:ix:foo:6ba77d41': [ 't1' ],
                  'TestModel:ix:foo:977921b3': [ 't2' ],
                  'TestModel:t1': [ 'bar', 't2-bar', 'foo', 't1-foo' ],
                  'TestModel:t2': [ 'bar', 't2_bar', 'foo', 't2@foo' ]
                });
                done();
              });
            }, 0);
          }
        );
      }
    );
  });

});
