'use strict';

/**
 * @ngdoc service
 * PaymentStatus.pendingCapture.CreditCardFormatter
 * @description
 * # CreditCardFormatter
 * Factory that expose the multiple formatters accepted by the PaymentService.
 */
angular.module('multipleCreditCardsApp')
    .factory('CreditCardFormatter', function ($q, MercadopagoSdk, AdyenEncryption) {
        var service = {};

        service.mercadopago = function mercadopagoFormatter(payment) {
            var creditCard = payment.creditCard;
            var deferred = $q.defer();
            var mercadopagoFormattedCardData = {
                'cardNumber': creditCard.number,
                'securityCode': creditCard.securityCode,
                'cardExpirationMonth': creditCard.expirationMonth,
                'cardExpirationYear': creditCard.expirationYear,
                'cardholderName': creditCard.holderName,
                'docType': creditCard.documentType,
                'docNumber': creditCard.documentNumber
            };

            MercadopagoSdk.clearSession();
            MercadopagoSdk.createToken(mercadopagoFormattedCardData, function (status, response) {
                if (status != 200 && status != 201) {
                    deferred.reject(response.data);
                } else {
                    var formatted = {
                        installments: payment.installments.installments,
                        amountInCents: parseInt(Math.round(payment.amount * 100)),
                        interestInCents: parseInt(Math.round(payment.totalInterest() * 100)),
                        type: 'creditCard',
                        paymentInformation: {
                            processor: creditCard.getProcessorId(),
                            lastFourDigits: creditCard.getLastFourDigits(),
                            firstSixDigits: creditCard.getFirstSixDigits()
                        },
                        encryptedCreditCards: [{
                            encryptedContent: response.id,
                            encryptionType: 'mercadopagoToken',
                        }]
                    };
                    deferred.resolve(formatted);
                }
            });

            return deferred.promise;
        };

        service.adyen = function adyenFormatter(payment) {
            var creditCard = payment.creditCard;
            var attrs = creditCard.toJSON();
            var cardFormatted = {
                number: attrs.number,
                cvc: attrs.securityCode,
                holderName: attrs.holderName,
                expiryMonth: ('0' + attrs.expirationMonth).slice(-2),
                expiryYear: attrs.expirationYear.toString(),
                generationtime: moment().utc().format()
            };

            var encryptionContent = AdyenEncryption.encrypt(cardFormatted);

            var formatted = {
                installments: payment.installments.installments,
                amountInCents: parseInt(Math.round(payment.amount * 100)),
                interestInCents: parseInt(Math.round(payment.totalInterest() * 100)),
                type: 'creditCard',
                paymentInformation: {
                    processor: creditCard.getProcessorId(),
                    lastFourDigits: creditCard.getLastFourDigits(),
                    firstSixDigits: creditCard.getFirstSixDigits()
                },
                encryptedCreditCard: {
                    encryptedContent: encryptionContent,
                    encryptionType: 'adyen',
                }
            };

            return $q(function (resolve, reject) {
                resolve(formatted);
            });
        };

        return service;
    });
