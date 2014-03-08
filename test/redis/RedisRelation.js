var async = require('async');
var should = require('should');
var client = require('fakeredis').createClient(null, null, {fast: true});
var rhom = require('../../index.js');

/**
 * Create a fake example where:
 * - A user has one role, for testing one-to-one relationships.
 * - A role has many permissions, for testing one-to-many relationships.
 * - A role has one setting hash (i.e. several settings, stored in one hash)
 * - A user, through role, has one setting hash. Tests indirect one-to-one.
 * - A user, through role, has many permissions. Tests indirect one-to-many.
 * - A user, through role and setting, has one default. Tests a contrived deep-relation.
 */
function User() {};
function Role() {};
function Setting() {};
function Default() {};
function Permission() {};

var userModel = rhom(User, ['name'], client);
userModel.relates.toOne(Role);
userModel.relates.via(Role).toOne(Setting);
userModel.relates.via(Role).via(Setting).toOne(Default);
userModel.relates.via(Role).toMany(Permission);

var roleModel = rhom(Role, ['label'], client);
roleModel.relates.toMany(Permission);
roleModel.relates.toOne(Setting);

rhom(Setting, ['pref'], client).relates.toOne(Default);
rhom(Default, ['dflt'], client);
rhom(Permission, ['desc'], client);

var user, role, setting, dflt, perm1, perm2;

function setup(done) {
  user = new User();
  user.name = "foo";

  role = new Role();
  role.label = "bar";

  setting = new Setting();
  setting.pref = "blah";

  perm1 = new Permission();
  perm1.desc = "baz1";

  perm2 = new Permission();
  perm2.desc = "baz1";

  dflt = new Default();
  dflt.dflt = "exhausting";
  
  async.parallel(
    [
      function(cb) { user.save(cb); },
      function(cb) { role.save(cb); },
      function(cb) { setting.save(cb); },
      function(cb) { perm1.save(cb); },
      function(cb) { perm2.save(cb); },
      function(cb) { dflt.save(cb); }
    ],
    function(err, results) {
      err ? done(err) : done();
    }
  );
};

function additionalSetup(done) {
  async.parallel(
    [
      function(cb) { user.setRole(role, cb); },
      function(cb) { role.setSetting(setting, cb); },
      function(cb) { role.addPermission(perm1, cb); },
      function(cb) { role.addPermission(perm2, cb); },
      function(cb) { setting.setDefault(dflt, cb); }
    ],
    function(err, results) {
      err ? done(err) : done();
    }
  );
}

function cleanup(done) {
  async.parallel(
    [
      function(cb) { User.purge(cb); },
      function(cb) { Role.purge(cb); },
      function(cb) { Permission.purge(cb); },
      function(cb) { Default.purge(cb); },
      function(cb) { Setting.purge(cb); }
    ],
    function(err, results) {
      err? done(err) : done();
    }
  );
}

describe("One to one model relationships", function(done) {
  /* Set up a basic set of objects with which to test. */
  before(function(done) {
    setup(done);
  });
  
  it("Return null when no related object is set", function(done) {
    user.getRole(function(err, res) {
      should(err).be.exactly(null);
      should(res).be.exactly(null);
      done();
    });
  });

  it("Setter saves a related object", function(done) {
    user.setRole(role, function(err, res) {
      should(err).be.exactly(null);
      res.should.be.true;
      done();
    });
  });

  it("Getter retrieves a related object", function(done) {
    user.getRole(function(err, res) {
      should(err).be.exactly(null);
      res.id.should.be.equal(role.id);
      done();
    });
  });

  it("Setter can remove relations with a null value", function(done) {
    user.setRole(null, function(err, res) {
      should(err).be.exactly(null);
      res.should.be.true;
      user.getRole(function(err, res) {
        should(err).be.exactly(null);
        should(res).be.exactly(null);
        done();
      });
    });
  });

  after(function(done) {
    cleanup(done);
  });
});

describe("One to many model relationships", function(done) {
  before(function(done) {
    setup(done);
  });

  it("Returns an empty array when no relationships are set", function(done) {
    role.getPermissions(function(err, res) {
      should(err).be.exactly(null);
      should(res instanceof Array).be.true;
      done();
    });
  });

  it("Adds multiple related objects", function(done) {
    role.addPermission(perm1, function(err, res) {
      should(err).be.exactly(null);
      res.should.be.true;
      role.getPermissions(function(err, res) {
        should(err).be.exactly(null);
        should(res instanceof Array).be.true;
        res.length.should.be.exactly(1);
        res[0].id.should.be.exactly(perm1.id);
        role.addPermission(perm2, function(err, res) {
          should(err).be.exactly(null);
          res.should.be.true;
          role.getPermissions(function(err, res) {
            should(err).be.exactly(null);
            should(res instanceof Array).be.true;
            res.length.should.be.exactly(2);
            should(res[0].id === perm1.id || res[0].id === perm2.id).be.true;
            should(res[1].id === perm1.id || res[1].id === perm2.id).be.true;
            should(res[0].id !== res[1].id).be.true;
            done();
          });
        });
      });
    });
  });

  it("Removes related objects", function(done) {
    role.removePermission(perm2, function(err, res) {
      should(err).be.exactly(null);
      res.should.be.true;
      role.getPermissions(function(err, res) {
        should(err).be.exactly(null);
        should(res instanceof Array).be.true;
        res.length.should.be.exactly(1);
        res[0].id.should.be.exactly(perm1.id);
        done();
      });
    });
  });

  it("Doesn't care if you try to remove a relation twice", function(done) {
    role.removePermission(perm2, function(err, res) {
      should(err).be.exactly(null);
      res.should.be.true;
      done();
    });
  });

  it("Removes related objects by id", function(done) {
    role.removePermission(perm1.id, function(err, res) {
      should(err).be.exactly(null);
      res.should.be.true;
      role.getPermissions(function(err, res) {
        should(err).be.exactly(null);
        should(res instanceof Array).be.true;
        res.length.should.be.exactly(0);
        done();
      });
    });
  });

  after(function(done) {
    cleanup(done);
  });
});

describe("Indirect model relationships", function(done) {
  before(function(done) {
    setup(done);
  });
  before(function(done) {
    additionalSetup(done);
  });

  it("Fetches indirect relations", function(done) {
    user.getSetting(function(err, res) {
      should(err).be.exactly(null);
      should(res instanceof Setting).be.true;
      res.pref.should.be.exactly(setting.pref);
      res.id.should.be.exactly(setting.id);
      done();
    });
  });

  it("Fetches multiple levels of indirect relations", function(done) {
    user.getDefault(function(err, res) {
      should(err).be.exactly(null);
      should(res instanceof Default).be.true;
      res.dflt.should.be.exactly(dflt.dflt);
      res.id.should.be.exactly(dflt.id);
      done();
    });
  });

  it("Fetches one-to-many relationships", function(done) {
    user.getPermissions(function(err, res) {
      should(err).be.exactly(null);
      should(res instanceof Array).be.true;
      res.length.should.be.exactly(2);
      should(res[0].id === perm1.id || res[0].id === perm2.id).be.true;
      should(res[1].id === perm1.id || res[1].id === perm2.id).be.true;
      done();
    });
  });

  after(function(done) {
    cleanup(done);
  });
});

describe("Regression tests", function() {
  /**
   * Doing a get where the reference has been left hanging cleans up automatically.
   */
  it("Cleans up dead-ends (to-one relation)", function(done) {
    var user = new User();
    user.id = "u";
    user.name = "uname";

    var role = new Role();
    role.id = "r";
    role.label = "rlabel";

    async.parallel(
      [
        function(cb) { user.save(cb); },
        //function(cb) { role.save(cb); }, // Point of this test is to leave a link hanging.
        function(cb) { user.setRole(role, cb); }
      ],
      function(err, res) {
        if (err) return done(err);

        user.getRole(function(err, res) {
          if (err) return done(err);

          client.getKeyspace({map: true}, function(err, res) {
            if (err) return done(err);

            res['User:u'].should.be.eql(['name', 'uname']);
            should(res['User:u:Role']).be.undefined;
            done();
          });
          
        });
      }
    );
  });

    /**
   * Doing a get where the reference has been left hanging cleans up automatically.
   */
  it("Cleans up dead-ends (to-many relation)", function(done) {
    var role = new Role();
    role.id = "r";
    role.label = "rlabel";

    var perm = new Permission();
    perm.id = "p";
    perm.desc = "pdesc";

    async.parallel(
      [
        function(cb) { role.save(cb); },
        //function(cb) { perm.save(cb); }, // Point of this test is to leave a link hanging.
        function(cb) { role.addPermission(perm, cb); }
      ],
      function(err, res) {
        if (err) return done(err);

        role.getPermissions(function(err, res) {
          if (err) return done(err);

          client.getKeyspace({map: true}, function(err, res) {
            if (err) return done(err);

            res['Role:r'].should.be.eql(['label', 'rlabel']);
            should(res['Role:r:Permissions']).be.undefined;
            done();
          });
          
        });
      }
    );
  });

  /* Regression test: add a bunch of objects and test the structure manually.  */
  // XXX NOT DONE
  it("Generates expected structure in redis", function(done) {
    var user = new User();
    user.id = "u";
    user.name = "uname";

    var role = new Role();
    role.id = "r";
    role.label = "rlabel";

    var perm = new Permission();
    perm.id = "p";
    perm.desc = "pdesc";

    async.parallel(
      [
        function(cb) { user.save(cb); },
        function(cb) { role.save(cb); },
        function(cb) { perm.save(cb); },
        function(cb) { user.setRole(role, cb); },
        function(cb) { role.addPermission(perm, cb); }
      ],
      function(err, res) {
        if (err) return done(err);

        client.getKeyspace({map: true}, function(err, res) {
          res.should.be.eql({
            'Permission:all': [ 'p' ],
            'Permission:p': [ 'desc', 'pdesc' ],
            'Role:all': [ 'r' ],
            'Role:r': [ 'label', 'rlabel' ],
            'Role:r:Permissions': [ 'p' ],
            'User:all': [ 'u' ],
            'User:u': [ 'name', 'uname' ],
            'User:u:Role': 'r' }
          );
          //console.log(res);
          done();
        });
      }
    );
  });
});