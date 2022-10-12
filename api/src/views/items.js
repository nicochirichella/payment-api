const Promise = require('bluebird');

function mapItem(item) {
  return {
    name: item.get('name'),
    reference: item.get('external_reference'),
    discountAmountInCents: parseInt(Math.round(item.get('discount') * 100), 10),
    totalCostInCents: parseInt(Math.round(item.get('total') * 100), 10),
    unitCostInCents: parseInt(Math.round(item.get('unit_cost') * 100), 10),
    quantity: item.get('quantity'),
    details: item.get('details'),
  };
}

module.exports = function itemsView(items) {
  return Promise.resolve(items.map(mapItem));
};
