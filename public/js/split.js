var Split = (function() {
    $('#items').on('click', 'li > .pdf-div > .remove-pdf-image', function(e) {
        e.stopPropagation();
        $(this).parent().parent().remove();
        if ($('#items').children().length < 1) {
            $('#pdf-list').toggleClass('pdf-list-active pdf-list-inactive');
            $('#usedMb').text('');
            $('#usedMb').css('width', '0');
            $('#file-name').text('');
            $('#file-name').css('width', '0');
            $('.progress-bar').text('');
            $('.progress-bar').width('0%');
            $('#merge-name').val('');
            $('#add-split').css('display', 'none');
        }
    });

    $('#btn-clear').click(function(event) {
        event.stopPropagation();
        $('#file-name').text('');
        $('#file-name').css('width', '0');
        $('#add-split').css('display', 'none');
    });


    $('#add-split').click(function(event) {
        event.stopPropagation();
        addSplitInput();
        showSplitInput(false);
    });

    function addSplitInput() {
        var pdf_li = $('<li />');
        $('#items').append(pdf_li);

        var pdf_div = $('<div />', {
            class: 'pdf-div',
        });
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

        var split_input_div = $('<div />', {
            class: 'split-input-div',
        });
        pdf_div.append(split_input_div);
        var split_file_name = $('<input />', {
            class: 'split-file-name',
            name: 'split-file-name',
            type: 'text',
            maxlength: '255',
            placeholder: 'New File Name'
        });
        split_input_div.append(split_file_name);

        var split_pages = $('<input />', {
            class: 'split-pages',
            name: 'split-pages',
            type: 'text',
            maxlength: '255',
            placeholder: 'Pages (ex: 1-7, 8-10)'
        });
        split_input_div.append(split_pages);

    }

    function parseSplitInput() {
        var splits = [];
        $('.split-pages').each(function() {
            var list = $(this).val();
            list = list.replace(/ /g, '');
            var matches = [];
            matches = list.match(/\d+-\d+/g);
            if (matches) {
                splits.push(matches);
            }
        });

        return splits;

    }

    function showSplitInput(firstTime) {
        var lblTime = 0;
        if (firstTime) {
            var divTimeout = setTimeout(function() {
                $('.pdf-div').css('display', 'inline-block');
                $('.split-input-div').css('display', 'inline-block');
                $('#add-split').css('display', 'block');
            }, 900);
            var lblTime = 1000;
        }
        else {
            $('.pdf-div').css('display', 'inline-block');
            $('.split-input-div').css('display', 'inline-block');
            var lblTime = 10;
        }
        var txtTimeout = setTimeout(function() {
            $('#usedMb').css('width', '300px');
            $('#file-name').css('width', '300px');
            $('.split-file-name').css('width', '300px');
            $('.split-pages').css('width', '300px');
        }, lblTime);
    }

    function createFormData() {
        var formData = new FormData();
        var file = $('#file-name').data('file');
        if (!file) {
            return alert('No files added');
        }
        formData.append('upload', file, file.name);
        formData.append('type', 'split');

        var splits = parseSplitInput();
        if (splits.length <= 0) {
            return alert('Must enter the pages that are to be included in the new pdf');
        }
        splits.forEach(function(split) {
            formData.append('splits', split)
        });

        var count = 0;
        $('.split-file-name').each(function() {
            count++;
            var fileName = $(this).val();
            if (!fileName) {
                fileName = 'split_document_' + count;
            }
            formData.append('splitFileNames', fileName)
        });

        return formData;
    }
    return {
        createFormData: createFormData,
        addSplitInput: addSplitInput,
        showSplitInput: showSplitInput
    }

})();
