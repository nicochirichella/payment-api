const router = require('express').Router();
const controller = require('../../controllers/payment_orders');
const paymentController = require('../../controllers/payments');
const jsValidator = require('../../middleware/json_schema_validator.js');
const inputValidator = require('../../middleware/input_validator');
const auth = require('../../middleware/authentication');

const idValidator = inputValidator((req) => {
  req.sanitizeParams('paymentReference');
});

router.use(auth.authed);

router.post(
  '/',
  jsValidator.validateFor('paymentOrderRequest.json'),
  controller.createPaymentOrder,
);

router.get(
  '/:paymentReference',
  idValidator,
  controller.fetch,
  controller.view,
);

router.post(
  '/:paymentReference/cancel',
  idValidator,
  controller.fetch,
  controller.cancel,
);

router.post(
  '/:paymentReference/charge-back',
  idValidator,
  controller.fetch,
  controller.chargeBack,
);

router.post(
  '/:paymentReference/manual-refunded',
  idValidator,
  controller.fetch,
  controller.manualRefunded,
);

router.post(
  '/:paymentReference/execute',
  idValidator,
  controller.fetch,
  controller.execute,
);

router.post(
  '/:paymentReference/rejections',
  jsValidator.validateFor('rejectionRequest.json'),
  controller.fetch,
  paymentController.fetch,
  paymentController.validateWithPaymentOrder,
  paymentController.rejection,
);

module.exports = router;
