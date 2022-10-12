'use strict';

/**
 * @ngdoc service
 * PaymentStatus.pendingCapture.InterframeCommunication
 * @description
 * # InterframeCommunication
 * Factory in the oneCreditCardApp.
 */
angular.module('oneCreditCardApp')
  .factory('InterframeCommunication', function ($window) {
    var comm = {};

    var callbackContainer = {
        '_error': [],
        '_eventMissing': []
    };

    function addCallback(event, callback) {
        var callbacks = callbackContainer[event];

        if (!callbacks) {
            callbacks = callbackContainer[event] = [];
        }

        callbacks.push(callback);
    }

    function applyCallbacks(event, data) {
        var callbacks = callbackContainer[event];

        if (!callbacks) {
            data = data || {};
            data._originalEvent = event;
            return applyCallbacks('_eventMissing', data);
        }

        callbacks.forEach(function(callback) {
            callback.call($window, data);
        });
    }

    comm.registerListener = function (event, callback) {
        addCallback(event, callback);
    };

    comm.postMessage = function (window, event, data) {
        var message = {
            event: event,
            data: data
        };

        window.postMessage(JSON.stringify(message), '*');
    };

    comm.postToParent = function (event, data) {
        if ($window === $window.parent) {
            throw 'No parent window available.';
        }

        comm.postMessage($window.parent, event, data)
    };

    comm.postToIframe = function ($iframe, event, data) {
        var iframe = $iframe;
        if ($iframe.jquery) {
            var iframe = $iframe[0];
        }

        var win = $iframe.contentWindow;

        comm.postMessage(win, event, data)
    };

    $window.onmessage = function(event){
        try {
            var message = JSON.parse(event.data);
        } catch (e) {
            return applyCallbacks('_error', e);
        }

        return applyCallbacks(message.event, message.data);
    }

    return comm;
  })
  .run(function(InterframeCommunication){});
