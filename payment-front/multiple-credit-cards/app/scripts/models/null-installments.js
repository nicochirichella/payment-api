'use strict';

/**
 * @ngdoc service
 * PaymentStatus.pendingCapture.nullProcessor
 * @description
 * # nullProcessor
 * nullProcessor object in the multipleCreditCardsApp.
 */
angular.module('multipleCreditCardsApp')
  .factory('nullInstallments', function () {
	return {
        installments: null,
        interestPercentage: 0
    };
});
