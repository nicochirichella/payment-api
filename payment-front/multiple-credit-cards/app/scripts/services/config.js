angular.module('multipleCreditCardsApp')
  .service('configService', function ($q, $location, $http, ENVS, RESPONSE_TWO_CREDIT_CARDS, ProcessorModel) {
    var service = {};
    var config = null;
    var apiKey = null;
    var formatter = null;

    service.getApiKey = function () {
      if (!apiKey) {
        var env = $location.search().environment;
        var tenant = $location.search().tenant;
        formatter = $location.search().formatter;
        apiKey = ENVS[env][tenant].gateways[formatter];
      }
      return apiKey;
    };

    service.config = function () {
      if (config) {
        return $q(function (resolve, reject) {
          resolve(config);
        });
      }

      return getConfig().then(function (resolvedConfig) {
        var processors = resolvedConfig.processors;
        resolvedConfig.processors = _.map(processors, function (p) {
          return new ProcessorModel(p);
        });

        config = resolvedConfig;

        return config;
      });
    };

    function getConfig() {
      var tenant = $location.search().tenant;
      var paymentMethod = $location.search().paymentMethod;
      var env = $location.search().environment;
      var baseUrl = ENVS[env][tenant].url;

      return $http.get(baseUrl + '/api/v1/payment/payment-method-config/' + paymentMethod + '?tenant=' + tenant)
        .then(function (response) {
          return {
            processors: response.data.processors,
            documentTypes: response.data.documentTypes,
            formatter: formatter,
            apiKey: apiKey,
          };
        }).catch(function (err) {
          return {
            processors: RESPONSE_TWO_CREDIT_CARDS.processors,
            documentTypes: RESPONSE_TWO_CREDIT_CARDS.documentTypes,
            formatter: formatter,
            apiKey: apiKey,
          };
        });
    }

    return service;
  });