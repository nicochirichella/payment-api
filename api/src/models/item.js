const _ = require('lodash');
const BaseModel = require('./base_model.js');

function transformData(data) {

  const formatted = {
    name: data.name,
    external_reference: data.reference,
    total: _.isNumber(data.totalCostInCents) ? data.totalCostInCents / 100 : undefined,
    discount: _.isNumber(data.discountAmountInCents) ? data.discountAmountInCents / 100 : undefined,
    unit_cost: _.isNumber(data.unitCostInCents) ? data.unitCostInCents / 100 : undefined,
    quantity: data.quantity,
    image_url: data.imageUrl,
    details: data.details
  };

  return _.omit(formatted, undefined);
}

module.exports = BaseModel.extend({
  tableName: 'items',

  validations: {
    name: ['required', 'minLength:1', 'maxLength:255'],
    external_reference: ['maxLength:255'],
    discount: ['required', 'number'],
    total: ['required', 'number'],
    unit_cost: ['required', 'number'],
    quantity: ['required', 'naturalNonZero'],
    payment_order_id: ['required', 'naturalNonZero'],
    image_url: ['url'],
    details: ['required'],
  },

  paymentOrder() {
    return this.belongsTo(require('./payment_order'));
  },
}, {
  parse(items) {
    if (!_.isArray(items)) {
      items = [items];
    }
    return _.map(items, transformData);
  },
});
