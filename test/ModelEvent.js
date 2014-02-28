var ModelEvent = require('../lib/ModelEvent.js');
var should = require('should');
var util = require('util');

describe("Model Event class", function(done) {
  it("Exposes a expected properties (type, target, and data)", function() {
    var evt = new ModelEvent('@type', '@target', '@data');

    evt.type.should.be.exactly('@type');
    evt.target.should.be.exactly('@target');
    evt.data.should.be.exactly('@data');
    evt.handled.should.be.exactly(false);
  });

  it("Success is represented by both an event property and promise", function(done) {
    var sevt = new ModelEvent('type', 'tgt', 'data');

    sevt.promise.then(function(result) {
      result.should.be.exactly('successarg');
      done();
    }, function(error) {
      done("Error: " + error);
    });

    sevt.success('successarg');

    sevt.handled.should.be.exactly(true);
    sevt.result.should.be.exactly('successarg');
    should(sevt.error).be.exactly(null);
  });

  it("Error is represented by both an event property and promise", function(done) {
    var fevt = new ModelEvent('type', 'tgt', 'data');

    fevt.promise.then(function(result) {
      done("Result not expected");
    }, function(error) {
      error.should.be.exactly("errorarg");
      done();
    });

    fevt.failure('errorarg');

    fevt.handled.should.be.exactly(true);
    should(fevt.result).be.exactly(null);
    fevt.error.should.be.exactly('errorarg');
  });

  it("Enforces unmodifiable state once success/failure has occurred", function() {
    var evt = new ModelEvent('type', 'tgt', 'data');

    evt.success('test');

    evt.result.should.be.exactly('test');

    evt.success('should be a no-op');
    evt.failure('also a no-op')

    evt.result.should.be.exactly('test');
    should(evt.error).be.exactly(null);
  });

  it("Using the class wrong warns of breakage", function() {
    function ChildEvent() {}; // Doesn't call parent, so promise isn't initialized.
    util.inherits(ChildEvent, ModelEvent);

    var sevt = new ChildEvent();
    sevt.success('should result in an error');
    should(sevt.result).be.exactly(null);
    sevt.error.should.not.be.exactly(null);
    sevt.handled.should.be.exactly.true;

    var fevt = new ChildEvent();
    fevt.failure('should also result in an error');
    should(fevt.result).be.exactly(null);
    fevt.error.should.not.be.exactly(null);
    fevt.handled.should.be.exactly.true;
  })
});
