'use strict';

angular.module('multipleCreditCardsApp')
    .controller('PaymentCtrl', function ($scope) {

        //Initializations
        $scope.indexMap = ['Primeiro', 'Segundo', 'Terceiro', 'Quarto', 'Quinto', 'Sexto', 'Sétimo', 'Oitavo', 'Nono', 'Décimo'];
        $scope.forms = {};


        //Angular event emitters
        $scope.paymentUpdated = function (newValue, oldValue) {
            $scope.$emit('amountUpdated', $scope.payment.amount);
        };

        $scope.$watch('payment.installments.installments', function (newValue, oldValue) {
            $scope.$emit('installmentUpdated');
        });

        $scope.$watch('payment.creditCard._installmentsList', function (newValue, oldValue) {
            $scope.payment.updatedInstallmentsList();
        });

        //Utilities
        $scope.formatInstallment = function (installments) {
            var total = $scope.payment.amount;
            var discountPercentage = installments.interestPercentage;
            var interest = _.round(total * discountPercentage / 100, 2);
            var totalWithInterest = _.round(total + interest, 2);
            var i = installments.installments;

            var postMessage = "";
            if(interest < 0){
                postMessage = " " + $scope.formatMoney(discountPercentage, 2) + "% Off";
            }
            else if (interest > 0) {
                postMessage = " 0,99% a.m."
            }

            var instAmount = _.round(totalWithInterest / i, 2);

            return '' + i + 'x de R$' + $scope.formatMoney(instAmount, 2) + ' (total R$' + $scope.formatMoney(totalWithInterest, 2) + ')' + postMessage;
        };

        $scope.formatMoney = function(n, c, d, t){
            var j, c = isNaN(c = Math.abs(c)) ? 2 : c,
                d = d == undefined ? "," : d,
                t = t == undefined ? "." : t,
                s = n < 0 ? "-" : "",
                i = String(parseInt(n = Math.abs(Number(n) || 0).toFixed(c)));
            j = (j = i.length) > 3 ? j % 3 : 0;
            return s + (j ? i.substr(0, j) + t : "") + i.substr(j).replace(/(\d{3})(?=\d)/g, "$1" + t) + (c ? d + Math.abs(n - i).toFixed(c).slice(2) : "");
        };

    });
