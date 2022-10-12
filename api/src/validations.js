const Checkit = require('checkit');
const moment = require('moment');

Checkit.Validator.prototype.dateOnly = function dateOnly(val) {
  const dateRegex = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;
  return dateRegex.test(val) && moment(val).isValid();
};
