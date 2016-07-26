var fs = require('fs');
var mysql      = require('mysql');

var pool  = mysql.createPool({
    connectionLimit : 10,
    host     : process.env.IP,
    user     : 'esanders',
//  password : 'secret',
    database : 'safe_pdf_merge'
});

exports.saveToDB = function(ip, fileLength, merge_uuid){
    var stats = fs.statSync("merges/" + merge_uuid +".pdf");
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
