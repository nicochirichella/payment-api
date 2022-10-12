'use strict';

/**
 * @ngdoc service
 * PaymentStatus.pendingCapture.CreditCardFormatter
 * @description
 * # CreditCardFormatter
 * Factory that expose the multiple formatters accepted by the PaymentService.
 */
angular.module('oneCreditCardApp')
    .factory('CreditCardFormatter', function ($q, MercadopagoSdk, AdyenEncryption, $http, ENVS, CybersourceTokenService, CybersourceScript, configService) {
        var service = {};
        const MERCADOPAGO_FAIL = "mercadopago_fail";
        const CYBERSOURCE_FAIL = "cybersource_fail";
        const FAIL_PROCESSORS = [MERCADOPAGO_FAIL,CYBERSOURCE_FAIL];
        const MAX_PROCESSORS = 2;

        function baseFormat(creditCard, encryptions) {
            var attrs = creditCard.toJSON();
            return {
                installments: attrs.installments,
                amountInCents: parseInt(Math.round(attrs.amount * 100)),
                interestInCents: parseInt(Math.round(attrs.interest * 100)),
                type: 'creditCard',
                paymentInformation: {
                    processor: creditCard.getProcessorId(),
                    lastFourDigits: creditCard.getLastFourDigits(),
                    firstSixDigits: creditCard.getFirstSixDigits(),
                    holderDocumentNumber: creditCard.getDocumentNumber(),
                    holderName: creditCard.getHolderName(),
                    securityCode: creditCard.getSecurityCode(),
                },
                encryptedCreditCards: encryptions
            };
        }

        function encryptCybersourceToken(creditCard) {
            return CybersourceTokenService.getToken(creditCard)
                .then(function (token) {
                    return $q.resolve({
                        "encryptedContent": token,
                        "encryptionType": "cybersourceToken",
                    });
                })
                .catch(function (){
                    return $q.resolve(CYBERSOURCE_FAIL);
                });
        }

        function encryptMercadoPagoToken(creditCard) {
            return MercadopagoSdk.encrypt(creditCard)
                .catch(function (){
                    return $q.resolve(MERCADOPAGO_FAIL);
                });
        }

        service.adyen = function adyenFormatter(creditCard) {
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
            var formatted = baseFormat(creditCard, [{
                encryptedContent: encryptionContent,
                encryptionType: 'adyen',
            }]);
            return $q(function(resolve, reject) {
                resolve(formatted);
            });
        };

        service.both = function bothFormatter(creditCard) {
            return $q.all([encryptCybersourceToken(creditCard), encryptMercadoPagoToken(creditCard)])
                .then(function(encryptions) {
                    const validEncryptions = encryptions.filter(function (encryption) {
                        return !FAIL_PROCESSORS.includes(encryption);
                    });

                    if (validEncryptions.length === 0) {
                        return $q.reject('no valid token encryption found');
                    }
                    var payment;
                    payment = baseFormat(creditCard, validEncryptions);
                    payment.paymentInformation.deviceFingerprintId = CybersourceScript.getDeviceFingerprintId();
                    return payment;
                });
        };

        return service;
    });
