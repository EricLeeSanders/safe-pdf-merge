var winston = require('winston');

var logger = new (winston.Logger)({
  transports: [
    new (winston.transports.File)({
      name: 'info-file',
      filename: 'log/filelog-info.log',
      level: 'info'
    }),
    new (winston.transports.File)({
      name: 'error-file',
      filename: 'log/filelog-error.log',
      level: 'error'
    })
  ]
});

exports.info = function(message){
    logger.info(message);
}

exports.error = function(error){
    logger.error(error);
}