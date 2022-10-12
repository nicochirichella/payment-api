"use strict";

angular.module('oneCreditCardApp')
  .service('configService', function ($q, $location, $http, ENVS, RESPONSE_ONE_CREDIT_CARD, ProcessorModel) {
    var service = {};
    var config = null;
    var apiKey = null;
    var formatter = $location.search().formatter;

    service.getTenantConfig = function() {
        var tenant = $location.search().tenant;
        var env = $location.search().environment;
        return ENVS[env][tenant];
    };

    service.getFormatter = function() {
        return formatter;
    };

    service.getApiKey = function () {
      if (!apiKey) {
        var env = $location.search().environment;
        var tenant = $location.search().tenant;
        apiKey = ENVS[env][tenant].gateways[formatter];
      }
      return apiKey;
    };

    service.getApiKeyForGateway = function (gatewayName) {
        var env = $location.search().environment;
        var tenant = $location.search().tenant;
        apiKey = ENVS[env][tenant].gateways[gatewayName];
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
            console.error('There was an error fetching ONE_CREDIT_CARD payment method configuration. Using local configuration');
          return {
            processors: RESPONSE_ONE_CREDIT_CARD.processors,
            documentTypes: RESPONSE_ONE_CREDIT_CARD.documentTypes,
            formatter: formatter,
            apiKey: apiKey,
          };
        });
    }

    return service;
  });