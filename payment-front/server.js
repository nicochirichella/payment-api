"use strict";

var fs = require('fs');
var express = require('express');

var app = express();

var port = 9443;

if (true) {
    var https       = require('https');
    var privateKey  = fs.readFileSync('./cert/server.key', 'utf8');
    var certificate = fs.readFileSync('./cert/server.crt', 'utf8');
    var credentials = { key: privateKey, cert: certificate };

    var server = https.createServer(credentials, app);
    server.listen(port, function() {
        console.log('Listening on port %d in', port);
    });
}
// else {
//     var http = require('http');

//     server = http.createServer(app);
//     server.listen(port, function() {
//         log.info('server_listen', { env: config.get('env'), port: port, ssl: false }, 'Listening on port %d in %s mode', port, config.get('env'));
//     });
// }