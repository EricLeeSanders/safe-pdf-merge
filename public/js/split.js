var Split = (function() {


    $('#items').on('click', 'li > .pdf-div > .remove-pdf-image', function(e) {
        e.stopPropagation();
        $(this).parent().parent().remove();
        //If the only split is removed, close the split area
        if ($('#items').children().length < 1) {
            $('#btn-clear').click();
        }
    });

    $('#btn-clear').click(function(event) {
        event.stopPropagation();
        $('#pdf-list').toggleClass('pdf-list-active pdf-list-inactive');
        $('#file-name').text('');
        $('#file-name').css('width', '0');
        $('.progress-bar').text('');
        $('.progress-bar').width('0%');
        $('#merge-name').val('');
        $('#add-split').css('display', 'none');
        $('#splitAllPages').css('visibility', 'hidden');
    });


    $('#splitAllPages').click(function(event) {
        if ($("#cboxSplitAll").is(':checked')) {
            $('#add-split').css('display', 'none');
            if ($('#items').children().length > 1) {
                $("#items > li ~ li").remove();
            }
        } else {
            $('#add-split').css('display', 'block');
        }
        event.stopPropagation();
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
            placeholder: 'Pages (ex: 1, 3-5, 8-10)'
        });
        split_input_div.append(split_pages);

    }

    function parseSplitInput() {
        var splits = [];
        $('.split-pages').each(function() {
            var list = $(this).val();
            list = list.replace(/ /g, '');
            var matches = [];
            matches = list.match(/(\d+)([-]\d+)?/g);
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
            }, 900);
            var lblTime = 1000;
        } else {
            $('.pdf-div').css('display', 'inline-block');
            $('.split-input-div').css('display', 'inline-block');
            var lblTime = 10;
        }
        var txtTimeout = setTimeout(function() {
            $('#file-name').css('width', '300px');
            $('.split-file-name').css('width', '300px');
            $('.split-pages').css('width', '300px');
            $('#splitAllPages').css('visibility', 'visible');

            if ($("#cboxSplitAll").is(':checked')) {
                $('#add-split').css('display', 'hidden');
            } else {
                $('#add-split').css('display', 'block');
            }

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
        var splitAllPages = $("#cboxSplitAll").is(':checked');
        formData.append('splitAll', splitAllPages);

        var splits = parseSplitInput();
        if (splits.length <= 0) {
            if ($("#cboxSplitAll").is(':checked')) {
                return alert('Must enter the pages that are to be split into new pdf files.\nExample: 1, 5-10 will create 7 new pdf files for the given input.');
            } else {
                return alert('Must enter the pages that are to be included in the new pdf.\nExample: 1, 5-10 will create a new pdf file with pages 1 and 5 through 10.');
            }
        }
        splits.forEach(function(split) {
            formData.append('splits', split)
        });

        var count = 0;
        $('.split-file-name').each(function() {
            count++;
            var fileName = $(this).val();
            if (!fileName) {
                fileName = file.name.match(/[^.]*/);
                if (!splitAllPages) {
                    fileName += "_" + count;
                }
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
