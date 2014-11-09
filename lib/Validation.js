var validate = require('validate');

/**
 * Simple validator plugin.
 *
 * @param {Object} cls The rhom-ified class to extend with validation.
 * @param {Object} schema The expected schema. See https://github.com/eivindfjeldstad/validate
 */
function Validation(cls, schema) {
	var mdl = cls._mdl.plugin("Validator", "Basic object validation");

	var validator = validate(schema);

	mdl.on("beforeSave", function(event) {
    var errors = validator.validate(event.target);
    if (errors.length) {
      event.failure("Validation error(s): " + errors.join(", "));
    }
  });
}

module.exports = Validation;
