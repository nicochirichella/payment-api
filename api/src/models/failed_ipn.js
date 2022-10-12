const BaseModel = require('./base_model.js');

module.exports = BaseModel.extend({
  tableName: 'failed_ipns',

  validations: {
    tenant_id: ['required', 'naturalNonZero'],
    gateway_id: ['required', 'naturalNonZero'],
    payload: ['required'],
    client_reference: ['maxLength:150'],
  },

  gateway() {
    return this.belongsTo(require('./gateway'));
  },
});
