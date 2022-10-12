const Promise = require('bluebird');
const moment = require('moment');
const _ = require('lodash');
const itemsView = require('./items');
const buyerView = require('./buyer');
const paymentsView = require('./payments');

module.exports = function paymentOrderView(model) {
  return Promise.join(
    model.getRelation('paymentMethod'),
    model.getRelation('items'),
    model.getRelation('buyer'),
    model.getRelation('payments'),
    model.getExpirationDate(),
    (paymentMethod, items, buyer, payments, expirationDate) => {
      const paymentGroups = _.groupBy(payments.toArray(), (p) => p.isValid());

      return Promise.join(
        itemsView(items),
        paymentsView(paymentGroups[true] || []),
        paymentsView(paymentGroups[false] || []),
        buyerView(buyer),
        (formattedItems, formattedValidPayments, formattedRetriedPayments, formattedBuyer) => {
          return {
            id: model.get('id').toString(),
            purchaseReference: model.get('purchase_reference'),
            reference: model.get('reference'),
            status: model.statusName(),
            createdAt: moment(model.get('created_at')).utc().format(),
            updatedAt: moment(model.get('updated_at')).utc().format(),
            paymentMethod: paymentMethod.get('type'),
            currency: model.get('currency'),
            expirationDate: moment(expirationDate).utc().format(),
            totalInCents: parseInt(Math.round(model.get('total') * 100), 10),
            interestInCents: parseInt(Math.round(model.get('interest') * 100), 10),
            shoppingCart: {
              items: formattedItems,
              totalCostInCents: parseInt(Math.round((model.get('total') - model.get('interest')) * 100), 10),
            },
            payments: formattedValidPayments,
            retriedPayments: formattedRetriedPayments,
            buyer: formattedBuyer,
            metadata: model.get('metadata'),
          };
        },
      );
    },
  );
};
