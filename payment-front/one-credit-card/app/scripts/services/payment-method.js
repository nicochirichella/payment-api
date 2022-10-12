'use strict';

/**
 * @ngdoc service
 * PaymentStatus.pendingCapture.Payment
 * @description
 * # Payment
 * Provider in the oneCreditCardApp.
 */
angular.module('oneCreditCardApp')
  .factory('PaymentMethod', function (RESPONSE_ONE_CREDIT_CARD, nullProcessor, CreditCardFormatter, configService) {
    var service = {};

    service.getProcessor = function(bin) {
      return configService.config().then(function(config) {
        var processor = _.find(config.processors, function(p) {
          return p.match(bin);
        });

        return processor || nullProcessor;
      })
      .catch(function(){
        return nullProcessor;
      });
    };

    service.formatCreditCard = function(creditCard) {
        var formatter = CreditCardFormatter.both;
        return formatter(creditCard);
    };

    return service;
  });
