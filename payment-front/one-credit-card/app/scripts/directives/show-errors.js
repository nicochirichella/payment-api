'use strict';

/**
 * @ngdoc directive
 * PaymentStatus.pendingCapture.directive:hasErrors
 * @description
 * # hasErrors
 */
angular.module('oneCreditCardApp')
    .directive('showErrors', function ($timeout) {
        return {
            require: '^form',
            restrict: 'A',
            link: function(scope, el, args, formController) {
                if (!formController) return;
                
                var ngModels = _.map(args.showErrors.split(','), function(field){
                    return formController[field];
                });

                if (ngModels.lenght === 0) return;

                var $input = el.find('input,select');

                function updateStatus() {
                    var valid = _.any(ngModels, function(ngModel) {
                        return ngModel.$invalid && ngModel.$touched;
                    });

                    el.toggleClass('has-error', valid);
                }

                $input.bind('blur', function() {
                    $timeout(function() {
                        scope.$apply(function(){
                            updateStatus();
                        });
                    });
                });

                $input.bind('focus', function() {
                    $timeout(function() {
                        scope.$apply(function(){
                            el.removeClass('has-error');
                        });
                    });
                });

                _.each(ngModels, function(ngModel){
                    var firstTime = true;

                    scope.$watch(function() {
                        return ngModel.$modelValue;
                    }, function() {
                        if (!$input.is(":focus")) {
                            updateStatus();
                        }
                    });
                });
            }
        };
    });
