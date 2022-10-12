const Promise = require('bluebird');

module.exports = function gatewayView(model) {
  return Promise.resolve({
    id: model.get('id'),
    type: model.get('type'),
    name: model.get('name'),
    base_url: model.get('base_url'),
  });
};
