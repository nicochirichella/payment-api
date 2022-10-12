'use strict';

/**
 * @ngdoc directive
 * PaymentStatus.pendingCapture.directive:checkCreditCard
 * @description
 * # checkCreditCard
 */
angular.module('oneCreditCardApp')
    .directive('colorizePlaceholder', function() {
        return {
            require: 'ngModel',
            link: function(scope, element, attrs, ngModel) {
                scope.$watch(function () {
                    return ngModel.$modelValue;
                }, function(newValue) {
                    var isPlaceholder = !newValue;
                    element.toggleClass('placeholder-color', isPlaceholder);
                });
            }
        };
    });
