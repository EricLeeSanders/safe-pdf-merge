(function() {
    var maxFileSize = 1024 * 1024 * 20;

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

        //return if a file is not added
        if (addedFiles.length <= 0) {
            return;
        }

        var totalFileSize = FileValidation.calcTotalFileSize(addedFiles);

        //If we are merging, we need to also get the queued files and add that. 
        if ($('body').hasClass('merge-pdf')) {
            var queuedFiles = Merge.getQueuedFiles();
            totalFileSize += FileValidation.calcTotalFileSize(queuedFiles);
        }

        if (FileValidation.validateFiles(addedFiles, totalFileSize, maxFileSize)) {
            var firstTime = false;
            if ($('#items').children().length <= 0) {
                //If we are adding a file(s) for the first time
                firstTime = true;
                $('#pdf-list').toggleClass('pdf-list-active pdf-list-inactive');
            }
            else {
                //If we are splitting and adding a new file where 
                //there already is a current file, then we remove
                //the current file
                if ($('body').hasClass('split-pdf')) {
                    $('#items').children().remove();
                }
            }
            var totalFileSizeMb = totalFileSize / (1024 * 1024)
            totalFileSizeMb = +totalFileSizeMb.toFixed(2);
            $('#usedMb').text('Used: ' + totalFileSizeMb + ' mb')
            if ($('body').hasClass('split-pdf')) {
                $('#file-name').text('File: ' + addedFiles[0].name);
                $('#file-name').data('file', addedFiles.item(0));
                Split.addSplitInput();
                Split.showSplitInput(firstTime);
            }
            else if ($('body').hasClass('merge-pdf')) {
                Merge.addMergeInputs(addedFiles);
                Merge.showMergeInputs(firstTime);
            }

        }
    }

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
    });

    $('#btn-submit').click(function(event) {
        event.stopPropagation();
        $('.progress-bar').text('');
        $('.progress-bar').width('0%');
        var formData;
        var fileName;
        if ($('body').hasClass('split-pdf')) {
            formData = Split.createFormData();
            //If only one PDF is being created, then use it 
            //for the name of the PDF. If we are making more
            //than one PDF, then they will be zipped and we name
            //the zip file.
            if ($('.split-file-name').length === 1) {
                fileName = $('.split-file-name').val();
            }
            else {
                fileName = 'pdf_documents';
            }
        }
        else if ($('body').hasClass('merge-pdf')) {
            formData = Merge.createFormData();
            fileName = $('#merge-name').val();
        }
        else {
            return;
        }

        if (!fileName) {
            fileName = 'pdf_document';
        }
        //Make sure the form data was created
        if (formData) {
            createAjaxRequest(formData, fileName)
        }
    });

    function createAjaxRequest(formData, fileName) {
        $.ajax({
            url: './upload',
            type: 'POST',
            data: formData,
            processData: false,
            contentType: false,
            success: function(data) {
                window.location = '/download?name=' + fileName + '&type=' + data.type + '&uuid=' + data.uuid;
                $('.progress-bar').html('Done!');
            },
            error: function(data) {
                if (data.status == 429) {
                    $('.progress-bar').html('Too many requests! Please wait.');
                    alert("Too many requests! Please wait.");
                }
                else if (data.status == 413) {
                    $('.progress-bar').html('Size of PDFs created exceeds the limit.');
                    alert("Size of PDFs created exceeds the limit.");
                }
                else {
                    $('.progress-bar').html('Error processing the request.');
                    alert("Error processing the request.");
                }
            },
            xhr: function() {
                var xhr = new XMLHttpRequest();
                //udpate progress bar
                xhr.upload.addEventListener('progress', function(evt) {

                    if (evt.lengthComputable) {
                        var percentComplete = evt.loaded / evt.total;
                        percentComplete = parseInt(percentComplete * 100);

                        $('.progress-bar').text(percentComplete + '%');
                        $('.progress-bar').width(percentComplete + '%');

                        if (percentComplete === 100) {
                            $('.progress-bar').html('Processing...');
                        }
                    }
                }, false);
                return xhr;
            }
        });
    }

})();
