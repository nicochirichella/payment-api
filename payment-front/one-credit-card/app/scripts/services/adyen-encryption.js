'use strict';

angular.module('oneCreditCardApp')
  .factory('AdyenEncryption', function ($window, configService) {
    return $window.adyen.createEncryption(configService.getApiKey());
  });
