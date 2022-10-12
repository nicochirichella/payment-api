'use strict';

/**
 * @ngdoc directive
 * PaymentStatus.pendingCapture.directive:checkCreditCard
 * @description
 * # checkCreditCard
 */
angular.module('multipleCreditCardsApp')
    .directive('convertToNumber', function() {
        return {
            require: 'ngModel',
            link: function(scope, element, attrs, ngModel) {
                ngModel.$parsers.push(function(val) {
                    if (val === null || val === '' || val === undefined) {
                        return null;
                    }
                    return parseInt(val, 10);
                });
                ngModel.$formatters.push(function(val) {
                    if (val === null || val === undefined) {
                        return '';
                    }
                    return '' + val;
                });
            }
        };
    });
