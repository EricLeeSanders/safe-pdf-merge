var express = require('express');
var app = express();
var path = require('path');
var PDFMerge = require('pdf-merge');
var uuid = require('uuid');
var fs = require('fs');
var Busboy = require('busboy');
var ExpressBrute = require('express-brute');
var validator = require('validator');
var spm_util = require('./lib/util');
var spm_purge = require('./lib/purge');
var logger = require('./lib/logger');
var https = require('https');
var http = require('http');

var failCallback = function (req, res, next, nextValidRequestDate) {
    console.log(req.ip + ': Too many requests');
    logger.error(req.ip + ': Too many requests');
    res.writeHead(429, {'Connection': 'close'});
    res.end('Too many requests....');    

};

var store = new ExpressBrute.MemoryStore();
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
//app.set('trust proxy', 1);

app.get('/', function(req, res){
  res.sendFile(path.join(__dirname, 'views/index.html'));
});

//Download the merged pdf
app.get('/download', function(req,res){
    if(!validator.isUUID(req.query.uuid,4)){
        logger.error('Not valid UUID: ' + req.query.uuid);
        if(!res.headersSent){
            res.redirect('/');
        }
        return;
    }
    
    var fileName = req.query.name;
    fileName = fileName.substring(0, 255);
    if(fileName.length <= 0){
      fileName = 'merged_document';
    } else if(!validator.isAlphanumeric(fileName)){
        logger.info('Not alpha numeric: ' + fileName);
        fileName = 'merged_document';
    }
    
    res.download(__dirname + '/merges/' + req.query.uuid + '.pdf', fileName + '.pdf', function(err){
        if(err){
            logger.error(err);
            if(!res.headersSent){
                res.redirect('/');
            }
            return;
        } 
        removeFile(__dirname + '/merges/' + req.query.uuid + '.pdf');
    });
    
});

//Upload and merge the pdfs
app.post('/upload', bruteforce.prevent, function(req, res, next){
    var maxFileSize = 1024*1024*20;
    var busboy = new Busboy({ headers: req.headers, limits: {fileSize: maxFileSize} });
    
    var bytesExpected = getBytesExpected(req.headers);
    if(bytesExpected > maxFileSize){
        return next(new Error('Anticipating a file of size ' + (bytesExpected/(1024*1024)) + ' mb. File size is too large'));
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
            var targetPath = __dirname + '/uploads/' + uuid.v4(); 
            files.push(targetPath);
            file.pipe(fs.createWriteStream(targetPath));
            logger.info('Uploading: ' + targetPath);
        }
        
        file.on('limit', function(data) {                                               
            removeFiles(files, next);
            req.unpipe(busboy);
            next(new Error('File limit reached...'));
        });
        
    });
    busboy.on('finish', function() {
        logger.info('Done parsing form!');
        if(files.length > 0){
            merge(files, req, res, next);
        } else {
            next(new Error('No Files...'));
        }
    });
    req.pipe(busboy);
});

app.get('/privacy_policy', function(req,res){
    res.sendFile(path.join(__dirname, 'views/privacy_policy.html'));
});

function removeFiles(files, next){
    logger.info('Removing files');
    files.forEach(function(file){   
        removeFile(file, next);
    });
}

function removeFile(file, next){
    logger.info('Removing file: ' + file);
    //check if the file exists first. fs.exists is deprecated
    fs.stat(file, function (err, stats) {
        if (err) {
            logger.error(err);
            return next(err);
        }
         fs.unlink(file,function(err){
            if(err) {
                logger.error(err);
                return next(err);
            }
            logger.info(file +': deleted successfully');
        });  
    });
}


function merge(files, req, res, next){
    var pdfMerge = new PDFMerge(files);
    var randName = uuid.v4();
    pdfMerge.asNewFile(__dirname + '/merges/'+randName+'.pdf').merge(function(error, filePath) {
        if(error){
            removeFiles(files);
            return next(error);
        } 
        logger.info('Merged pdfs');
        spm_util.saveToDB(req.ip, files.length, randName );
        res.status(201).send(randName);
        removeFiles(files); //Remove the uploaded files
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
    logger.error(err);
    if(!res.headersSent){
        res.writeHead(500, {'Connection': 'close'});
        res.end('Something went wrong...');
    }
});

// app.listen(process.env.PORT, process.env.IP, function(){
//     console.log('Server is listening...'); 
// });

http.createServer(function(req, res) {   
        res.writeHead(301, {"Location": "https://" + req.headers['host'] + req.url});
        res.end();
}).listen(80);

var options = {
	ca: fs.readFileSync(__dirname + '/ssl/www_safepdfmerge_com.ca-bundle'),
	key: fs.readFileSync(__dirname + '/ssl/safe-pdf-merge-ssl.pem'),
	cert: fs.readFileSync(__dirname + '/ssl/www_safepdfmerge_com.crt')
};

var httpsServer = https.createServer(options, app);
httpsServer.listen(443);