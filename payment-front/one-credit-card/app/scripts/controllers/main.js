'use strict';

/**
 * @ngdoc function
 * PaymentStatus.pendingCapture.controller:MainCtrl
 * @description
 * # MainCtrl
 * Controller of the oneCreditCardApp
 */
angular.module('oneCreditCardApp')
  .controller('MainCtrl', function ($scope, isMobile, configService, $timeout, $location) {
    $scope.configSucceed = false;
    $scope.configLoaded = false;
    $scope.isMobile = isMobile;

    $scope.abTesting = $location.search().ab === 'true';

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
  });
