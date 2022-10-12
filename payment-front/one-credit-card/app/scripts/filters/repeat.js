'use strict';

/**
 * @ngdoc filter
 * PaymentStatus.pendingCapture.filter:repeat
 * @function
 * @description
 * # repeat
 * Filter in the oneCreditCardApp.
 */
angular.module('oneCreditCardApp')
  .filter('repeat', function () {
    return function (input, times) {
      return _.repeat(input, times);
    };
  });
