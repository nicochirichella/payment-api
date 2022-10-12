'use strict';

/**
 * @ngdoc function
 * PaymentStatus.pendingCapture.controller:CreditCardCtrl
 * @description
 * # CreditCardCtrl
 * Controller of the oneCreditCardApp
 */
angular.module('oneCreditCardApp')
  .controller('CreditCardCtrl', function ($scope, PaymentMethod, nullProcessor, nullInstallments,  InterframeCommunication, CreditCardModel, configService, CybersourceScript, FORMATTER) {
    var thisYear = moment().year();
    configService.config().then(function(methodConfig){
      $scope.processors = methodConfig.processors;
      $scope.documentTypes = methodConfig.documentTypes;
      $scope.config = methodConfig;

      if ($scope.documentTypes.length === 1) {
        $scope.creditCard.documentType = methodConfig.documentTypes[0].name;
      }
    });


      var runScript = function(value) {
          if ($scope.config && $scope.orderInformation) {
              CybersourceScript.loadScript($scope.orderInformation.transactionHash);
          }
      };

    $scope.$watch('config.formatter', runScript);
    $scope.$watch('orderInformation', runScript);

    $scope.processors = [];
    $scope.documentTypes = [];
    $scope.total = 0;
    $scope.months = _.range(1, 13);
    $scope.years = _.range(thisYear, thisYear + 20);
    $scope.creditCard = new CreditCardModel();

    function reportInstallmentsChange(){
      InterframeCommunication.postToParent("updatePaymentDiscountInfo", {
        "interest": $scope.creditCard.totalInterest()
      });
    }

    function calculateTotals(installments) {
      var total = $scope.total;
      var discountPercentage = installments.interestPercentage;
      var interest = _.round(total * discountPercentage / 100, 2);

      return {
        total: _.round(total + interest, 2),
        discountPercentage: discountPercentage,
        interest: interest,
        totalWithoutInterest: total
      };
    }

    function updateCreditCardTotal(){
      if ($scope.creditCard.amount != $scope.total) {
        $scope.creditCard.amount = $scope.total;
        reportInstallmentsChange();
      }
    }

    $scope.$watch('creditCard.installments', function(newValue, oldValue) {
      if (!newValue) {
        newValue = nullInstallments;
        $scope.creditCard.installments = nullInstallments;
      }

      if (!newValue || !oldValue || newValue.installments !== oldValue.installments) {
        reportInstallmentsChange();
      }
    });

    $scope.formatInstallment = function(installment) {
      var i = installment.installments;
      var totals = calculateTotals(installment);
      var total = totals.total;

      var postMessage = "";
      if(totals.interest < 0){
        postMessage = " " + $scope.formatMoney(totals.discountPercentage, 2) + "% Off";
      }
      else if (totals.interest > 0) {
        postMessage = " 0,99% a.m."
      }

      var instAmount = _.round(total / i, 2);

      return '' + i + 'x de R$' + $scope.formatMoney(instAmount, 2) + ' (total R$' + $scope.formatMoney(total, 2) + ')' + postMessage;
    };

    $scope.documentTypeMask = function() {
      var documentType = _.find($scope.documentTypes, function(type) {
        return type.name === $scope.creditCard.documentType;
      });

      if (!documentType) {
        return '';
      }
      else {
        return documentType.mask;
      }
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

    InterframeCommunication.registerListener('selected', reportInstallmentsChange);

    InterframeCommunication.registerListener('updateTotalPrice', function(data){
      $scope.$apply(function(){
        $scope.total = data.total;
        $scope.installmentTotals = data.installmentTotals;
        updateCreditCardTotal();
        sendPaymentData(true, function() {});
      });
    });

    function postErrorAndBlur(e) {
        if (e) {
          console.error(e);
        }
        InterframeCommunication.postToParent('inputError');
        $('input,select').trigger('blur');
    };

    function sendPaymentData(passivity, catchFn) {
        var cc = $scope.ccf;
        if (cc.$valid) {
            PaymentMethod.formatCreditCard($scope.creditCard)
                .then(function(card) {
                    InterframeCommunication.postToParent('paymentData', {payments: [card], passive: passivity});
                })
                .catch(catchFn);
        }
        else {
            catchFn()
        }
    }

    InterframeCommunication.registerListener('getPaymentData', function(){
        sendPaymentData(false, postErrorAndBlur);
    });

      InterframeCommunication.registerListener('orderInformation', function(data){
          $scope.orderInformation = data;
      });
  });
