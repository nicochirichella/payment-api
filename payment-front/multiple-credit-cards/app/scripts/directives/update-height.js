'use strict';

/**
 * @ngdoc service
 * PaymentStatus.pendingCapture.heigthResponse
 * @description
 * # heigthResponse
 * Script to return hegith when asked in the multipleCreditCardsApp.
 */
angular.module('multipleCreditCardsApp')
    .run(function (InterframeCommunication, $window, $timeout) {
        InterframeCommunication.registerListener('selected', function() {
            InterframeCommunication.postToParent('height', getHeight());
            $timeout(function(){
                InterframeCommunication.postToParent('height', getHeight());
            });
        });
    })
    .directive('updateHeigth', function(InterframeCommunication){
        return {
            restrict: 'A',
            link: function(scope) {
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