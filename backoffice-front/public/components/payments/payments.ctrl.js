angular
    .module('paymentApp.controllers')
    .controller('backofficeController', ['$scope', '$http', function($scope, $http) {
        $scope.message = 'Hola, BACKOFFICE';
    }]);