var validate = require('validate');

/**
 * Simple validator plugin.
 *
 * @param {Object} cls The rhom-ified class to extend with validation.
 * @param {Object} schema The expected schema. See https://github.com/UsabilityDynamics/node-object-validation
 */
function Validation(cls, schema) {
	var mdl = cls._mdl.plugin("Validator", "Basic object validation");

	var validator = validate(schema);

	mdl.on("beforeSave", function(event) {
    var result = validator.validate(event.target);
    if (result.errors.length) {
      event.failure("Validation error(s): " + result.errors.join(", "));
    }
  });
}

module.exports = Validation;
