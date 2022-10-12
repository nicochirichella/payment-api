const Promise = require('bluebird');
const paymentOrderView = require('./payment_order');

module.exports = function paymentRequestResponseView(result) {
  let data = {};

  if (result.action.type === 'redirect') {
    data = {
      redirectUrl: result.action.data.redirectUrl,
    };
  } else if (result.action.type === 'status') {
    data = {
      paymentOrderStatus: result.action.data.paymentOrderStatus,
      reference: result.action.data.reference,
      purchaseReference: result.action.data.purchaseReference,
    };
  } else {
    return Promise.reject(new Error(`Undefined action type: ${result.action.type}`));
  }

  return paymentOrderView(result.paymentOrder)
    .then((formattedPaymentOrder) => {
      return {
        paymentOrder: formattedPaymentOrder,
        action: {
          type: result.action.type,
          data,
        },
      };
    });
};
