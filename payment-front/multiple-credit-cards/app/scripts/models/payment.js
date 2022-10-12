'use strict';

/**
 * @ngdoc service
 * PaymentStatus.pendingCapture.CreditCardModel
 * @description
 * # CreditCardModel
 * CreditCardModel object in the multipleCreditCardsApp.
 */
angular.module('multipleCreditCardsApp')
    .factory('PaymentModel', function (CreditCardModel, PaymentMethod) {
        function Payment(index, amount) {
            this.index = index;
            this.creditCard = new CreditCardModel();
            this.amount = amount;
            this.installments = {installments: null, interestPercentage: null};
        }

        Payment.prototype.toJSON = function () {
            var attrs = this;
            return {
                creditCard: attrs.creditCard.toJSON(),
                amount: attrs.amount,
                installment: attrs.installments,
                interest: this.totalInterest()
            };
        };

        Payment.prototype.isProcessable = function() {
            return (this.isAmountValid() && this.creditCard.isProcessable() && this.installments.installments != null);
        };

        Payment.prototype.formatPaymentForCheckout = function () {
            return PaymentMethod.formatCreditCard(this);
        };

        Payment.prototype.totalInterest = function() {
            var i = this.installments;

            if(!i) {
                return 0;
            }

            var interest = i.interestPercentage;

            return _.round(this.amount * interest / 100, 2);
        };

        Payment.prototype.isAmountValid = function () {
            return !isNaN(parseFloat(this.amount)) && isFinite(this.amount);
        };

        Payment.prototype.updatedInstallmentsList = function() {
            if (this.creditCard._installmentsList.length === 0) {
                this.installments = {installments: null, interestPercentage: null};
            } else {
                var self = this;
                var equivalentInstallment = _.find(this.creditCard._installmentsList, function(i) {
                    i.installments === self.installments.installments;
                });
                this.installments = equivalentInstallment ? equivalentInstallment : _.first(this.creditCard._installmentsList);
            };
        };

        Payment.prototype.updateAmountProportionally = function (proportion, orderTotal) {
            this.amount = _.round(orderTotal * proportion, 2);
        };

        return Payment;
    });
