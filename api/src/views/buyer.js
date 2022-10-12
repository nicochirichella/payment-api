const _ = require('lodash');

const Promise = require('bluebird');
const moment = require('moment');

module.exports = function buyerView(model) {
  let buyer = {
    reference: model.get('external_reference'),
    type: model.get('type'),
    name: model.get('name'),
    gender: model.get('gender'),
    birthDate: model.get('birth_date') ? moment(model.get('birth_date')).format('YYYY-MM-DD') : null,
    documentNumber: model.get('document_number'),
    documentType: model.get('document_type'),
    email: model.get('email'),
    phone: model.get('phone'),
    ipAddress: model.get('ip_address'),
  };

  _.each(['billing', 'shipping'], (type) => {
    buyer[`${type}Address`] = _.omit({
      city: model.get(`${type}_city`) ? model.get(`${type}_city`) : null,
      district: model.get(`${type}_district`) ? model.get(`${type}_district`) : null,
      country: model.get(`${type}_country`) ? model.get(`${type}_country`) : null,
      complement: model.get(`${type}_complement`) ? model.get(`${type}_complement`) : null,
      number: model.get(`${type}_number`) ? model.get(`${type}_number`) : null,
      zipCode: model.get(`${type}_zip_code`) ? model.get(`${type}_zip_code`) : null,
      state: model.get(`${type}_state`) ? model.get(`${type}_state`) : null,
      stateCode: model.get(`${type}_state_code`) ? model.get(`${type}_state_code`) : null,
      street: model.get(`${type}_street`) ? model.get(`${type}_street`) : null,
    }, _.isNull);
  });

  if (_.isEmpty(buyer.shippingAddress)) {
    buyer = _.omit(buyer, 'shippingAddress');
  }

  return Promise.resolve(buyer);
};
