var fs = require('fs');
var mysql = require('mysql');
var config = require('./config');
var logger = require('./logger');
var _this = this;

var pool = mysql.createPool({
    connectionLimit: config.mysql.connectionLimit,
    host: config.mysql.host,
    user: config.mysql.user,
    password: config.mysql.password,
    database: config.mysql.database
});


/**
 * Saves information about a file to a database
 **/
exports.saveToDB = function(ip, operation, fileLength, filePath) {
    var stats = fs.statSync(filePath);
    var fileSize = stats["size"];
    pool.getConnection(function(error, connection) {
        if (error) {
            return logger.error(error);
        }
        connection.query({
            sql: 'CALL sp_I_new_log(?,?,?,?)',
            timeout: 10000, // 10s
            values: [ip, operation, fileSize, fileLength]
        }, function(error, results, fields) {
            if (error) {
                logger.error(error);
            }
            connection.release();
        });
    });

}

/**
 * Removes multiple files
 **/
exports.removeFiles = function(files) {
    logger.info('Removing files');
    files.forEach(function(file) {
        _this.removeFile(file);
    });
}

/**
 * Removes a file
 **/
exports.removeFile = function(file) {
    logger.info('Removing file: ' + file);
    fs.unlink(file, function(error) {
        if (error) {
            logger.error("Error removing file: " + error)
            return;
        }
        logger.info(file + ': deleted successfully');
    });
}
