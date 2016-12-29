var logger = require('./logger');
var PDFtk = require('node-pdftk');
var pdftk = new PDFtk();
var uuid = require('uuid');
var util = require('./util');
var fs = require('fs');
var Zip = require('node-zip');
var sanitize = require('sanitize-filename');
var async = require('async');

exports.split = function(allFileSplits, splitFileNames, splitAll, file, req, res, next, maxFileSize) {
	
	async.waterfall([
		
		async.apply(getFileSizeAndNumPages, file), //callback(null, numPages, fileSize);
		async.apply(validateSplits, allFileSplits, file, maxFileSize, res), //callback(parsedSplits);

		// create splits for all pages if need be
		// otherwise just split the file
	    function(parsedSplits, callback){
	        if(splitAll == "true") {
				burstPages(file, splitFileNames, req, res, parsedSplits, callback);
	        } else {
				splitPDF(file, splitFileNames, req, res, parsedSplits, callback);
	        }
	    },
	    

	], function(error, result){
		
		if (error) {
			return next(error);
		}
		logger.info("Done splitting");
		util.removeFile(file) // remove uploaded file
	});

	
}

function getFileSizeAndNumPages(file, callback){
	
	logger.info('Getting number of pages');
	pdftk.numPages(file, function(error, numPages) {

		fs.stat(file, function(error, stats) {
			if (error) {
				return callback(error);
			}
			var fileSize = stats['size'];
			numPages = numPages.replace(/^\s+|\s+$/g, ''); //Remove whitespace, tabs, new lines
			callback(null, numPages, fileSize);
		});
	});
}

/**
 * Validates the split inputs and ensures that they are in the correct format.
 * If a split is not in the correct format, it is skipped and will not be used.
 * Also estimates how big the output of the file(s) will be and error if too big.
 **/
function validateSplits(allFileSplits, file, maxFileSize, res, numPages, fileSize, callback) {
	
    logger.info('Validating: ' + file);
    logger.info(file + ': Size: ' + fileSize);
	logger.info(file + ': Number of Pages: ' + numPages);
	if (!numPages || numPages <= 0) {
		return callback(new Error(file + ': Error getting the number of pages.'));
	}
	
	var parsedFileSplits = [];
	var totalPageCount = 0;
	logger.info(file + ': allFileSplits: ' + allFileSplits);
	
	allFileSplits.forEach(function(splits) {
		
		var parsedSplits = [];
		// Begin to parse all of the split inputs to verify they are
		// valid inputs
		logger.info(file + ': Splits: ' + splits);
		splits = splits.replace(/ /g, ''); //remove whitespace
	
		// Get all of the splits for a file
		// ex 1,4-7,11-18
		splits = splits.match(/(\d+)([-]\d+)?/g);
		if (!splits) {
			return callback(new Error('Error parsing the split inputs.'));
		}
		
		// Parse each individual split
		splits.forEach(function(split) {
			split = split.replace(/ /g, ''); //remove whitespace
	
			// Get each individual split
			// more info: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp/exec
			var numbers = split.match(/(\d+)/g);
			
			// Make sure each number is greater than 0
			// and less than the number of pages
			for(var i = 0; i < numbers.length; i++){
				if(parseInt(numbers[i], 10) > numPages){
					numbers[i] = numPages;
				} else if (parseInt(numbers[i], 10) <= 0){
					numbers[i] = 1;
				}
			}
	
			// Get the total page count for each split and add to the total
			totalPageCount += (numbers.length == 1 ? 1 : Math.abs(numbers[1] - numbers[0]) + 1);
			
			// Recreate the the split
			var strSplit = numbers[0].toString();
			if(numbers.length > 1){
				strSplit += '-' + numbers[1].toString();
			}
			parsedSplits.push(strSplit);
		});
		logger.info(file + ': Parsed Splits: ' + parsedSplits);
	
		if (parsedSplits <= 0) {
			return callback(new Error('No Files...'));
		}
		
		parsedFileSplits.push(parsedSplits);
	});
	logger.info(file + ': Parsed File Splits: ' + parsedFileSplits);

	
	logger.info(file + ': totalPageCount: ' + totalPageCount);
	var sizePerPage = fileSize / numPages;
	logger.info(file + ': sizePerPage: ' + sizePerPage);
	var estFileSize = totalPageCount * sizePerPage;
	logger.info(file + ': Estimated File Size: ' + estFileSize);
	if (estFileSize > maxFileSize) {
		if (!res.headersSent) {
			res.writeHead(413, {
				'Connection': 'close'
			});
			res.end('Size of PDFs created exceeds the limit');
		}
		logger.error('Size of PDFs created exceeds the limit');
		return callback(new Error('Size of PDFs created exceeds the limit'));
	}

	callback(null, parsedFileSplits);
}

	

	
/**
 * Calls the pdftk to split a pdf. 
 * Uses recursion to perfrom the splitting 
 * synchronously.
 **/
function splitPDF(file, splitFileNames, req, res, fileSplits, callback) {
	
    var randName;
    var randFilePaths = [];
    logger.info('Splitting: ' + file);
    
    var splitFiles = function(index) {
    	if(index == fileSplits.length) {
    		logger.info('Done splitting files');
    		if(fileSplits.length == 1) {
    			sendSingleFile(fileSplits ,res, req, randName, randFilePaths[0], function(){
    				return callback(null);	
    			});
    		} else {
    			zipSplits(splitFileNames, randFilePaths, req, res, function(error){
    				return callback(error);
    			});
    		}
    	} else {
	    	randName = uuid.v4();
	    	randFilePaths.push(__dirname + '/../files/' + randName + '.pdf');
	    	pdftk.split(file, fileSplits[index], randFilePaths[index], function(error) {
	    		if(error) {
	    			return callback(error);
	    		}
	    		splitFiles(index + 1);
	    		
	    	});
	    }
    }
    
    splitFiles(0);
}



/**
 *  Zips multiple PDFs
 **/
function zipSplits(splitFileNames, filePaths, req, res, callback) {
	
    var zip = new Zip();
    logger.info('Zipping files');
    
    var zipFunction = function(index){
    	if(index == filePaths.length){
    		logger.info('Done zipping');
    		sendZipFile(filePaths, res, req, zip, function(error){
    				callback(error);
    			});
    	} else {
			fs.readFile(filePaths[index], 'binary', function(error, buffer) {
				if(error){
					return callback(error);
				}
				if (!splitFileNames[index]) {
	                splitFileNames[index] = 'split_document_' + (index + 1);
	            }
	            splitFileNames[index] = sanitize(splitFileNames[index]);
	            zip.file(splitFileNames[index] + '.pdf', buffer, {
	                binary: true
	            });
	            logger.info('Zipping: ' + filePaths[index]);			
				zipFunction(index + 1);
			});
    	}
    }
    
    zipFunction(0);
}

function sendSingleFile(splits, res, req, randName, newFilePath, callback ){
	
    util.saveToDB(req.ip, 'split', splits.length, newFilePath);
    if (!res.headersSent) {
        var resData = {
            type: 'pdf',
            uuid: randName
        }
        res.status(201);
        res.contentType('application/json');
        res.send(JSON.stringify(resData));
    }
    callback(null);
}

function sendZipFile(filePaths, res, req, zip, callback){
	
    var randName = uuid.v4();
    var zipFilePath = __dirname + '/../files/' + randName + '.zip';
    fs.writeFile(zipFilePath, zip.generate({
        compression: 'DEFLATE',
        type: 'base64'
    }), 'base64', function(error) {
        if (error) {
            return callback(error);
        }
        logger.info('All files zipped');
        util.saveToDB(req.ip, 'split', filePaths.length, zipFilePath);
        if (!res.headersSent) {
            var resData = {
                type: 'zip',
                uuid: randName
            }
            res.status(201);
            res.contentType('application/json');
            res.send(JSON.stringify(resData));
            util.removeFiles(filePaths);
        }
        callback(null);
    });	
}


/**
 * Calls the pdftk to burst a pdf. 
 * Bursting is done by splitting a PDF
 * into individual PDFs. Before bursting,
 * the PDF must be split into a file or files.
 * The split PDF(s) is then bursted.
 * 
 * The individual files should be named with the filename and the page number
 * from the original pdf. PDFtk does not do this when bursting. It instead
 * counts sequentially up from 1. This is handled in other functions.
 * 
 * The split file is named 'splitfilename' and the burst file names are 
 * named 'splitfilename_x'. 
 **/
function burstPages(file, splitFileNames, req, res, fileSplits, callback){

	logger.info("Bursting pages");
	
    var randName = uuid.v4();
    var splitRandFilePath = __dirname + '/../files/' + randName;
    var burstRandFilePaths = createBurstFilePaths(fileSplits, randName);
    var burstFilenames = createBurstFileNames(splitFileNames[0], fileSplits);
    logger.info('Bursting: ' + file + " burstFilenames: " + burstFilenames + " burstRandFilePaths: " + burstRandFilePaths);
    
    var burstFiles = function(index) {
    	if(index == fileSplits.length) {
    		logger.info('Done bursting files');
			zipSplits(burstFilenames, burstRandFilePaths, req, res, function(error){
				util.removeFile(splitRandFilePath);
    			return callback(error);
    		});
    	} else {
	    	pdftk.split(file, fileSplits[index], splitRandFilePath, function(error) {
	    		if(error) {
	    			return callback(error);
	    		}
	    		pdftk.burst(splitRandFilePath, splitRandFilePath+'_%d.pdf', function(error){
	    			if(error) {
	    				return callback(error);
	    			}

	    			burstFiles(index + 1);
	    		});
	    		
	    	});
	    }
    }
    
    burstFiles(0);
}

/**
 * Creates an array of file names
 * for the files after they have been split.
 * This is necessary for the page number.
 * 
 * The file names after bursting are 'filename_x' where 
 * x is based at 1 to n.
 **/
function createBurstFilePaths(fileSplits, randName){
	
	var burstFilePaths = [];
	var fileCount = 1;
	// Parse each individual split
    // only get the first file split.
    // fileSplits should only have one element in it
    fileSplits[0].forEach(function(split) {
        
        // Get each individual split
        // ex 4-7, 1
		var numbers = split.match(/(\d+)/g);
		burstFilePaths.push( __dirname + '/../files/' + randName + '_' + (fileCount++) + '.pdf')
		
		if(numbers.length == 2){
	        for(var i = 0; i < Math.abs(numbers[0] - numbers[1]); i++, fileCount++){
	        	burstFilePaths.push( __dirname + '/../files/' + randName + '_' + fileCount + '.pdf')	
	        }
	        
		}
    });
    
    return burstFilePaths;
}

/**
 * Creates the file names for each individual burst.
 * These names should be 'filename_x' where x is the actual
 * corresponding page from the original PDF. PDFtk burst does not
 * use the corresponding page number when bursting. It sequentially counts
 * from 1.
 **/
function createBurstFileNames(fileName, fileSplits){
	var burstPageNumbers = getBurstPageNumbers(fileSplits);
	logger.info("burstPageNumbers: " + burstPageNumbers);
	var burstFileNames = [];
	
	if(!fileName){
		fileName = 'split_document';
	}
	
	burstPageNumbers.forEach(function(page){
		burstFileNames.push(fileName + "_" + page);	
	});
	
	return burstFileNames;
	
}

/**
 * Creates an array of file names
 * for the files after they have been split.
 * This is necessary for the page number.
 **/
function getBurstPageNumbers(fileSplits){
	
	var burstPageNumbers = [];
	// Parse each individual split
    // only get the first file split.
    // fileSplits should only have one element in it
    fileSplits[0].forEach(function(split) {
        
        // Get each individual split
        // ex 4-7, 1
		var numbers = split.match(/(\d+)/g);

		// handle the case where the splits are reversed (ie: 10-5)
		if(numbers.length == 2){
	        var start = parseInt(numbers[0]);
			var end = parseInt(numbers[1]);
			if(parseInt(numbers[0]) > parseInt(numbers[1])){
				for(var i = start; i >= end; i--){
	        		burstPageNumbers.push(i)	
	    		}
	        } else {
				for(var i = start; i <= end; i++){
	        		burstPageNumbers.push(i)	
	    		}
	        }
		} else {
			burstPageNumbers.push(numbers[0]);
		}
    });
    
    return burstPageNumbers;
}