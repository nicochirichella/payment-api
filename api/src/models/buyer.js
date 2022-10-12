const _ = require('lodash');
const BaseModel = require('./base_model');
const BuyerType = require('./constants/buyer_type');
const Gender = require('./constants/gender');

function transformData(data) {
  const formatted = {
    external_reference: data.reference,
    type: data.type,
    name: data.name.trim(),
    gender: data.gender,
    birth_date: data.birthDate,
    document_number: data.documentNumber,
    document_type: data.documentType,
    email: data.email,
    phone: data.phone,
    ip_address: data.ipAddress,
  };

  _.forIn(data.billingAddress, (value, key) => {
    key = _.snakeCase(key);
    formatted[`billing_${key}`] = value;
  });

  _.forIn(data.shippingAddress, (value, key) => {
    key = _.snakeCase(key);
    formatted[`shipping_${key}`] = value;
  });

  return _.omit(formatted, undefined);
}

module.exports = BaseModel.extend({
  tableName: 'buyers',

  validations: {
    external_reference: ['required', 'maxLength:255'],
    name: ['required', 'minLength:1', 'maxLength:100'],
    type: ['required', _.partial(_.contains, _.values(BuyerType))],
    gender: [_.partial(_.contains, _.values(Gender))],
    birth_date: ['dateOnly'],
    document_number: ['required', 'natural'],
    document_type: ['required', 'maxLength:15'],
    email: ['required', 'email'],
    phone: ['required', 'natural'],
    ip_address: ['required', 'ipv4'],

    billing_city: ['required', 'minLength:1', 'maxLength:100'],
    billing_district: ['required', 'minLength:1', 'maxLength:100'],
    billing_country: ['required', 'minLength:1', 'maxLength:50'],
    billing_complement: ['minLength:1', 'maxLength:255'],
    billing_number: ['required', 'maxLength:255'],
    billing_street: ['required', 'minLength:1', 'maxLength:255'],
    billing_state: ['required', 'minLength:1', 'maxLength:100'],
    billing_state_code: ['required', 'minLength:1', 'maxLength:10'],
    billing_zip_code: ['required', 'natural', 'maxLength:50'],

    shipping_city: ['minLength:1', 'maxLength:100'],
    shipping_district: ['minLength:1', 'maxLength:100'],
    shipping_country: ['minLength:1', 'maxLength:50'],
    shipping_complement: ['minLength:1', 'maxLength:255'],
    shipping_number: ['maxLength:255'],
    shipping_street: ['minLength:1', 'maxLength:255'],
    shipping_state: ['minLength:1', 'maxLength:100'],
    shipping_state_code: ['minLength:1', 'maxLength:10'],
    shipping_zip_code: ['natural', 'maxLength:50'],
  },

  conditionalValidations: [
    [
      {
        gender: ['required'],
        birth_date: ['required'],
      },
      buyer => buyer.get('type') === 'person',
    ],
  ],

  virtuals: {
    first_name: {
      get() {
        const fullName = this.get('name').trim();
        const index = fullName.lastIndexOf(' ');

        return fullName.slice(0, index);
      },
    },
    last_name: {
      get() {
        const fullName = this.get('name').trim();
        const index = fullName.lastIndexOf(' ');

        return fullName.slice(index + 1);
      },
    },
  },

  paymentOrder() {
    return this.hasOne(require('./payment_order'));
  },
}, {
  parse(data) {
    return transformData(data);
  },
  PERSON_TYPE: 'person',
  COMPANY_TYPE: 'company',
});
