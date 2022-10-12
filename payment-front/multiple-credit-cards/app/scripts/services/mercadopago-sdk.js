'use strict';

angular.module('multipleCreditCardsApp')
  .service('MercadopagoSdk', function ($window, configService) {
    $window.Mercadopago.setPublishableKey(configService.getApiKey());
    return $window.Mercadopago;
  });
