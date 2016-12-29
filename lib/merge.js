var PDFtk = require('node-pdftk');
var pdftk = new PDFtk();
var uuid = require('uuid');
var util = require('./util');
var logger = require('./logger');

/**
 * Merges multiple PDFs
 **/
exports.merge = function(files, req, res, next) {
    var randName = uuid.v4();
    var randFilePath = __dirname + '/../files/' + randName + '.pdf';
    pdftk.merge(files, randFilePath, function(error, filePath) {
        if (error) {
            util.removeFiles(files);
            return next(error);
        }
        logger.info('Merged pdfs');
        util.saveToDB(req.ip, 'merge', files.length, randFilePath);
        if (!res.headersSent) {
            var resData = {
                type: 'pdf',
                uuid: randName
            }
            res.status(201);
            res.contentType('application/json');
            res.send(JSON.stringify(resData));
        }
        util.removeFiles(files); //Remove the uploaded files
    });
}