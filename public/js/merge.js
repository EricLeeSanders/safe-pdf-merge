var Merge = (function() {
    Sortable.create(items, {
        group: 'sorting',
        sort: true
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
            var totalFileSize = FileValidation.calcTotalFileSize(queuedFiles)
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
        $('#merge-name').val('');
    });

    function addMergeInputs(addedFiles) {
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
    }

    function showMergeInputs(firstTime) {
        var lblTime = 0;
        if (firstTime) {
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
            $('.pdf-div').css('display', 'inline-block');
            $('.custom-file-upload').css('width', '300px');
            $('#usedMb').css('width', '300px');
        }, lblTime);
    }

    function createFormData() {
        var formData = new FormData();
        var queuedFiles = getQueuedFiles();
        for (var i = 0; i < queuedFiles.length; i++) {
            formData.append('uploads[]', queuedFiles[i], queuedFiles[i].name);
        }
        formData.append('type', 'merge');
        if (queuedFiles.length < 1) {
            return alert('No files added');
        }
        return formData;
    }

    function getQueuedFiles() {
        var files = [];
        $('.pdf-div').each(function() {
            var file = $(this).data('file');
            files.push(file);
        });
        return files;
    }

    return {
        createFormData: createFormData,
        addMergeInputs: addMergeInputs,
        showMergeInputs: showMergeInputs,
        getQueuedFiles: getQueuedFiles
    }
})();