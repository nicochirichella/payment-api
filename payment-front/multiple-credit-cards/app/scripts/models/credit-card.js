'use strict';

/**
 * @ngdoc service
 * PaymentStatus.pendingCapture.CreditCardModel
 * @description
 * # CreditCardModel
 * CreditCardModel object in the multipleCreditCardsApp.
 */
angular.module('multipleCreditCardsApp')
    .factory('CreditCardModel', function (nullProcessor, PaymentMethod, nullInstallments, $q) {

        function CreditCard() {
            this.processor = nullProcessor;
            this._installmentsList = [];
            this.amount = 0;
            this.installments = nullInstallments;
        }

        var checkAlgorithm = {
            falsy: function () {
                return false;
            },
            luhn: (function (arr) {
                return function (ccNum) {
                    var len = ccNum.length,
                        bit = 1,
                        sum = 0,
                        val;

                    while (len) {
                        val = parseInt(ccNum.charAt(--len), 10);
                        sum += (bit ^= 1) ? arr[val] : val;
                    }

                    return sum && sum % 10 === 0;
                };
            }([0, 2, 4, 6, 8, 1, 3, 5, 7, 9]))
        };

        CreditCard.prototype.toJSON = function () {
            var attrs = this;
            return {
                brand: attrs.processor.toJSON(),
                installments: attrs.installments.installments,
                number: attrs.number,
                expirationMonth: attrs.expirationMonth,
                expirationYear: attrs.expirationYear,
                holderName: attrs.holderName,
                securityCode: attrs.securityCode,
                documentType: attrs.documentType,
                documentNumber: attrs.documentNumber,
                amount: attrs.amount
            };
        };

        CreditCard.prototype.isProcessable = function() {
            return (this.validCardNumber()
            && this.expirationMonth
            && this.expirationYear
            && this.holderName
            && this.securityCode)
        };


        CreditCard.prototype.hasInstallments = function () {
            return this.processor.hasInstallments(this.number.substring(0, 6));
        };

        CreditCard.prototype.installmentsList = function () {
            return this._installmentsList;
        };

        CreditCard.prototype.validCardNumber = function () {
            var algorithm = this.processor.checkAlgorithm();
            return checkAlgorithm[algorithm](this.number);
        };

        CreditCard.prototype.getProcessorId = function () {
            return this.processor.id;
        };

        CreditCard.prototype.getLastFourDigits = function () {
            return this.number.substring(this.number.length - 4);
        };

        CreditCard.prototype.getFirstSixDigits = function () {
            return this.number.substring(0, 6);
        };

        CreditCard.prototype.updateProcessor = function (newValue, oldValue) {
            if (!newValue || newValue.length < 6) {
                this.processor = nullProcessor;
                this._installmentsList = [];
                return $q.resolve(this.processor);
            }

            var newBin = newValue.substring(0, 6);

            if (!oldValue || oldValue.substring(0, 6) !== newBin) {
                var self = this;
                return PaymentMethod.getProcessor(newBin)
                    .then(function (processor) {
                        self.processor = processor;

                        if (self.hasInstallments()) {
                            self._installmentsList = processor.installments;
                        }
                        else {
                            var firstInstallment = _.find(processor.installments, function (i) {
                                return i.installments === 1;
                            });
                            self._installmentsList = firstInstallment ? [firstInstallment] : [];
                        }
                    });
            } else {
                return $q.resolve(this.processor);
            }
        };

        return CreditCard;
    });
