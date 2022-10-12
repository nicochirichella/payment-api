'use strict';

/**
 * @ngdoc overview
 * PaymentStatus.pendingCapture
 * @description
 * # oneCreditCardApp
 *
 * Main module of the application.
 */
angular
  .module('oneCreditCardApp', ['ngResource', 'ui.mask', 'ui.select', 'ngSanitize'])
    .config(['$locationProvider', function($locationProvider) {
    $locationProvider.html5Mode({
        enabled: true,
        requireBase: false
    });
    $locationProvider.hashPrefix('!');

}]);