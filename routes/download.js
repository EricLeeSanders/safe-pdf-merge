var express = require("express");
var router  = express.Router();
var logger = require('../lib/logger');
var validator = require('validator');
var sanitize = require('sanitize-filename');
var util = require('../lib/util');

/**
 * Downloads the file based on the type sent. 
 * Either a PDF or a zip.
 **/
router.get('/download', function(req, res, next) {
    // Make sure the UUID is valid
    if (!validator.isUUID(req.query.uuid, 4)) {
        logger.error('Not a valid UUID: ' + req.query.uuid);
        if (!res.headersSent) {
            res.redirect('/');
        }
        return;
    }
    logger.info('Downloading: ' + req.query.uuid + '.' + req.query.type);
    var fileName = req.query.name;
    // Make sure that there is a file name and it is valid
    if (fileName) {
        fileName = sanitize(fileName);
    } else {
        fileName = 'pdf_document';
    }

    if (!res.headersSent) {
        if(req.query.type == 'zip'){
            res.contentType('application/zip');
        } else {
            res.contentType('application/pdf');
        }
        res.download(__dirname + '/../files/' + req.query.uuid + '.' + req.query.type, fileName + '.' + req.query.type, function(error) {
            if (error) {
                logger.error(error);
                if (!res.headersSent) {
                    res.redirect('/');
                }
                return;
            }
            // Remove the file after it is downloaded
            util.removeFile(__dirname + '/../files/' + req.query.uuid + '.' + req.query.type);
        });
    }

});

module.exports = router;