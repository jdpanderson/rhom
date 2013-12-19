var client = require('fakeredis').createClient(null, null, {fast: true});
var Model = require('../lib/Model.js');
var Relation = require('../lib/Relation.js');

function User() {};
function Role() {};
function Permission() {};

Model(User, ['name'], client);
Model(Role, ['label'], client);
Model(Permission, ['desc'], client);

Relation(User).toOne(Role);
Relation(User).toMany(Permission);

describe("One-to-one model relationship", function(done) {
	/* Set up a basic set of objects with which to test. */
	var saved = 0, user, role, perm1, perm2;
	runs(function() {
		user = new User();
		user.name = "foo";
		user.save(function(err, res) { if (!err) saved++; });

		role = new Role();
		role.label = "bar";
		role.save(function(err, res) { if (!err) saved++; });

		perm1 = new Permission();
		perm1.desc = "baz1";
		perm1.save(function(err, res) { if (!err) saved++; });

		perm2 = new Permission();
		perm2.desc = "baz1";
		perm2.save(function(err, res) { if (!err) saved++; });
	});

	waitsFor(function() {
		return (saved == 4);
	}, 500, "Test objects to be saved.");
	
	it("Returns null when no related object is set", function(done) {
		user.Role(function(err, res) {
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
		user.Role(function(err, res) {
			expect(err).toBe(null);
			expect(res.id).toBe(role.id);
			done();
		});
	});

	it("Setter can remove relations with a null value", function(done) {
		user.setRole(null, function(err, res) {
			expect(err).toBe(null);
			expect(res).toBe(true);
			user.Role(function(err, res) {
				expect(err).toBe(null);
				expect(res).toBe(null);
				done();
			});
		});
	})
});