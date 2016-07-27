var fs = require('fs');
var mysql      = require('mysql');
var config = require('./config');

var pool  = mysql.createPool({
    connectionLimit : config.mysql.connectionLimit,
    host     : config.mysql.host,
    user     : config.mysql.user,
    password : config.mysql.password,
    database : config.mysql.database
});

exports.saveToDB = function(ip, fileLength, merge_uuid){
    var stats = fs.statSync(__dirname + "/../merges/" + merge_uuid +".pdf");
    var fileSize = stats["size"];
    pool.getConnection(function(err, connection) {
        if (err) throw err;
        connection.query({
            sql: 'CALL sp_I_new_merge(?,?,?)',
            timeout: 10000, // 10s
            values: [ip, fileSize, fileLength]
        }, function (error, results, fields) {
            if (error) throw error;
            connection.release();
        });
    });
            
}
