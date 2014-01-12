var client = require('fakeredis').createClient(null, null, {fast: true});
var Model = require('../lib/Model.js');
var Relation = require('../lib/Relation.js');

/**
 * Create a fake example where:
 * - A user has one role, for testing one-to-one relationships.
 * - A role has many permissions, for testing one-to-many relationships.
 * - A role has one setting hash (i.e. several settings, stored in one hash)
 * - A user, through role, has one setting hash. Tests indirect one-to-one.
 * - A user, through role, has many permissions. Tests indirect one-to-many.
 */
function User() {};
function Role() {};
function Setting() {};
function Default() {};
function Permission() {};

Model(User, ['name'], client);
Model(Role, ['label'], client);
Model(Setting, ['pref'], client);
Model(Default, ['dflt'], client);
Model(Permission, ['desc'], client);

Relation(User).toOne(Role);
Relation(Role).toMany(Permission);
Relation(Role).toOne(Setting);
Relation(User).via(Role).toOne(Setting);
Relation(User).via(Role).via(Setting).toOne(Default); // Ridiculous multi-step dependency.
Relation(User).via(Role).toMany(Permission);
Relation(Setting).toOne(Default);

var saved = 0, user, role, setting, dflt, perm1, perm2;
function countResults(err, res) { if (!err) saved++; };

function setup() {
  user = new User();
  user.name = "foo";
  user.save(countResults);

  role = new Role();
  role.label = "bar";
  role.save(countResults);

  setting = new Setting();
  setting.pref = "blah";
  setting.save(countResults);

  perm1 = new Permission();
  perm1.desc = "baz1";
  perm1.save(countResults);

  perm2 = new Permission();
  perm2.desc = "baz1";
  perm2.save(countResults);

  dflt = new Default();
  dflt.dflt = "exhausting";
  dflt.save(countResults);
};

function setupDone() {
  if (saved == 6) {
    saved = 0;
    return true;
  }
  return false;
}

function additionalSetup() {
  user.setRole(role, countResults);
  role.setSetting(setting, countResults);
  role.addPermission(perm1, countResults);
  role.addPermission(perm2, countResults);
  setting.setDefault(dflt, countResults);
}

function additionalSetupDone() {
  if (saved == 5) {
    saved = 0;
    return true;
  }
  return false;
}

function cleanup() {
  User.purge(countResults);
  Role.purge(countResults);
  Permission.purge(countResults);
}

function cleanupDone() {
  if (saved == 3) {
    saved = 0;
    return true;
  }
  return false;
}

describe("One to one model relationships", function(done) {
  /* Set up a basic set of objects with which to test. */
  runs(setup);
  waitsFor(setupDone, 500, "Test objects to be saved.");
  
  it("Return null when no related object is set", function(done) {
    user.getRole(function(err, res) {
      expect(err).toBe(null);
      expect(res).toBe(null);
      done();
    });
  });

  it("Setter saves a related object", function(done) {
    user.setRole(role, function(err, res) {
      expect(err).toBe(null);
      expect(res).toBe(true);
      done();
    });
  });

  it("Getter retrieves a related object", function(done) {
    user.getRole(function(err, res) {
      expect(err).toBe(null);
      expect(res.id).toBe(role.id);
      done();
    });
  });

  it("Setter can remove relations with a null value", function(done) {
    user.setRole(null, function(err, res) {
      expect(err).toBe(null);
      expect(res).toBe(true);
      user.getRole(function(err, res) {
        expect(err).toBe(null);
        expect(res).toBe(null);
        done();
      });
    });
  });

  runs(cleanup);
  waitsFor(cleanupDone, 500, "Test objects to be cleaned up.");
});

describe("One to many model relationships", function(done) {
  runs(setup);
  waitsFor(setupDone, 500, "Test objects to be saved");

  it("Returns an empty array when no relationships are set", function(done) {
    role.getPermissions(function(err, res) {
      expect(err).toBe(null);
      expect(res instanceof Array).toBe(true);
      done();
    });
  });

  it("Adds multiple related objects", function(done) {
    role.addPermission(perm1, function(err, res) {
      expect(err).toBe(null);
      expect(res).toBe(true);
      role.getPermissions(function(err, res) {
        expect(err).toBe(null);
        expect(res instanceof Array).toBe(true);
        expect(res.length).toBe(1);
        expect(res[0].id).toBe(perm1.id);
        role.addPermission(perm2, function(err, res) {
          expect(err).toBe(null);
          expect(res).toBe(true);
          role.getPermissions(function(err, res) {
            expect(err).toBe(null);
            expect(res instanceof Array).toBe(true);
            expect(res.length).toBe(2);
            expect(res[0].id === perm1.id || res[0].id === perm2.id).toBe(true);
            expect(res[1].id === perm1.id || res[1].id === perm2.id).toBe(true);
            expect(res[0].id !== res[1].id).toBe(true);
            done();
          });
        });
      });
    });
  });

  it("Removes related objects", function(done) {
    role.removePermission(perm2, function(err, res) {
      expect(err).toBe(null);
      expect(res).toBe(true);
      role.getPermissions(function(err, res) {
        expect(err).toBe(null);
        expect(res instanceof Array).toBe(true);
        expect(res.length).toBe(1);
        expect(res[0].id).toBe(perm1.id);
        done();
      });
    });
  });

  it("Doesn't care if you try to remove a relation twice", function(done) {
    role.removePermission(perm2, function(err, res) {
      expect(err).toBe(null);
      expect(res).toBe(true);
      done();
    });
  });

  it("Removes related objects by id", function(done) {
    role.removePermission(perm1.id, function(err, res) {
      expect(err).toBe(null);
      expect(res).toBe(true);
      role.getPermissions(function(err, res) {
        expect(err).toBe(null);
        expect(res instanceof Array).toBe(true);
        expect(res.length).toBe(0);
        done();
      });
    });
  });

  runs(cleanup);
  waitsFor(cleanupDone, 500, "Test objects to be cleaned up");
});

describe("Indirect model relationships", function(done) {
  runs(setup);
  waitsFor(setupDone, 500, "Test objects to be saved.");
  runs(additionalSetup);
  waitsFor(additionalSetupDone, 500, "Additional relationships created.");

  it("Fetches indirect relations", function(done) {
    user.getSetting(function(err, res) {
      expect(err).toBe(null);
      expect(res instanceof Setting).toBe(true);
      expect(res.pref).toBe(setting.pref);
      expect(res.id).toBe(setting.id);
      done();
    });
  });

  it("Fetches multiple levels of indirect relations", function(done) {
    user.getDefault(function(err, res) {
      expect(err).toBe(null);
      expect(res instanceof Default).toBe(true);
      expect(res.dflt).toBe(dflt.dflt);
      expect(res.id).toBe(dflt.id);
      done();
    });
  });

  it("Fetches one-to-many relationships", function(done) {
    user.getPermissions(function(err, res) {
      expect(err).toBe(null);
      expect(res instanceof Array).toBe(true);
      expect(res.length).toBe(2);
      expect(res[0].id === perm1.id || res[0].id === perm2.id).toBe(true);
      expect(res[1].id === perm1.id || res[1].id === perm2.id).toBe(true);
      done();
    });
  });

  runs(cleanup);
  waitsFor(cleanupDone, 500, "Test objects to be cleaned up.");
});