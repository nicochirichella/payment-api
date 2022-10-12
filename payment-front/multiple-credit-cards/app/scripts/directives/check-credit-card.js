'use strict';

/**
 * @ngdoc directive
 * PaymentStatus.pendingCapture.directive:checkCreditCard
 * @description
 * # checkCreditCard
 */
angular.module('multipleCreditCardsApp')
    .directive('checkCreditCard', function () {
        return {
            require: 'ngModel',
            restrict: 'A',
            scope: {
                checkCreditCard: '='
            },
            link: function(scope, el, args, ngModel) {
                var cc = scope.checkCreditCard;
                if (!ngModel || !cc || !cc.validCardNumber) return;
                
                function validate() {
                    return cc.validCardNumber()
                }

                scope.$watch('checkCreditCard.number', function(newValue, oldValue) {
                    cc.updateProcessor(newValue, oldValue).then(function() {
                        var creditCardValid = validate();
                        var requiredLength = cc.number && cc.processor.cardLength() === cc.number.length;
                        var valid = !requiredLength || (requiredLength && creditCardValid);
                        ngModel.$setValidity('creditCard', valid);
                    })
                });
            }
        };
    });
