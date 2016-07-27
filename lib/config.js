//Development config
var config = {};

config.mysql = {};

config.mysql.host = process.env.IP;
config.mysql.user = 'esanders';
config.mysql.password = '';
config.mysql.database = 'safe_pdf_merge';
config.mysql.connectionLimit = 10;


module.exports = config;