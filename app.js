var express = require('express');
var app = express();
var path = require('path');
var PDFMerge = require('pdf-merge');
var uuid = require('uuid');
var fs = require('fs');
var Busboy = require('busboy');
var ExpressBrute = require('express-brute');
var validator = require('validator');
var spm_util = require('./lib/util.js');
var spm_purge = require('./lib/purge.js');
var logger = require('./lib/logger.js');

var failCallback = function (req, res, next, nextValidRequestDate) {
    console.log(req.ip + ': Too many requests');
    logger.error(req.ip + ': Too many requests');
    res.writeHead(429, {'Connection': 'close'});
    res.end('Too many requests....');    

};

var store = new ExpressBrute.MemoryStore(); // stores state locally, don't use this in production
var bruteforce = new ExpressBrute(store , {
    freeRetries: 4, //Allow 5 retries before blocking
    minWait: 60*1000,
    maxWait: 60*1000,
    lifetime: 60,
    refreshTimeoutOnRequest: false,
    attachResetToRequest: false,
    failCallback: failCallback
});



app.use(express.static(path.join(__dirname, 'public')));
app.set('trust proxy', 1);

app.get("/", function(req, res){
  res.sendFile(path.join(__dirname, 'views/index.html'));
});

app.get("/download", function(req,res){
    var uuid = req.query.uuid;
    if(!validator.isUUID(uuid,4)){
        console.error("Not valid UUID: " + uuid);
        logger.error("Not valid UUID: " + uuid);
        if(!res.headersSent){
            res.redirect('/');
        }
        return;
    }
    var fileName = req.query.name;
    fileName = fileName.substring(0, 255);
    if(fileName.length <= 0){
    //   console.log('filename blank');  
      fileName = "merged_document";
    } else if(!validator.isAlphanumeric(fileName)){
        logger.info("not alpha numeric: " + fileName);
        fileName = "merged_document";
    }
    //, fileName+'.pdf'
    res.download('merges/' + req.query.uuid + '.pdf', function(err){
        console.log('uuid:' + req.query.uuid);
        if(err){
            logger.error('Stupdid error: ' + err);
            if(!res.headersSent){
                res.redirect('/');
            }
            return;
        } 
           
        //removeFile('merges/' + req.query.uuid + '.pdf');
    });
    
});

app.post('/upload', bruteforce.prevent, function(req, res, next){
    var maxFileSize = 1024*1024*20;
    
    var busboy = new Busboy({ headers: req.headers, limits: {fileSize: maxFileSize} });
    var bytesExpected = getBytesExpected(req.headers);
    if(bytesExpected > maxFileSize){
        return next(new Error("Anticipating a file of size " + (bytesExpected/(1024*1024)) + " mb. File size is too large"));
    }
    var files = [];
    var error = false;
    busboy.on('file', function(fieldname, file, filename, encoding, mimetype) {
        if(mimetype !== 'application/pdf') {
            if(!error) {
                error = true;
                removeFiles(files, next);
                req.unpipe(busboy);
                next(new Error('File is not a valid PDF: ' + mimetype));
            }
            return;
        }
        //If there was no error with another file
        //then save the file
        if(!error){
            var targetPath = './uploads/' + uuid.v4();
            files.push(targetPath);
            file.pipe(fs.createWriteStream(targetPath));
            logger.info("Uploading: " + targetPath);
        }
        
        file.on('end', function() {
            // console.log( file.path);
        });
        file.on('limit', function(data) {                                               
            removeFiles(files, next);
            req.unpipe(busboy);
            next(new Error("File limit reached..."));
        });
    });
    busboy.on('finish', function() {
        logger.info('Done parsing form!');
        if(files.length > 0){
            merge(files, req, res, next);
        } else {
            next(new Error("No Files..."));
        }
    });
    req.pipe(busboy);
});

function removeFiles(files, next){
    logger.info("Removing files");
    files.forEach(function(file){   
        removeFile(file, next);
    });
}

function removeFile(file, next){
    logger.info("Removing file: " + file);
    //check if the file exists first. fs.exists is deprecated
    fs.stat(file, function (err, stats) {
        if (err) {
           return next(err);
        }
         fs.unlink(file,function(err){
            if(err) return next(err);
            logger.info(file +': deleted successfully');
        });  
    });
}


function merge(files, req, res, next){
    console.log('Merging!');
    var pdfMerge = new PDFMerge(files);
    var randName = uuid.v4();
    pdfMerge.asNewFile('merges/'+randName+'.pdf').merge(function(error, filePath) {
        if(error){
            removeFiles(files);
            return next(error);
        } 
        spm_util.saveToDB(req.ip, files.length, randName );
        res.status(201).send(randName);
        removeFiles(files);
    });
}


function getBytesExpected(headers) {
    var contentLength = headers['content-length'];
    if (contentLength) {
        return parseInt(contentLength, 10);
    } else if (headers['transfer-encoding'] == null) {
        return 0;
    } else {
        return null;
    }
}

//Catch errors and end the response
app.use(function(err, req, res, next) {
    console.log(err);
    logger.error(err);
    if(!res.headersSent){
        res.writeHead(500, {'Connection': 'close'});
        res.end('Something went wrong...');
    }
});
 app.listen(process.env.PORT, process.env.IP, function(){
   console.log("Server is listening..."); 
 });