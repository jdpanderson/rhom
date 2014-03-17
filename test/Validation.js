var should = require('should');
var client = require('fakeredis').createClient(null, null, {fast: true});
var rhom = require('../index.js');
var Promise = require('bluebird');

function TestModel() {}
TestModel.properties = ['foo', 'bar'];
rhom(TestModel, TestModel.properties, client).validation({
	foo: {
		required: true,
		type: 'string'
	},
	bar: {
		type: 'string'
	}
});

var once = false;

describe("Model validation", function() {
  it("Doesn't interfere with valid objects", function(done) {
  	var t = new TestModel();
  	t.foo = "user@host.com";
  	t.save(function(err, res) {
      err ? done(err) : res;
    }).then(function(success) {
  		done();
  	}, function(error) {
      done(error);
  	});
  });

  it("Doesn't save objects with errors", function(done) {
    var t = new TestModel();
    t.foo = "user@host.com";
    t.bar = 123;

    t.save(function(err, res) {
      err ? done() : done("Expected an error");
    }).then(function(s) {}, function(e) {});
  });
});
