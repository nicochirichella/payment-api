'use strict';

/**
 * @ngdoc service
 * PaymentStatus.pendingCapture.Payment
 * @description
 * # Payment
 * Provider in the multipleCreditCardsApp.
 */
angular.module('multipleCreditCardsApp')
    .factory('PaymentMethod', function (nullProcessor, CreditCardFormatter, configService) {
        var service = {};

        service.getProcessor = function (bin) {
            return configService.config().then(function (config) {
                var processor = _.find(config.processors, function (p) {
                    return p.match(bin);
                });

                return processor || nullProcessor;
            })
                .catch(function () {
                    return nullProcessor;
                });
        };

        service.formatCreditCard = function (payment) {
            return configService.config().then(function (config) {
                var formatterName = config.formatter;
                var formatter = CreditCardFormatter[formatterName];

                if (!formatter) {
                    formatter = CreditCardFormatter.mercadopago;
                }

                return formatter(payment);
            });
        };

        return service;
    });
