(function(){    
    var maxFileSize = 1024 * 1024 * 20;
    Sortable.create(items, {
      group: "sorting",
      sort: true
    });
    function addFile(event){
        $('.progress-bar').text('');
        $('.progress-bar').width('0%');
        var files;
        if(event.dataTransfer) {
            console.log("transfer");
          files = event.dataTransfer.files;
        } else if(event.target) {
            console.log("target");
          files = event.target.files;
        }
        console.log(files);
        // if(validateFiles(files)) {
            //$('#pdf-list').css('display','inline-block');
            var isFirstTime = false;
            if($('#items').children().length <= 0){
                isFirstTime = true;
                $('#pdf-list').toggleClass('pdf-list-active pdf-list-inactive');
            }
            for(var i = 0; i < files.length; i++){
                var pdf_li = $("<li />");
                $("#items").append(pdf_li);  
                
                var pdf_div = $("<div />", { 
                        class: "pdf-div",
                    });
                $(pdf_div).data("file", files.item(i));
                $(pdf_li).append(pdf_div);   

                
                var remove_pdf_img = $("<img />", { 
                        class: "remove-pdf-image",
                        src: "images/pdf_remove.png",
                        alt: "delete"
                    });
                pdf_div.append(remove_pdf_img);   

                var pdf_img = $("<img />", { 
                        class: "pdf-image",
                        src: "images/pdf.png",
                        alt: "pdf-pic"
                    });
                pdf_div.append(pdf_img);   
                
                var label = $("<label />", {
                        class: "custom-file-upload",
                        text: files[i].name,
                        title: files[i].name //tooltip
                    });
                pdf_div.append(label);  
            }
        var lblTime = 0;
        if(isFirstTime){
            var divTimeout = setTimeout(function(){
                $('.pdf-div').css('display','inline-block');
              }, 200);
              var lblTime = 1000;
        } else {
             $('.pdf-div').css('display','inline-block');
             var lblTime = 10;
        }
        var lblTimeout = setTimeout(function(){
            $('.custom-file-upload').css('width','300px');
        }, lblTime);
    }
    
    $("#main-content").resize(function(){
       alert("test"); 
    });
    
    $("#clickInput").on("change",function(event){
        console.log(event);
        addFile(event);
        // $('#pdf-list').css('display','inline-block');
    });
    
    $(".dropzone").on('dragover', function(event) {
        event.preventDefault();
        event.stopPropagation();
        $(this).addClass("dragover");
    });
    $(".dropzone").on('dragleave', function(event) {
        event.preventDefault();
        event.stopPropagation();
        $(this).removeClass("dragover");
    });
    $(".dropzone").on('drop', function(event) {
        event.preventDefault();
        event.stopPropagation();
        $(this).removeClass("dragover");
        addFile(event.originalEvent);
    });
    $(".dropzone").click(function(){
        $('#clickInput').val(null); //So the same file can be added more than once
        $('#clickInput').click();
    });
    
    $('#items').on('click', 'li > .pdf-div', function(e){
        e.stopPropagation();   
    });
    
    $('#items').on('click', 'li > .pdf-div > .remove-pdf-image', function(e){
        e.stopPropagation();   
        if($('#items').children().length <= 1){
            $('#pdf-list').toggleClass('pdf-list-active pdf-list-inactive');
        }
        $(this).parent().parent().remove();
    });
    $('#merge-name').click(function(event){
        event.stopPropagation();
    });
    $('#btn-clear').click(function(event){
        event.stopPropagation();
        // $('hr').css('display','none');
        $('#pdf-list').toggleClass('pdf-list-active pdf-list-inactive');
        $('.progress-bar').text('');
        $('.progress-bar').width('0%');
        $("#items").children().remove();
        $("#merge-name").val('');
    });
    $('#btn-merge').click(function(event){
        event.stopPropagation();    
        $('.progress-bar').text('0%');
        $('.progress-bar').width('0%');
        var formData = new FormData();
        var files = [];
         $('.pdf-div').each(function() {
            var file = $(this).data("file");
            files.push(file);
        });
        for(var i = 0; i < files.length; i++){
            formData.append('uploads[]', files[i], files[i].name);
        } 
        if ( files.length < 1 ){
            alert("No files added!");
            return;
        }
        console.log(formData);
        $.ajax({
            url: './upload',
            type: 'POST',
            data: formData,
            contentType: "application/pdf",
            dataType: "text",
            processData: false,
            contentType: false,
            success: function(data){
                console.log('upload successful!\n' + data);
                var mergeName = $('#merge-name').val();
                console.log(mergeName);
                if(mergeName === undefined || mergeName === null || mergeName === ""){
                    mergeName = "merged_document";
                }
                window.location = "/download?name=" + mergeName + "&uuid="+data;
                $('.progress-bar').html('Done!');
            },
            error: function(data) {
                console.log("ajax error");
                console.log(data.status);
                console.log(data.responseText);
                console.log(data.responseType);
                if(data.status == 429){
                    $('.progress-bar').html('Too Many Requests! Please Wait!'); 
                }
            },
            xhr: function() {
            // create an XMLHttpRequest
            var xhr = new XMLHttpRequest();
    
            // listen to the 'progress' event
            xhr.upload.addEventListener('progress', function(evt) {
    
              if (evt.lengthComputable) {
                // calculate the percentage of upload completed
                var percentComplete = evt.loaded / evt.total;
                percentComplete = parseInt(percentComplete * 100);
    
                // update the Bootstrap progress bar with the new percentage
                $('.progress-bar').text(percentComplete + '%');
                $('.progress-bar').width(percentComplete + '%');
    
                // once the upload reaches 100%, set the progress bar text to done
                if (percentComplete === 100) {
                  $('.progress-bar').html('Merging...');
                }
    
             }
    
            }, false);
    
            return xhr;
          }
        });
        
    });
    
    function calcTotalFileSize(files, queuedFiles){
        var totalFileSize = 0;
        for(var i = 0; i < files.length; i++){
            totalFileSize += files[i].size;
        }
        for(var i = 0; i < queuedFiles.length; i++){
            totalFileSize += queuedFiles[i].size;
        }
        return totalFileSize;
    }
    function validateFiles(files) {
        console.log("validating files");
        var queuedFiles = [];
         $('.pdf-div').each(function() {
            var file = $(this).data("file");
            queuedFiles.push(file);
        });

        for(var i = 0; i < files.length; i++){
            var file = files[i];
            console.log(file.size);
            console.log(file.type);
            if(file.type != 'application/pdf'){
                alert("File not a PDF!")
                return false;
            } else if(file.size > maxFileSize){
                alert("File size too large! Limit is: " + (maxFileSize/(1024*1024)) + " mb");
                return false;
            } 
        }
        console.log( calcTotalFileSize(files, queuedFiles) );
        if ( calcTotalFileSize(files, queuedFiles) > maxFileSize ) {
            alert("Total file size is over the Limit of: " + (maxFileSize/(1024*1024)) + " mb")
            return false;
        }
        return true;
    }
})();




