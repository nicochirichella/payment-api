var config      = require('./config/config');
var app         = require('./app');
var https       = require('https');
var fs          = require('fs');
var privateKey  = fs.readFileSync('../cert/server.key', 'utf8');
var certificate = fs.readFileSync('../cert/server.crt', 'utf8');

var credentials = { key: privateKey, cert: certificate };

var httpsServer = https.createServer(credentials, app);
var port = parseInt(config.port||8444);
httpsServer.listen(port, function() {
    console.log('PAYMENT-FRONT Express server listening on port %d in %s mode', port, config.env);
});