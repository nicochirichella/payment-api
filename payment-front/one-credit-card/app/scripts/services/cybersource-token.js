'use strict';

angular.module('oneCreditCardApp')
    .factory('CybersourceTokenService', function ($window, configService, ENVS, $http, $q) {
        var service = {};
        var tokenCache = {};
        var creditCardCache = {};

        var PROCESSORS_MAP = {
            visa: '001',
            amex: '003',
            mastercard: '002',
            diners: '005',
            hipercard: '050',
            elo: '054',
        };

        var cacheKeyTemplate = _.template('<%= cardNumber %>|<%= securityCode %>|<%= cardExpirationMonth %>|<%= cardExpirationYear %>|<%= cardholderName %>|<%= docType %>|<%= docNumber %>');

        var tenantConfig = configService.getTenantConfig();

        function getCacheKey(creditCard) {
            return cacheKeyTemplate(creditCard)
        }

        function getCacheToken(creditCard) {
            return tokenCache[getCacheKey(creditCard)];
        }

        function setCacheToken(creditCard, token) {
            tokenCache[getCacheKey(creditCard)] = token;
        }

        function mapCardType(creditCard) {
            var creditCardType = PROCESSORS_MAP[creditCard.getProcessorId()];

            if(!creditCardType) {
                throw new Error("CreditCard type not found. Processor: " + creditCard.getProcessorId());
            } else {
                return creditCardType;

            }
        }

        function prepareDataForCache(creditCard) {
            var attrs = creditCard.toJSON();
            return {
                'cardNumber': attrs.number,
                'securityCode': attrs.securityCode,
                'cardExpirationMonth': attrs.expirationMonth,
                'cardExpirationYear': attrs.expirationYear,
                'cardholderName': attrs.holderName,
                'docType': attrs.documentType,
                'docNumber': attrs.documentNumber
            };
        }

        function prepareData(creditCard, csKey) {
            var attrs = creditCard.toJSON();
            return {
                "cardInfo": {
                    "cardExpirationMonth": _.padLeft(String(attrs.expirationMonth), 2, "0"),
                    "cardExpirationYear": String(attrs.expirationYear),
                    "cardNumber": attrs.number,
                    "cardType": mapCardType(creditCard)
                },
                "keyId": csKey,
            };
        }

        function cybersourceGetKey() {
            var baseUrl = tenantConfig.url;
            return $http({
                method : "GET",
                url: baseUrl + "/api/v1/payment/key-generator",
            }).then(function (response) {
                return response;
            });
        };

        function cybersourceGetToken(creditCard, key) {
            var tokenUrl = tenantConfig.gateways.cybersource.token_url;
            return $http({
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json, text/plain, */*'
                },
                url: tokenUrl,
                data: prepareData(creditCard, key),
                method: 'POST'
            }).then(function (response) {
                setCacheToken(prepareDataForCache(creditCard), response.data.token);
                return response.data.token;
            }).catch(function (err) {
                console.error("services.cybersource.get_token.error", {
                    url: err.config.url,
                    response: err.data,
                    status: err.status,
                    statusText: err.statusText,
                    key: key,
                });
                throw err;
            });
        };

        service.getToken = function(creditCard) {
            creditCardCache = prepareDataForCache(creditCard);

            var token = getCacheToken(creditCardCache);
            if (token) {
                var deferred = $q.defer();
                deferred.resolve(token);
                return deferred.promise;
            }

            return cybersourceGetKey()
                .then(function (csKey) {
                    var response = csKey.data;
                    return cybersourceGetToken(creditCard, response.keyId);
                });
        };

        return service;
    });
