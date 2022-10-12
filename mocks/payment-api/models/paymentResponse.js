var Payment = require("./payment");

var PaymentResponse = {
  payment: Payment,
  action: {
  	"type": "none",
  	"data": {}
  }
};

PaymentResponse.setAction = function (type, data) {
  this.action = {
  	"type": type,
  	"data": data
  };
  return this;
};

module.exports = PaymentResponse;
