const tv4 = require('tv4');
const Promise = require('bluebird');
const _ = require('lodash');
const fs = require('fs');
const config = require('../config');
const errors = require('../errors');

const baseDir = `${config.get('schema.path').replace(/\/$/, '')}/`;
const path = require('path');

const jsValidator = {
  schemas: [],
};

function fullRoute(schema) {
  return `file://${baseDir}${schema}`;
}

try {
  const files = fs.readdirSync(baseDir).filter(f => path.extname(f) === '.json');
  _.each(files, (file) => {
    try {
      jsValidator.schemas.push(file);
      const data = fs.readFileSync(baseDir + file);

      file = fullRoute(file);
      tv4.addSchema(file, JSON.parse(data));
    } catch (e) {
      console.error(`Error loading schema: ${file}`, e); // eslint-disable-line no-console
      throw e;
    }
  });
} catch (e) {
  console.error('Error loading schemas dir. Check if you have copied/soft link it.', e); // eslint-disable-line no-console
  throw e;
}

jsValidator.validate = function jsValidate(schema, json, opts = {}) {
  const banUnknownProperties = opts.banUnknownProperties === true;
  return new Promise(((resolve, reject) => {
    const schemaRoute = fullRoute(schema);

    const validation = tv4.validateMultiple(json, schemaRoute, true, banUnknownProperties);
    if (validation.valid && validation.missing.length === 0) {
      return resolve();
    }

    return reject(new errors.JsonSchemaError(schema, json, validation));
  }));
};

jsValidator.validateFor = function jsValidateFor(schema, banUnknownProperties = false) {
  return (req, res, next) => {
    const body = req.body;

    jsValidator.validate(schema, body, { banUnknownProperties })
      .then(() => next())
      .catch(next);
  };
};

module.exports = jsValidator;
