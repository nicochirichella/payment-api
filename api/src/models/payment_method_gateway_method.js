const _ = require('lodash');
const BaseModel = require('./base_model.js');
const log = require('../logger');

const PaymentMehtodGatewayMethod = BaseModel.extend({
  tableName: 'payment_method_gateway_methods',
  softDelete: true,

  gatewayMethod() {
    return this.belongsTo(require('./gateway_method'));
  },

  paymentMethod() {
    return this.belongsTo(require('./payment_method'));
  },
}, {
  create(data, t) {
    const paymentMethodGatewaymethod = this.forge(data);
    return paymentMethodGatewaymethod.save({}, { transacting: t });
  },
});

module.exports = PaymentMehtodGatewayMethod;
