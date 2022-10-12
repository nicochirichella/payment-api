'use strict';

/**
 * @ngdoc directive
 * PaymentStatus.pendingCapture.directive:hasErrors
 * @description
 * # hasErrors
 */
angular.module('oneCreditCardApp')
    .directive('showDateErrors', function () {
        return {
            require: '^form',
            restrict: 'A',
            link: function (scope, el, args, formController) {
                if (!formController) return;

                var ngModels = _.map(args.showDateErrors.split(','), function (field) {
                    return formController[field];
                });

                function isMonthAndYearValid(month, year) {
                    var today = new Date();
                    return (today.getFullYear() < year) ? true : (today.getMonth() + 1 <= month);
                }

                var month = ngModels[0];
                var year = ngModels[1];

                scope.$watch(function () {
                    return month.$modelValue;
                }, function (nv) {
                    updateStatus(nv, year.$modelValue)
                });

                scope.$watch(function () {
                    return year.$modelValue;
                }, function (nv) {
                    updateStatus(month.$modelValue, nv)
                });

                function updateStatus(month, year) {
                    if (month && year) {
                        ngModels[0].$setValidity('dateInThePast', isMonthAndYearValid(month, year));
                        ngModels[1].$setValidity('dateInThePast', isMonthAndYearValid(month, year));

                        var valid = _.any(ngModels, function (ngModel) {
                            return ngModel.$invalid && ngModel.$touched;
                        });
                        el.toggleClass('has-error', valid);
                    }
                }
            }
        };
    });
