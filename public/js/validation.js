var FileValidation = (function() {

    function calcTotalFileSize(files) {
        var totalFileSize = 0;
        for (var i = 0; i < files.length; i++) {
            totalFileSize += files[i].size;
        }
        return totalFileSize;
    }

    function validateFiles(files, totalFileSize, maxFileSize) {
        for (var i = 0; i < files.length; i++) {
            var file = files[i];
            if (file.type != 'application/pdf') {
                alert('File is not a PDF!')
                return false;
            }
            else if (file.size > maxFileSize) {
                alert('File size too large! Limit is: ' + (maxFileSize / (1024 * 1024)) + ' mb');
                return false;
            }
        }

        if (totalFileSize > maxFileSize) {
            alert('Total file size is over the Limit of: ' + (maxFileSize / (1024 * 1024)) + ' mb')
            return false;
        }
        return true;
    }
    return {
        calcTotalFileSize: calcTotalFileSize,
        validateFiles: validateFiles
    }
})();
