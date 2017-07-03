var express = require('express');
var app = express();
var path = require('path');
var logger = require('./lib/logger');
var https = require('https');
var http = require('http');
var downloadRoutes = require('./routes/download.js')
var uploadRoutes = require('./routes/upload.js')
var purge = require('./lib/purge');
var fs = require('fs');

app.use(express.static(path.join(__dirname, 'public')));

//Needed for rate limiting with c9
//app.set('trust proxy', 1);

app.get('/', function(req, res) {
    res.sendFile(path.join(__dirname, 'views/merge.html'));
});

app.get('/split', function(req, res) {
    res.sendFile(path.join(__dirname, 'views/split.html'));
});

app.get('/terms_privacy', function(req, res) {
    res.sendFile(path.join(__dirname, 'views/terms_privacy.html'));
});


app.use("/", downloadRoutes);
app.use("/", uploadRoutes);

/**
 * Catches errors and logs them 
 **/
app.use(function(error, req, res, next) {
    logger.error(error);
    if (!res.headersSent) {
        res.writeHead(500, {
            'Connection': 'close'
        });
        res.end('Something went wrong...');
    }
});

app.listen(8080, process.env.IP, function() {
    console.log('Server is listening...');
});