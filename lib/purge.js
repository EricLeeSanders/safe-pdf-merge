var fs = require('fs');
var logger = require('./logger');
var cron = require('cron');
var cronJob = cron.job('0 0 * * * *', function() {

    purge(__dirname + '/../files');
    purge(__dirname + '/../uploads');
    logger.info('cron job completed');
});
cronJob.start();

/**
 * Purges uploaded and created files older than an hour every hour.
 **/
function purge(dir) {
    fs.readdir(dir, function(error, files) {
        if (error) {
            return logger.error('Could not list the directory. ' + error);
        }
        var todayUTC = new Date(Date.now());
        var purgeDate = new Date();
        purgeDate.setHours(todayUTC.getHours() - 1)
        
        logger.info('Purging files before: ' + purgeDate);
        
        files.forEach(function(file, index) {
            var stats = fs.statSync(dir + '/' + file);
            var mtime = new Date(stats.mtime);
            if (mtime < purgeDate) {
                logger.info('Purging: ' + file + ' : ' + mtime);
                fs.unlink(dir + '/' + file, function(error) {
                    if (error) {
                        return logger.error("Error deleting file: " + error);
                    }
                    logger.info(dir + '/' + file + ': deleted successfully');
                });
            }
        });

    });
}
