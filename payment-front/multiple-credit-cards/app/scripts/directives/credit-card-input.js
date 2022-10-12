'use strict';

/**
 * @ngdoc directive
 * PaymentStatus.pendingCapture.directive:hasErrors
 * @description
 * # hasErrors
 */
angular.module('multipleCreditCardsApp')
    .directive('creditCardForm', function (isMobile, configService) {
        return {
            templateUrl: 'views/credit-card.html',
            scope: {
                creditCard: '=',
                pf: '='
            },
            link: function(scope) {
                scope.isMobile = isMobile;
                var thisYear = moment().year();

                configService.config().then(function(methodConfig){
                    scope.processors = methodConfig.processors;
                    scope.documentTypes = methodConfig.documentTypes;
                    scope.numberOfPayments = methodConfig.numberOfPayments;

                    if (scope.documentTypes.length === 1) {
                        scope.creditCard.documentType = methodConfig.documentTypes[0].name;
                    }
                });

                scope.processors = [];
                scope.documentTypes = [];
                scope.total = 0;
                scope.months = _.range(1, 13);
                scope.years = _.range(thisYear, thisYear + 20);


                scope.documentTypeMask = function() {
                    var documentType = _.find(scope.documentTypes, function(type) {
                        return type.name === scope.creditCard.documentType;
                    });

                    if (!documentType) {
                        return '';
                    }
                    else {
                        return documentType.mask;
                    }
                };
            }
        };
    });

