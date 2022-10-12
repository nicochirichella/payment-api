var Payment = require("./payment");

var PaymentResponse = {
  payment: Payment,
  action: "none",
  actionData: {}
};

PaymentResponse.setAction = function (action, actionData) {
  this.action = action;
  this.actionData = actionData;
  return this;
};

module.exports = PaymentResponse;
