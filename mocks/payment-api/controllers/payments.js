var _ = require("lodash");
var Payment = require("../models/payment");
var PaymentResponse = require("../models/paymentResponse");
var PaymentRequest = require("../models/paymentRequest");

var statuses = {
  pending: 0,
  successfull: 1,
  cancelled: 2,
  rejected: 3,
  refunded: 4,
  partialRefund: 5,
  inMediation: 6,
  chargedBack: 7
};

var idToStatusName = _.invert(statuses);

function statusFromPaymentId (paymentId) {
  switch (paymentId) {
    case 'EC-5R000484266837212':
      return statuses.pending;
    default:
      return statuses.successfull;
  }
}

function cancelResponseFromPaymentId (paymentId) {
  switch (paymentId) {
    case 'EC-5R000484266837213':
      return {
            code: 400,
            body: {
              message: 'Invalid state change',
              devMessage: 'Invalid state change',
              status: 400,
              code: "invalid_state_change",
              context: {
                fromState: "",
                toState: idToStatusName[statuses.cancelled]
              }
            }
      };
    default:
      return {
            code: 200,
            body: Payment
                .setclientPaymentReference(paymentId)
                .setStatus( idToStatusName[statuses.cancelled])
      };
  }
}

module.exports =  {
  statuses: statuses,
  getPayment: function (paymentId) {
    return {
      "httpRequest": {
        "method": "GET",
        "path": "/ecommerce/v1/payments/"+paymentId
      },
      "httpResponse": {
        "statusCode": 200,
        "body": JSON.stringify( Payment
                                .setclientPaymentReference(paymentId)
                                .setStatus( idToStatusName[statusFromPaymentId(paymentId)] ) )
      },
      'times': {
            'unlimited': true
        }
    };
  },
  postPayment: function (action, actionData) {
    return {
      "httpRequest": {
        "method": "POST",
        "path": "/ecommerce/v1/payments",
        //"body": JSON.stringify({ "id": id }),
      },
      "httpResponse": {
        "statusCode": 200,
        "body": JSON.stringify( PaymentResponse.setAction(action,actionData) )
      },
      'times': {
            //'remainingTimes': 1,
            'unlimited': true
      }
    };
  },
  cancelPayment: function (paymentId) {
    return {
      "httpRequest": {
        "method": "POST",
        "path": "/ecommerce/v1/payments/"+paymentId+"/cancel",
      },
      "httpResponse": {
        "statusCode": cancelResponseFromPaymentId(paymentId).code,
        "body": JSON.stringify(cancelResponseFromPaymentId(paymentId).body)
      },
      'times': {
            //'remainingTimes': 1,
            'unlimited': true
      }
    };
  }
};
