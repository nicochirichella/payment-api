'use strict';

/**
 * @ngdoc service
 * PaymentStatus.pendingCapture.nullProcessor
 * @description
 * # nullProcessor
 * nullProcessor object in the oneCreditCardApp.
 */
angular.module('oneCreditCardApp')
  .factory('nullProcessor', function (ProcessorModel) {
	return new ProcessorModel({
        "id": "nullProcessor",
        "name": "NoProcessor",
        "bin_regexp": {
            "pattern": "[0-9]+",
            "exclusion_pattern": null,
            "installments_pattern": null
        },
        "card": {
            length: 16,
            mask: '9999 9999 9999 9999',
            algorithm: 'falsy'
        },
        "security_code": {
            "length": 3,
            "card_location": "back"
        },
        "installments": []
    });
});
