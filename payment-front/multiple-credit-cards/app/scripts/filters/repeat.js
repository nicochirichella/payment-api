'use strict';

/**
 * @ngdoc filter
 * PaymentStatus.pendingCapture.filter:repeat
 * @function
 * @description
 * # repeat
 * Filter in the multipleCreditCardsApp.
 */
angular.module('multipleCreditCardsApp')
  .filter('repeat', function () {
    return function (input, times) {
      return _.repeat(input, times);
    };
  });
