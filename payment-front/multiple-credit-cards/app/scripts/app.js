'use strict';

/**
 * @ngdoc overview
 * PaymentStatus.pendingCapture
 * @description
 * # multipleCreditCardsApp
 *
 * Main module of the application.
 */
angular
  .module('multipleCreditCardsApp', ['ngResource', 'ui.mask', 'ui.select', 'ngSanitize'])
    .config(['$locationProvider', function($locationProvider) {
    $locationProvider.html5Mode({
        enabled: true,
        requireBase: false
    });
    $locationProvider.hashPrefix('!');

}]);