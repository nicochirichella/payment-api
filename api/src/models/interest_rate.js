const BaseModel = require('./base_model.js');

module.exports = BaseModel.extend({
  tableName: 'interest_rates',

  gatewayMethod() {
    return this.belongsTo(require('./gateway_method'));
  },
});
