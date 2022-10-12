const router = require('express').Router();
const inputValidator = require('../../middleware/input_validator');
const auth = require('../../middleware/authentication');
const controller = require('../../controllers/gateways');
const jsValidator = require('../../middleware/json_schema_validator.js');

const idValidator = inputValidator((req) => {
  req.sanitizeParams('id').toUpperCase();
});

router.get(
  '/',
  auth.authed,
  controller.getAll,
);

router.get(
  '/:id',
  auth.authed,
  idValidator,
  controller.fetch,
  controller.returnView
);

router.post(
  '/:id/ipn',
  idValidator,
  controller.fetch,
  controller.parseIpn,
  controller.processIpn
);


router.get(
  '/:id/key-generator',
  jsValidator.validateFor('createToken.json'),
  idValidator,
  controller.fetch,
  auth.authed,
  controller.getTokenizerKey,
);

module.exports = router;
