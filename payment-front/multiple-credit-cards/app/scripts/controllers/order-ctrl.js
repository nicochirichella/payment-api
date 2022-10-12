'use strict';

angular.module('multipleCreditCardsApp')
    .controller('OrderCtrl', function ($location, $scope, isMobile, OrderModel, InterframeCommunication, $timeout, configService) {
        $scope.configSucceed = false;
        $scope.configLoaded = false;

        $scope.isMobile = isMobile;

        var errorDelay = 500;

        var init = _.before(10, function() {
          configService.config().then(function(config) {
                $scope.configSucceed = true;
                $scope.configLoaded = true;
            })
            .catch(function(err) {
                console.error('Error loading payment method config', err);
                $scope.configLoaded = true;
                $timeout(init, errorDelay);
                errorDelay *= 2;
            });
        });

        init();

        //Initializations
        $scope.payments = [];
        $scope.forms = {};
        var numberOfPayments = $location.search().numberofpayments;      
        $scope.order = new OrderModel(numberOfPayments, 1000);
        
        $scope.abTesting = $location.search().ab === 'true';
       
        
        //Angular event bindings.
        $scope.$on('amountUpdated', function (event, data) {
            $scope.order.doAdjustLastPayment();
            postPaymentData()
        });

        $scope.$on('installmentUpdated', function (event, data) {
            $scope.order.doRefreshTotalAmount();
            postUpdatedInterest();
            postPaymentData();
        });


        //Interframe

        function postUpdatedInterest() {
            InterframeCommunication.postToParent("updatePaymentDiscountInfo", {
                "interest": $scope.order.getSumOfInterest()
            });
        }

        function postPaymentDataWithErrors() {
            //Active
            var orderForm = $scope.forms.orderfrm;
            if (orderForm.$valid && $scope.order.areAllPaymentsProcessable()) {
                $scope.order.getPaymentListForCheckout()
                    .then(function (paymentList) {
                        InterframeCommunication.postToParent('paymentData', {payments: paymentList, passive: false});
                    }).catch(getPaymentDataError);
            }
            else {
                getPaymentDataError();
            }
        }

        function postPaymentData() {
            //Passive
            var orderForm = $scope.forms.orderfrm;
            if (orderForm.$valid && $scope.order.areAllPaymentsProcessable()) {
                $scope.order.getPaymentListForCheckout()
                    .then(function (paymentList) {
                        InterframeCommunication.postToParent('paymentData', {payments: paymentList, passive: true});
                    });
            }
        }

        function formatCheckoutPricesData(data) {
            return { price: data.total };
        };

        function getPaymentDataError() {
            InterframeCommunication.postToParent('inputError');
            $('input,select').trigger('blur');
        };

        InterframeCommunication.registerListener('updateTotalPrice', function (data) {
            $scope.$apply(function () {
                var newPrice = formatCheckoutPricesData(data);
                if (!$scope.order.pricesInformation || $scope.order.pricesInformation.price != newPrice.price) {
                    $scope.order.pricesInformation = newPrice;
                    $scope.order.doRefreshTotalAmount();
                    postUpdatedInterest(data);
                    postPaymentData();
                }
            });
        });

        InterframeCommunication.registerListener('selected', postUpdatedInterest);

        InterframeCommunication.registerListener('getPaymentData', postPaymentDataWithErrors);
    });
