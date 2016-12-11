var express = require('express');
var app = express();
var path = require('path');
var PDFMerge = require('pdf-merge');
var uuid = require('uuid');
var fs = require('fs');
var Busboy = require('busboy');
var ExpressBrute = require('express-brute');
var validator = require('validator');
var sanitize = require('sanitize-filename');
var spm_util = require('./lib/util');
var spm_purge = require('./lib/purge');
var logger = require('./lib/logger');
var https = require('https');
var http = require('http');
var PDFSplit = require('pdf-split');
var Zip = require('node-zip');

// Callback for Express Brute
var limitCallback = function(req, res, next, nextValidRequestDate) {
    logger.error(req.ip + ': Too many requests');
    res.writeHead(429, {
        'Connection': 'close'
    });
    res.end('Too many requests....');

};

var store = new ExpressBrute.MemoryStore();
var bruteforce = new ExpressBrute(store, {
    freeRetries: 4, //Allow 5 retries before blocking
    minWait: 60 * 1000,
    maxWait: 60 * 1000,
    lifetime: 60,
    refreshTimeoutOnRequest: false,
    attachResetToRequest: false,
    limitCallback: limitCallback
});

app.use(express.static(path.join(__dirname, 'public')));
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

/**
 * Downloads the file based on the type sent. 
 * Either a PDF or a zip.
 **/
app.get('/download', function(req, res, next) {
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
        res.download(__dirname + '/files/' + req.query.uuid + '.' + req.query.type, fileName + '.' + req.query.type, function(error) {
            if (error) {
                logger.error(error);
                if (!res.headersSent) {
                    res.redirect('/');
                }
                return;
            }
            // Remove the file after it is downloaded
            removeFile(__dirname + '/files/' + req.query.uuid + '.' + req.query.type);
        });
    }

});

/**
 * Handles uploading a PDF(s) and headers
 **/
app.post('/upload', bruteforce.prevent, function(req, res, next) {
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
                removeFiles(files, next);
                req.unpipe(busboy);
                return next(new Error('File is not a valid PDF: ' + mimetype));
            }
            return;
        }
        // If there was no error with another file
        // then save the file
        if (!error) {
            var targetPath = __dirname + '/uploads/' + uuid.v4();
            files.push(targetPath);
            file.pipe(fs.createWriteStream(targetPath));
            logger.info('Uploading: ' + targetPath);
        }

        // If a file reaches the max file size limit cancel the request
        file.on('limit', function(data) {
            removeFiles(files, next);
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
                merge(files, req, res, next);
            }
            else if (type === 'split') {
                split(splits, splitFileNames, splitAll, files[0], req, res, next, maxFileSize);
            }
        }
        else {
            return next(new Error('No Files...'));
        }
    });
    req.pipe(busboy);
});


/**
 * Removes multiple files
 **/
function removeFiles(files, next) {
    logger.info('Removing files');
    files.forEach(function(file) {
        removeFile(file, next);
    });
}

/**
 * Removes a file
 **/
function removeFile(file, next) {
    logger.info('Removing file: ' + file);
    fs.unlink(file, function(error) {
        if (error) {
            // Not a critical error, so don't throw it
            logger.error("Error removing file: " + error)
            return;
        }
        logger.info(file + ': deleted successfully');
    });
}

/**
 * Merges multiple PDFs
 **/
function merge(files, req, res, next) {
    var pdfMerge = new PDFMerge(files);
    var randName = uuid.v4();
    var randFilePath = __dirname + '/files/' + randName + '.pdf';
    pdfMerge.asNewFile(randFilePath).merge(function(error, filePath) {
        if (error) {
            removeFiles(files);
            return next(error);
        }
        logger.info('Merged pdfs');
        spm_util.saveToDB(req.ip, 'merge', files.length, randFilePath);
        if (!res.headersSent) {
            var resData = {
                type: 'pdf',
                uuid: randName
            }
            res.status(201);
            res.contentType('application/json');
            res.send(JSON.stringify(resData));
        }
        removeFiles(files); //Remove the uploaded files
    });
}

/**
 * Begins the process of splitting a PDF.
 **/
function split(splits, splitFileNames, splitAll, file, req, res, next, maxFileSize) {
    var pdfSplitHelper = new PDFSplit(file);
    validateSplits(pdfSplitHelper, splits, file, next, maxFileSize, res, splitPDF.bind(this, file, splitFileNames, splitAll, pdfSplitHelper, req, res, next));
}

/**
 * Calls the PDFSplit to split a pdf. 
 * Determines wether the PDF(s) should be zipped or not.
 **/
function splitPDF(file, splitFileNames, splitAll, pdfSplitHelper, req, res, next, splits) {
    var randName;
    var randFilePaths = [];
    logger.info('Splitting: ' + file);

    if(splitAll === "true"){
        splits = createSplitsForAllPages(splits, splitFileNames, next);
    }
    for (var i = 0, remaining = splits.length; i < splits.length; i++) {
        randName = uuid.v4();
        randFilePaths.push(__dirname + '/files/' + randName + '.pdf');
        pdfSplitHelper.split(splits[i], randFilePaths[i], function(error, filePath) {
            if (error) {
                return next(error);
            }
            remaining--;
            if (remaining <= 0) {
                if (splits.length > 1) {
                    zipSplits(splitFileNames, randFilePaths, req, res, next);
                }
                else {
                    spm_util.saveToDB(req.ip, 'split', splits.length, randFilePaths[0]);
                    if (!res.headersSent) {
                        var resData = {
                            type: 'pdf',
                            uuid: randName
                        }
                        res.status(201);
                        res.contentType('application/json');
                        res.send(JSON.stringify(resData));
                    }
                }
                removeFile(file, next) // remove uploaded file
            }

        });
    }
}

/**
 * Validates the split inputs and ensures that they are in the correct format.
 * If a split is not in the correct format, it is skipped and will not be used.
 * Also estimates how big the output of the file(s) will be. 
 * fileSplits holds the splits for each file. A pseudo 2d array.
 **/
function validateSplits(pdfSplitHelper, fileSplits, file, next, maxFileSize, res, callback) {
    logger.info('Validating: ' + file);
    fs.stat(file, function(error, stats) {
        if (error) {
            removeFile(file, next);
            return next(error);
        }
        var fileSize = stats["size"];
        logger.info(file + ': - size: ' + fileSize);
        // Get the number of pages that the pdf has
        pdfSplitHelper.numPages(function(error, numPages) {
            if (error) {
                removeFile(file, next);
                return next(error);
            }
            else if (!numPages || numPages <= 0) {
                removeFile(file, next);
                return next(new Error(file + ': Error getting the number of pages.'));
            }
            numPages = numPages.replace(/^\s+|\s+$/g, ''); //Remove whitespace, tabs, new lines
            logger.info(file + ': Number of Pages: ' + numPages);
            var sizePerPage = fileSize / numPages;
            var totalPageCount = 0;
            var parsedSplits = [];
            // Begin to parse all of the split inputs to verify they are
            // valid inputs
            logger.info(file + ': File Splits: ' + fileSplits);
            fileSplits.forEach(function(splits) {
                splits = splits.replace(/ /g, ''); //remove whitespace

                // Get all of the splits for a file
                // ex 4-7,11-18
                var matches = splits.match(/\d+-\d+/g);
                if (!matches) {
                    return next(new Error('Error parsing the split inputs.'));
                }

                var parsedMatch = [];
                // Parse each individual split
                matches.forEach(function(split) {
                    split = split.replace(/ /g, ''); //remvoe whitespace

                    // Get each individual split
                    // ex 4-7
                    var numbers = split.match(/(\d+)-(\d+)/);

                    // If a page input is greater than the number of pages
                    // we change the number to the number of pages
                    if (parseInt(numbers[1], 10) > numPages) {
                        numbers[1] = numPages;
                    }
                    if (parseInt(numbers[2], 10) > numPages) {
                        numbers[2] = numPages;
                    }
                    // If a page input is 0 or less 
                    // then we change the number to 1
                    if (parseInt(numbers[1], 10) <= 0) {
                        numbers[1] = 1;
                    }
                    if (parseInt(numbers[2], 10) <= 0) {
                        numbers[2] = 1;
                    }

                    // Get the total page count for each split and add to the total
                    totalPageCount += Math.abs(numbers[2] - numbers[1]) + 1;

                    // Recreate the the split
                    var strSplit = numbers[1].toString() + '-' + numbers[2].toString();
                    parsedMatch.push(strSplit);
                });
                parsedSplits.push(parsedMatch);
            });
            logger.info(file + ': Parsed Splits: ' + parsedSplits);
            var estFileSize = totalPageCount * sizePerPage;
            logger.info(file + ': Estimated File Size: ' + estFileSize);
            if (estFileSize > maxFileSize) {
                if (!res.headersSent) {
                    res.writeHead(413, {
                        'Connection': 'close'
                    });
                    res.end('Size of PDFs created exceeds the limit');
                }
                removeFile(file, next);
                return;
            }
            if (parsedSplits <= 0) {
                removeFile(file, next)
                return next(new Error('No Files...'));
            }
            callback(parsedSplits);
        });
    });
}

/**
 * Creates splits for all pages if splitAll is true
 **/
 function createSplitsForAllPages(fileSplits, splitFileNames, next){
    logger.info("Creating splits for all pages");
    // use the first filename as the filename
    // the array should only have one element in it
    var fileName = splitFileNames[0];
    splitFileNames.splice(0, splitFileNames.length);
    
    var parsedSplits = [];
    // Parse each individual split
    // only get the first file split.
    // fileSplits should only have one element in it
    fileSplits[0].forEach(function(split) {
        
        // Get each individual split
        // ex 4-7
        var numbers = split.match(/(\d+)-(\d+)/);

        if(parseInt(numbers[1]) > parseInt(numbers[2])){
            var tmp = numbers[2];
            numbers[2] = numbers[1];
            numbers[1] = tmp;
        }
        
        for(var i = parseInt(numbers[1]); i <= parseInt(numbers[2]); i++){
            var strSplit = i + '-' + i;
            parsedSplits.push(strSplit);
            splitFileNames.push(fileName ? fileName + "-" + i : i);
        }
    });

    return parsedSplits;
 }

/**
 *  Zips multiple PDFs
 **/
function zipSplits(splitFileNames, filePaths, req, res, next) {
    var zip = new Zip();
    logger.info('Zipping files');
    for (var i = 0, remaining = filePaths.length; i < filePaths.length; i++) {
        (function(i) {
            fs.readFile(filePaths[i], 'binary', function(error, buffer) {
                if (!splitFileNames[i]) {
                    splitFileNames[i] = 'split_document_' + (i + 1);
                }
                splitFileNames[i] = sanitize(splitFileNames[i]);
                zip.file(splitFileNames[i] + '.pdf', buffer, {
                    binary: true
                });
                logger.info('Zipping: ' + filePaths[i]);
                remaining--;
                if (remaining <= 0) {
                    var randName = uuid.v4();
                    var filePath = __dirname + '/files/' + randName + '.zip';
                    fs.writeFile(filePath, zip.generate({
                        compression: 'DEFLATE',
                        type: 'base64'
                    }), 'base64', function(error) {
                        if (error) {
                            removeFiles(filePaths);
                            return next(error);
                        }
                        logger.info("All files zipped");
                        spm_util.saveToDB(req.ip, 'split', filePaths.length, filePath);
                        if (!res.headersSent) {
                            var resData = {
                                type: 'zip',
                                uuid: randName
                            }
                            res.status(201);
                            res.contentType('application/json');
                            res.send(JSON.stringify(resData));
                            removeFiles(filePaths, next)
                        }
                    });
                }
            });
        })(i);
    }
}

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

app.listen(process.env.PORT, process.env.IP, function() {
    console.log('Server is listening...');
});

// http.createServer(function(req, res) {
//     res.writeHead(301, {
//         "Location": "https://" + req.headers['host'] + req.url
//     });
//     res.end();
// }).listen(80);

// var options = {
//     ca: fs.readFileSync(__dirname + '/ssl/www_safepdfmerge_com.ca-bundle'),
//     key: fs.readFileSync(__dirname + '/ssl/safe-pdf-merge-ssl.pem'),
//     cert: fs.readFileSync(__dirname + '/ssl/www_safepdfmerge_com.crt')
// };

// var httpsServer = https.createServer(options, app);
// httpsServer.listen(443);