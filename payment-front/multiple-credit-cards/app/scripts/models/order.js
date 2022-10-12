'use strict';

/**
 * @ngdoc service
 * PaymentStatus.pendingCapture.CreditCardModel
 * @description
 * # CreditCardModel
 * CreditCardModel object in the multipleCreditCardsApp.
 */
angular.module('multipleCreditCardsApp')
    .factory('OrderModel', function (PaymentModel, $q) {

        function Order(numberOfPayments, totalAmount) {
            this.totalAmount = totalAmount;
            this.payments = [];
            this.pricesInformation = {price: 1000};
            this.createPayments(numberOfPayments, totalAmount);
        }

        Order.prototype.createPayments = function (numberOfPayments, totalAmount) {
            var self = this;
            var defaultPaymentAmount = Math.round(totalAmount / numberOfPayments);

            _.times(numberOfPayments - 1, function (index) {
                self.payments.push(new PaymentModel(index, defaultPaymentAmount));
            });
            self.payments.push(new PaymentModel(numberOfPayments - 1, this.getSumDifferenceWithTotal()));
        };

        Order.prototype.doRefreshTotalAmount = function () {
            var currentPriceInformation = this.getInstallmentPriceInformation();
            var newTotalAmount = _.round(currentPriceInformation.price, 2);
            var oldTotalAmount = this.totalAmount;
            this.totalAmount = newTotalAmount;
            this.doAdjustPaymentAmountsProportionally(oldTotalAmount, newTotalAmount);
        };

        Order.prototype.getInstallmentPriceInformation = function () {
            return this.pricesInformation;
        };

        Order.prototype.doAdjustLastPayment = function () {
            if (this.areAllPaymentAmountsValid()) {
                this.getLastPayment().amount = _.round(this.getLastPayment().amount + this.getSumDifferenceWithTotal(), 2);
            }
        };

        Order.prototype.getSumDifferenceWithTotal = function () {
            return _.round(this.totalAmount - this.getSumOfPayments(), 2);
        };

        Order.prototype.doAdjustPaymentAmountsProportionally = function (oldTotalAmount, newTotalAmount) {
            if (this.areAllPaymentAmountsValid()) {
                _.forEach(this.payments, function (payment) {
                    var proportionToTotal = _.round(payment.amount / oldTotalAmount, 4);
                    payment.updateAmountProportionally(proportionToTotal, newTotalAmount);
                });
                this.doAdjustLastPayment()
            }
        };

        Order.prototype.getPaymentListForCheckout = function (iterator) {

            var firstPayment = this.payments[0];
            var secondPayment = this.payments[1];

            if (!firstPayment || !secondPayment) {
                console.error("There must be 2 payments.");
                return $q(function(resolve,reject) {
                    return resolve();
                });
            }

            return firstPayment.formatPaymentForCheckout().then(function (p1) {
                return secondPayment.formatPaymentForCheckout().then(function (p2) {
                    return [p1, p2];
                });
            }).catch(function (err) {
                console.error("There was an error formating payments", err);
            });

        };

        Order.prototype.areAllPaymentAmountsValid = function () {
            return _.every(this.payments, function (payment) {
                return payment.isAmountValid()
            });
        };

        Order.prototype.areAllPaymentsProcessable = function () {
            return _.every(this.payments, function (payment) {
                return payment.isProcessable()
            });
        };

        Order.prototype.getSumOfPayments = function () {
            var sum = _.reduce(this.payments, function (sum, payment) {
                return sum + parseFloat(payment.amount);
            }, 0);

            return _.round(sum, 2);
        };

        Order.prototype.getSumOfInterest = function() {
            var sum = _.sum(this.payments, function(p) {
                return p.totalInterest();
            });

            return _.round(sum, 2);
        };

        Order.prototype.getSumOfPaymentsWithInterest = function () {
            return _.round(this.getSumOfInterest() + this.getSumOfPayments(), 2)
        };

        Order.prototype.getLastPayment = function () {
            return _.last(this.payments);
        };

        return Order;
    });
