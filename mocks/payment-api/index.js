//Libs
var mockserver        = require('mockserver-grunt');
var mockServerClient  = require('mockserver-client').mockServerClient;

//Controllers
var payments = require('./controllers/payments');
var methods = require('./controllers/methods');

//CONFIGURATION
var HTTP_PORT = 3006;



mockserver.start_mockserver({
        serverPort: HTTP_PORT
    }).then(function(){
        mockServerClient("localhost", HTTP_PORT).mockAnyResponse(payments.getPayment('EC-5R000484266837212'));
        mockServerClient("localhost", HTTP_PORT).mockAnyResponse(payments.getPayment('EC-5R000484266837213'));
        mockServerClient("localhost", HTTP_PORT).mockAnyResponse(payments.cancelPayment('EC-5R000484266837212'));
        mockServerClient("localhost", HTTP_PORT).mockAnyResponse(payments.cancelPayment('EC-5R000484266837213'));
        mockServerClient("localhost", HTTP_PORT).mockAnyResponse(payments.postPayment("redirect",{"redirectUrl":"https://www.google.com.ar/redirect"}));
        //mockServerClient("localhost", HTTP_PORT).mockAnyResponse(payments.postPayment("none",{}));
      //  mockServerClient("localhost", HTTP_PORT).mockAnyResponse(payments.postPayment("redirect",{}));
        mockServerClient("localhost", HTTP_PORT).mockAnyResponse(methods.getMethods());
    });

console.log("started on port: " + HTTP_PORT);

// stop MockServer if Node exist abnormally
process.on('uncaughtException', function (err) {
    console.log('uncaught exception - stopping node server: ' + JSON.stringify(err));
    mockserver.stop_mockserver();
    throw err;
});

// stop MockServer if Node exits normally
process.on('exit', function () {
    console.log('exit - stopping node server');
    mockserver.stop_mockserver();
});

// stop MockServer when Ctrl-C is used
process.on('SIGINT', function () {
    console.log('SIGINT - stopping node server');
    mockserver.stop_mockserver();
    process.exit(0);
});

// stop MockServer when a kill shell command is used
process.on('SIGTERM', function () {
    console.log('SIGTERM - stopping node server');
    mockserver.stop_mockserver();
    process.exit(0);
});
