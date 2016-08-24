(function() {
    var maxFileSize = 1024 * 1024 * 20;
    Sortable.create(items, {
        group: 'sorting',
        sort: true
    });

    function addFile(event) {
        $('.progress-bar').text('');
        $('.progress-bar').width('0%');
        var addedFiles;
        if (event.dataTransfer) {
            addedFiles = event.dataTransfer.files;
        }
        else if (event.target) {
            addedFiles = event.target.files;
        }

        var queuedFiles = getQueuedFiles();

        var totalFileSize = calcTotalFileSize(queuedFiles);
        totalFileSize += calcTotalFileSize(addedFiles);

        if (validateFiles(addedFiles, totalFileSize)) {
            var isFirstTime = false;
            if ($('#items').children().length <= 0) {
                isFirstTime = true;
                $('#pdf-list').toggleClass('pdf-list-active pdf-list-inactive');
            }
            var totalFileSizeMb = totalFileSize / (1024 * 1024)
            totalFileSizeMb = +totalFileSizeMb.toFixed(2);
            $('#usedMb').text('Used: ' + totalFileSizeMb + ' mb')
            for (var i = 0; i < addedFiles.length; i++) {
                var pdf_li = $('<li />');
                $('#items').append(pdf_li);

                var pdf_div = $('<div />', {
                    class: 'pdf-div',
                });
                $(pdf_div).data('file', addedFiles.item(i));
                $(pdf_li).append(pdf_div);

                var remove_pdf_img = $('<img />', {
                    class: 'remove-pdf-image',
                    src: 'images/pdf_remove.png',
                    alt: 'delete'
                });
                pdf_div.append(remove_pdf_img);

                var pdf_img = $('<img />', {
                    class: 'pdf-image',
                    src: 'images/pdf.png',
                    alt: 'pdf-pic'
                });
                pdf_div.append(pdf_img);

                var label = $('<label />', {
                    class: 'custom-file-upload',
                    text: addedFiles[i].name,
                    title: addedFiles[i].name //tooltip
                });
                pdf_div.append(label);
            }
            var lblTime = 0;
            if (isFirstTime) {
                var divTimeout = setTimeout(function() {
                    $('.pdf-div').css('display', 'inline-block');
                }, 200);
                var lblTime = 1000;
            }
            else {
                $('.pdf-div').css('display', 'inline-block');
                var lblTime = 10;
            }
            var txtTimeout = setTimeout(function() {
                $('.custom-file-upload').css('width', '300px');
                $('#usedMb').css('width', '300px');
            }, lblTime);
        }
    }

    $('#main-content').resize(function() {
        alert('test');
    });

    $('#clickInput').on('change', function(event) {
        addFile(event);
    });

    $('.dropzone').on('dragover', function(event) {
        event.preventDefault();
        event.stopPropagation();
        $(this).addClass('dragover');
    });

    $('.dropzone').on('dragleave', function(event) {
        event.preventDefault();
        event.stopPropagation();
        $(this).removeClass('dragover');
    });

    $('.dropzone').on('drop', function(event) {
        event.preventDefault();
        event.stopPropagation();
        $(this).removeClass('dragover');
        addFile(event.originalEvent);
    });

    $('.dropzone').click(function() {
        $('#clickInput').val(null); //So the same file can be added more than once
        $('#clickInput').click();
    });

    $('#items').on('click', 'li > .pdf-div', function(e) {
        e.stopPropagation();
    });

    $('#items').on('click', 'li > .pdf-div > .remove-pdf-image', function(e) {
        e.stopPropagation();
        $(this).parent().parent().remove();
        if ($('#items').children().length < 1) {
            $('#pdf-list').toggleClass('pdf-list-active pdf-list-inactive');
            $('#usedMb').text('');
            $('#usedMb').css('width', '0');
            $('.progress-bar').text('');
            $('.progress-bar').width('0%');
            $('#merge-name').val('');
        }
        else {
            var queuedFiles = getQueuedFiles();
            var totalFileSize = calcTotalFileSize(queuedFiles)
            var totalFileSizeMb = totalFileSize / (1024 * 1024)
            totalFileSizeMb = +totalFileSizeMb.toFixed(2);
            $('#usedMb').text('Used: ' + totalFileSizeMb + ' mb')

        }
    });

    $('#merge-name').click(function(event) {
        event.stopPropagation();
    });

    $('#btn-clear').click(function(event) {
        event.stopPropagation();
        if ($('#pdf-list').is('.pdf-list-active')) {
            $('#pdf-list').toggleClass('pdf-list-active pdf-list-inactive');
        }
        $('#usedMb').text('');
        $('#usedMb').css('width', '0');
        $('.progress-bar').text('');
        $('.progress-bar').width('0%');
        $('#items').children().remove();
        $('#merge-name').val('');
    });

    $('#btn-merge').click(function(event) {
        event.stopPropagation();
        $('.progress-bar').text('');
        $('.progress-bar').width('0%');
        var formData = new FormData();
        var queuedFiles = getQueuedFiles();
        for (var i = 0; i < queuedFiles.length; i++) {
            formData.append('uploads[]', queuedFiles[i], queuedFiles[i].name);
        }
        if (queuedFiles.length < 1) {
            alert('No files added!');
            return;
        }
        $.ajax({
            url: './upload',
            type: 'POST',
            data: formData,
            contentType: 'application/pdf',
            dataType: 'text',
            processData: false,
            contentType: false,
            success: function(data) {
                var mergeName = $('#merge-name').val();
                if (mergeName === undefined || mergeName === null || mergeName === '') {
                    mergeName = 'merged_document';
                }
                window.location = '/download?name=' + mergeName + '&uuid=' + data;
                $('.progress-bar').html('Done!');
            },
            error: function(data) {
                if (data.status == 429) {
                    $('.progress-bar').html('Too Many Requests! Please Wait!');
                }
            },
            xhr: function() {
                var xhr = new XMLHttpRequest();
                xhr.upload.addEventListener('progress', function(evt) {

                    if (evt.lengthComputable) {
                        var percentComplete = evt.loaded / evt.total;
                        percentComplete = parseInt(percentComplete * 100);

                        $('.progress-bar').text(percentComplete + '%');
                        $('.progress-bar').width(percentComplete + '%');

                        if (percentComplete === 100) {
                            $('.progress-bar').html('Merging...');
                        }
                    }
                }, false);
                return xhr;
            }
        });
    });


    function getQueuedFiles() {
        var files = [];
        $('.pdf-div').each(function() {
            var file = $(this).data('file');
            files.push(file);
        });
        return files;
    }

    function calcTotalFileSize(files) {
        var totalFileSize = 0;
        for (var i = 0; i < files.length; i++) {
            totalFileSize += files[i].size;
        }
        return totalFileSize;
    }

    function validateFiles(files, totalFileSize) {
        for (var i = 0; i < files.length; i++) {
            var file = files[i];
            if (file.type != 'application/pdf') {
                alert('File not a PDF!')
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
})();
