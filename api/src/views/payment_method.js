const _ = require('lodash');

module.exports = function paymentMethodView(model, options = {}) {
  const relations = options.relations || [];

  return model.getUiUrl()
    .then(uiUrl => ({
      id: model.get('id'),
      type: model.get('type'),
      name: model.get('name'),
      enabled: !!model.get('enabled'),
      ui_url: uiUrl,
    }))
    .then((view) => {
      if (!_.contains(relations, 'gateway_method')) return view;

      return model.getRelation('gatewayMethod')
        .then((gm) => {
          return _.merge({}, view, { gateway_method: gm.get('type') });
        });
    })
    .then((view) => {
      if (!_.contains(relations, 'valid_gateway_methods')) return view;

      return model.getRelation('validGatewayMethods')
        .then((gms) => {
          return _.merge({}, view, { valid_gateway_methods: gms.map(gm => gm.get('type')) });
        });
    })
    .then((view) => {
      if (!_.contains(relations, 'gateway_methods')) return view;

      return model.getRelation('orderedGatewayMethods')
        .then((gms) => {
          return _.merge({}, view, { gateway_methods: gms.map(gm => gm.get('type')) });
        });
    });
};
