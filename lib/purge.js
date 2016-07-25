var fs = require('fs');
var logger = require('./logger.js');
var cron = require('cron');
var cronJob = cron.job('0 0 * * * *', function(){
    
    purge(__dirname + '/../merges');
    purge(__dirname + '/../uploads');
    console.info('cron job completed');
}); 
//cronJob.start();

function purge(dir){

    fs.readdir( dir, function( err, files ) {
        if( err ) {
            console.error( "Could not list the directory.", err );
            logger.error( "Could not list the directory. " + err );
        } 
        var todayUTC = new Date(Date.now());
        var purgeDate = new Date();
        purgeDate.setHours(todayUTC.getHours() - 1)
        console.log('Purging files before: ' + purgeDate);
        logger.info('Purging files before: ' + purgeDate);
        files.forEach( function( file, index ) {
            var stats = fs.statSync(dir+'/'+file);
            var mtime = new Date(stats.mtime);
            if(mtime < purgeDate){
                console.log('Purging: ' + file + ' : ' + mtime);
                logger.info('Purging: ' + file + ' : ' + mtime);
                fs.stat(dir+'/'+file, function (err, stats) {
                    if (err) {
                       logger.error(err);
                    }
                     fs.unlink(dir+'/'+file,function(err){
                        if(err) return logger.error(err);
                        logger.info(dir+'/'+file +': deleted successfully');
                    });  
                });
            } else {
                console.log(mtime);
            }
        });

    });
}
