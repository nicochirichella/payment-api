const _ = require('lodash');
const Promise = require('bluebird');

function mapInstallmentInfo(paymentMethod, interestRates) {
  return {
    gatewayMethod: paymentMethod.get('name'),
    installments: _.chain(interestRates.toArray())
      .map(r => ({ amount: r.get('amount'), interest: parseFloat(r.get('interest')) }))
      .sortBy('amount')
      .value(),
  };
}

module.exports = function installmentInfoView(paymentMethod, interestRates) {
  return Promise.resolve(mapInstallmentInfo(paymentMethod, interestRates));
};
