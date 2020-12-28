FormFill.functions = {};

FormFill.functions.attachEvents = function() {
    if ( (FormFill.settings.destination == 'email' && !FormFill.settings.email) || 
         (FormFill.settings.destination == 'fax' &&  (!FormFill.settings.phone || !FormFill.fax ) ) )
        $(FormFill.settings.button).on('click', FormFill.functions.issue);
    else
        $(FormFill.settings.button).on('click', FormFill.functions.fillPDF);
}

FormFill.functions.fillPDF = async function() {
    
    // Grab any blank values that might be on this form and do any formatting    
    let localVals = FormFill.settings['fill-value'];
    $.each( FormFill.settings['redcap-fields'], function(index,name) {
        if ( $(`*[name=${name}]`).length > 0 ) 
            localVals[index] = $(`*[name=${name}]`).val();
        if ( typeof localVals[index] == "string" ) {
            if ( localVals[index].match(/^\d{4}\-\d{2}\-\d{2}$/) )
                localVals[index] = formatDate(new Date(localVals[index]+' 00:00'),'MM/dd/y');
            else if ( localVals[index].match(/^\d{2}\-\d{2}\-\d{4}$/) )
                localVals[index] = localVals[index].replace(/-/g,'/')
        }
    });
    
    // Flip though all fields on the form 
    let form = FormFill.pdfDoc.getForm();
    let fields = form.getFields();
    $.each( fields, function(_,pdfField) {
        let index = FormFill.settings['pdf-field-name'].indexOf(pdfField.getName());
        if ( index == -1 )
            return true;
        if ( pdfField.check ) {
            if ( typeof localVals[index] == "string" ) {
                localVals[index] = localVals[index].trim();
                localVals[index] = localVals[index] == "0" ? false : localVals[index];
            }
            if (localVals[index])
                pdfField.check();
            else if ( !localVals[index])
                pdfField.uncheck();
        }
        else
            pdfField.setText( localVals[index] );
    });
    
    // Save and send
    let pdf;
    switch ( FormFill.settings.destination ) {
        case 'email':
            pdf = await FormFill.pdfDoc.saveAsBase64();
            FormFill.functions.send(FormFill.from, FormFill.settings.email, FormFill.settings.subject || "", pdf);
            break;
        case 'fax':
            pdf = await FormFill.pdfDoc.saveAsBase64();
            let phone = FormFill.settings.phone.replace(/[-() ]/g,'');
            phone = phone.length != 11 ? '1' + phone : phone;
            FormFill.functions.send(FormFill.from, phone + "@" + FormFill.fax, FormFill.settings.subject || "", pdf);
            break;
        case 'download':
            let pdfBytes = await FormFill.pdfDoc.save();
            FormFill.functions.download(pdfBytes, $("#dataEntryTopOptionsButtons").next('div').text().trim()+".pdf", "application/pdf");
            break;
    }
}

FormFill.functions.send = function(from, to, subject, pdf) {
    $.ajax({
        method: 'POST',
        url: FormFill.POST,
        data: {
            from: from,
            to: to,
            attachment: pdf,
            subject: subject
        },
        error: async function(jqXHR, textStatus, errorThrown){ 
            console.log(textStatus);
            let uri = await FormFill.pdfDoc.saveAsBase64({ dataUri: true });
            Swal.fire({
                icon: 'error',
                title: 'Issue Sending Fax/Email',
                text: 'REDCap was unable to send the form as requested. You may download the completed form below and send it manually.',
                footer: `<a href=${uri} style="font-size:large" download="REDCap_Form.pdf"><b>Download</b></a>`,
                allowOutsideClick: false
            });
        },
        success: function(data){ 
            console.log(data); 
            Swal.fire({
                icon: 'success',
                title: 'Document Sent',
                text: 'The completed document has been successfully ' + FormFill.settings.destination + 'ed!',
            });
        }
    });
}

FormFill.functions.download = function(data, name, type) {
    if (data !== null && navigator.msSaveBlob)
        return navigator.msSaveBlob(new Blob([data], { type: type }), name);
    var a = $("<a style='display: none;'/>");
    var url = window.URL.createObjectURL(new Blob([data], {type: type}));
    a.attr("href", url);
    a.attr("download", name);
    $("body").append(a);
    a[0].click();
    window.URL.revokeObjectURL(url);
    a.remove();
}

FormFill.functions.issue = function() {
    Swal.fire({
        icon: 'error',
        title: 'Missing Configuration',
        text: 'Missing Email or Fax configuration to send this document. Please contact a REDCap administrator to resolve this.',
    });
}

$(document).ready( async function () {
    console.log("Loading FormFill Plugin");
    FormFill.pdfDoc = await PDFLib.PDFDocument.load( Uint8Array.from(Object.values(FormFill.pdf_base64)) );
    
    if (typeof Shazam == "object") { 
        let oldCallback = Shazam.beforeDisplayCallback;
        Shazam.beforeDisplayCallback = function () {
            if (typeof oldCallback == "function") 
                oldCallback();
            FormFill.functions.attachEvents();
        }
        setTimeout(FormFill.functions.attachEvents, 2000);
    }
    else 
        FormFill.functions.attachEvents();
    
});