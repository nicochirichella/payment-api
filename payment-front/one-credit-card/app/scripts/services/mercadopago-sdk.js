'use strict';

angular.module('oneCreditCardApp')

.service('MercadopagoSdk', function ($window, $q, configService, FORMATTER) {
    $window.Mercadopago.setPublishableKey(configService.getApiKeyForGateway(FORMATTER.MERCADOPAGO));

    var tokenCache = {};

    var cacheKeyTemplate = _.template('<%= cardNumber %>|<%= securityCode %>|<%= cardExpirationMonth %>|<%= cardExpirationYear %>|<%= cardholderName %>|<%= docType %>|<%= docNumber %>');
      function getCacheKey(creditCard) {
        return cacheKeyTemplate(creditCard)

    }
      function getCacheToken(creditCard) {
        return tokenCache[getCacheKey(creditCard)];

    }
      function setCacheToken(creditCard, token) {
        tokenCache[getCacheKey(creditCard)] = token;

    }
      function prepareData(creditCard) {
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
      function requestToken(creditCard) {

      var deferred = $q.defer();

      $window.Mercadopago.createToken(creditCard, function(status, response) {
        if (status != 200 && status != 201) {
          deferred.reject(response.data);
        } else {
          $window.Mercadopago.clearSession();
          deferred.resolve({
            encryptedContent: response.id,
            encryptionType: 'mercadopagoToken',
          });
        }
      });
        return deferred.promise;

    }

    var MP = {
      Mercadopago: $window.Mercadopago
    };
      MP.encrypt = function mercadopagoEncrypt(creditCard) {
      var mercadopagoFormattedCardData = prepareData(creditCard);

      var token = getCacheToken(mercadopagoFormattedCardData);
      if (token) {
        var deferred = $q.defer();
        deferred.resolve(token);
        return deferred.promise;
      }

      return requestToken(mercadopagoFormattedCardData)
        .then(function (token) {
          setCacheToken(mercadopagoFormattedCardData, token);
          return token;
        });
    };

    return MP;
  });
