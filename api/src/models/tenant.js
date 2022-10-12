const BaseModel = require('./base_model.js');

module.exports = BaseModel.extend({
  tableName: 'tenants',

  validations: {
    name: ['required', 'minLength:1', 'maxLength:255'],
    api_key: ['required', 'minLength:1', 'maxLength:255'],
    ipn_url: ['url', 'maxLength:255'],
  },

  paymentMethods() {
    return this.hasMany(require('./payment_method'));
  },

  gatewayMethods() {
    return this.hasMany(require('./gateway_method'));
  },

  gateways() {
    return this.hasMany(require('./gateway'));
  },
}, {
  fromApiKey(apiKey) {
    return this
      .forge({ api_key: apiKey })
      .fetch();
  },
});
