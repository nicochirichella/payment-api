const router = require('express').Router();
const controller = require('../../controllers/methods');
const inputValidator = require('../../middleware/input_validator');
const auth = require('../../middleware/authentication');
const jsonSchemaValidator = require('../../middleware/json_schema_validator');

const idValidator = inputValidator((req) => {
  req.sanitizeParams('id').toUpperCase();
});

router.use(auth.authed);

router.get(
  '/',
  controller.getAll,
);

router.get(
  '/installments',
  controller.getInstallments,
);

router.get(
  '/:id',
  idValidator,
  controller.fetch,
  controller.returnView,
);

router.get(
  '/:id/config',
  idValidator,
  controller.fetch,
  controller.getConfig,
);

router.put(
  '/:id',
  idValidator,
  jsonSchemaValidator.validateFor('paymentMethodUpdate.json', true),
  controller.fetch,
  controller.update,
  controller.returnView,
);


module.exports = router;
