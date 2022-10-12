'use strict';

angular.module('multipleCreditCardsApp')
  .factory('AdyenEncryption', function ($window, configService) {
    return $window.adyen.createEncryption(configService.getApiKey());
  });
