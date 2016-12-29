
var express = require("express");
var router  = express.Router();
var expressBrute = require('express-brute');
var logger = require('../lib/logger');
var util = require('../lib/util');
var fs = require('fs');
var uuid = require('uuid');
var mergeModule = require('../lib/merge.js')
var splitModule = require('../lib/split.js')
var Busboy = require('busboy');
// Callback for Express Brute
var limitCallback = function(req, res, next, nextValidRequestDate) {
    logger.error(req.ip + ': Too many requests');
    res.writeHead(429, {
        'Connection': 'close'
    });
    res.end('Too many requests....');

};

var store = new expressBrute.MemoryStore();
var bruteforce = new expressBrute(store, {
    freeRetries: 4, //Allow 5 retries before blocking
    minWait: 60 * 1000,
    maxWait: 60 * 1000,
    lifetime: 60,
    refreshTimeoutOnRequest: false,
    attachResetToRequest: false,
    limitCallback: limitCallback
});

/**
 * Handles uploading a PDF(s) and headers
 **/
router.post('/upload', bruteforce.prevent, function(req, res, next) {
    var maxFileSize = 1024 * 1024 * 20; //max file size that can be uploaded
    var busboy = new Busboy({
        headers: req.headers,
        limits: {
            fileSize: maxFileSize
        }
    });

    // Check to make sure that the file that is going to be uploaded is not greater than the max file size allowed.
    var bytesExpected = getBytesExpected(req.headers);
    if (bytesExpected > maxFileSize) {
        return next(new Error('Anticipating a file of size ' + (bytesExpected / (1024 * 1024)) + ' mb. File size is too large'));
    }

    var files = [];
    var splits = [];
    var error = false;
    var type;
    var splitAll = false;
    var splitFileNames = [];
    // Called for each file upload
    busboy.on('file', function(fieldname, file, filename, encoding, mimetype) {
        // Make sure the file is a pdf
        if (mimetype !== 'application/pdf') {
            if (!error) {
                error = true;
                util.removeFiles(files, next);
                req.unpipe(busboy);
                return next(new Error('File is not a valid PDF: ' + mimetype));
            }
            return;
        }
        // If there was no error with another file
        // then save the file
        if (!error) {
            var targetPath = __dirname + '/../uploads/' + uuid.v4();
            files.push(targetPath);
            file.pipe(fs.createWriteStream(targetPath));
            logger.info('Uploading: ' + targetPath);
        }

        // If a file reaches the max file size limit cancel the request
        file.on('limit', function(data) {
            util.removeFiles(files, next);
            req.unpipe(busboy);
            return next(new Error('File limit reached...'));
        });

    });

    // Called for each field
    busboy.on('field', function(fieldname, val, fieldnameTruncated, valTruncated) {
        if (fieldname === 'type') {
            type = val;
        }
        else if (fieldname === 'splits') {
            splits.push(val);
        }
        else if (fieldname === 'splitFileNames') {
            splitFileNames.push(val);
        } else if (fieldname === 'splitAll') {
            splitAll = val;
        }
    });

    // After fields and files are done uploading
    busboy.on('finish', function() {
        logger.info('Done parsing form!');
        if (files.length > 0) {
            if (type === 'merge') {
                mergeModule.merge(files, req, res, next);
            }
            else if (type === 'split') {
                splitModule.split(splits, splitFileNames, splitAll, files[0], req, res, next, maxFileSize);
            }
        }
        else {
            return next(new Error('No Files...'));
        }
    });
    req.pipe(busboy);
});

/**
 * Gets the bytes that are expected from the header
 **/
function getBytesExpected(headers) {
    var contentLength = headers['content-length'];
    if (contentLength) {
        return parseInt(contentLength, 10);
    }
    else if (headers['transfer-encoding'] == null) {
        return 0;
    }
    
    return null;
}

module.exports = router;
