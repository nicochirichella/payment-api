const expressValidator = require('express-validator');

module.exports = function expressValidatorGenerator() {
  return expressValidator({
    errorFormatter(param, msg) {
      return msg;
    },
    customValidators: {
      isIntArray(value) {
        return Array.isArray(value) && value.every((i) => { return Number.isInteger(i); });
      },
      lengthEquals(value, len) {
        return value && value.length === len;
      },
      lengthLTE(value, len) {
        return value && value.length <= len;
      },
    },
    customSanitizers: {
      toUpperCase(value) {
        return (value || '').toUpperCase();
      },
    },
  });
};
