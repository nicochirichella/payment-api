'use strict';

/**
 * @ngdoc service
 * PaymentStatus.pendingCapture.nullProcessor
 * @description
 * # nullProcessor
 * nullProcessor object in the oneCreditCardApp.
 */
angular.module('oneCreditCardApp')
  .factory('nullInstallments', function () {
	return {
        installments: null,
        interestPercentage: 0
    };
});
