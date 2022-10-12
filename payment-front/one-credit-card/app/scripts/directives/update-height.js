'use strict';

/**
 * @ngdoc service
 * PaymentStatus.pendingCapture.heigthResponse
 * @description
 * # heigthResponse
 * Script to return hegith when asked in the oneCreditCardApp.
 */
angular.module('oneCreditCardApp')
    .run(function (InterframeCommunication, $window, $timeout) {
        InterframeCommunication.registerListener('selected', function() {
            InterframeCommunication.postToParent('height', getHeight());
            $timeout(function(){
                InterframeCommunication.postToParent('height', getHeight());
            });
        });
    })
    .directive('updateHeigth', function(InterframeCommunication, $timeout){
        return {
            restrict: 'A',
            link: function(scope, el, args, formController) {
                scope.$watch(function() {
                    scope.__height = getHeight();
                })

                scope.$watch('__height', function(newVal, oldVal) {
                    if (newVal !== oldVal) {
                        InterframeCommunication.postToParent('height', scope.__height);
                    }
                })
            }
        };
  });

function getHeight() {
    var body = document.body,
        html = document.documentElement;

    return 5 + Math.max(
        body.offsetHeight,
        html.offsetHeight
    );
}