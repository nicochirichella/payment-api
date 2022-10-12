const _ = require('lodash');
const BaseModel = require('./base_model.js');
const PaymentStatuses = require('./constants/payment_status');

module.exports = BaseModel.extend({
  tableName: 'incoming_ipns',

  validations: {
    tenant_id: ['required', 'naturalNonZero'],
    gateway_id: ['required', 'naturalNonZero'],
    payload: ['required'],
    process_status: [_.partial(_.contains, _.values(PaymentStatuses))],
    payment_id: ['naturalNonZero'],
  },

  conditionalValidations: [
    [
      { process_status: ['required'] },
      model => !!model.payment_id,
    ],
  ],

  gateway() {
    return this.belongsTo(require('./gateway'));
  },
});
