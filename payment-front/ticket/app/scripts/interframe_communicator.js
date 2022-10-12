(function (window) {
    window.trocafone = window.trocafone || {};
    window.trocafone.auth = window.trocafone.auth || {};
    var auth = window.trocafone.auth;

    var callbackContainer = {
        error: []
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
            return;
        }

        callbacks.forEach(function (callback) {
            callback.call(window, data);
        });
    }

    auth.registerWindowListener = function (event, callback) {
        addCallback(event, callback);
    };

    auth.postMessage = function (window, event, data) {
        var message = {
            event: event,
            data: data
        };

        window.postMessage(JSON.stringify(message), '*');
    };

    auth.postToParent = function (event, data) {
        if (window === window.parent) {
            throw 'No parent window available.';
        }

        auth.postMessage(window.parent, event, data)
    };

    auth.postToIframe = function ($iframe, event, data) {
        var iframe = $iframe;
        if ($iframe.jquery) {
            var iframe = $iframe[0];
        }

        var win = $iframe.contentWindow;

        auth.postMessage(win, event, data)
    };

    window.onmessage = function (event) {
        try {
            var message = JSON.parse(event.data);
        } catch (e) {
            return applyCallbacks('error', e);
        }

        return applyCallbacks(message.event, message.data);
    }

})(window);