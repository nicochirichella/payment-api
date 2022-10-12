var fs      = require('fs');
var util    = require('util');
var express = require('express');
var logger  = require('morgan');
var config  = require('./config/config');

var app = express();
app.use('/', express.static('./public'));

app.use(function(req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
});

app.use(function(err, req, res, next) {
    res
        .status(err.status||500)
        .json({ errors: [ { code: err.status||500, message: err.message||'Internal server error' } ]});
});

module.exports = app;