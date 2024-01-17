(() => {
    let module = ExternalModules.UWMadison.FormFill;
    let initSuccess = false;

    log = (action = "", changes = "") => {
        const page = getParameterByName('id') ? "record" : "home";
        module.ajax("log", {
            action: action,
            changes: changes,
            page: page
        }).then(function (response) {
            console.log(response)
        }).catch(function (err) {
            console.log(err)
        });
    }

    attachEvents = () => {
        if (initSuccess) return;
        if ((module.settings.destination == 'email' && !module.settings.email) ||
            (module.settings.destination == 'fax' && (!module.settings.phone || !module.fax))) {
            $(module.settings.button).on('click', issue);
        }
        else {
            $(module.settings.button).on('click', fillPDF);
        }
        initSuccess = true;
    }

    fillPDF = async () => {

        // Grab any blank values that might be on this form and do any formatting    
        let localVals = module.settings['fill-value'];
        $.each(module.settings['redcap-fields'], function (index, name) {

            // Grab local values
            if ($(`*[name=${name}]`).length > 0) {
                localVals[index] = $(`*[name=${name}]`).val();

                // We don't know the format of local dates (M/D/Y or D/M/Y), sub delimiter
                let [d, t] = localVals[index].split(' ');
                if (d.match(/^\d{2}\-\d{2}\-\d{4}$/)) {
                    const deliminter = module.format.replace(/[a-zA-Z0-9 ]/g, '')[0];
                    localVals[index] = localVals[index].replaceAll('-', deliminter);
                }
            }

            // Format Y-M-D to w/e the user wants
            if (typeof localVals[index] == "string") {
                let [d, t] = localVals[index].split(' ');
                if (d.match(/^\d{4}\-\d{2}\-\d{2}$/)) {
                    localVals[index] = formatDate(new Date(`${d} ${t || "00:00"}`), module.format);
                }
            }
        });

        // Flip though all fields on the form 
        let form = module.pdfDoc.getForm();
        let fields = form.getFields();
        $.each(fields, function (_, pdfField) {
            let index = module.settings['pdf-field-name'].indexOf(pdfField.getName());
            if (index == -1)
                return true;
            if (pdfField.check) {
                if (typeof localVals[index] == "string") {
                    localVals[index] = localVals[index].trim();
                    localVals[index] = localVals[index] == "0" ? false : localVals[index];
                }
                if (localVals[index])
                    pdfField.check();
                else if (!localVals[index])
                    pdfField.uncheck();
            }
            else {
                let tmp = ((typeof localVals[index] === "undefined") || (localVals[index] == null)) ? "[Field Does Not Exist]" : localVals[index];
                pdfField.setText(tmp);
            }
        });

        // Save and send
        let pdf = null;
        switch (module.settings.destination) {
            case 'email':
                pdf = await module.pdfDoc.saveAsBase64();
                let emails = module.settings.email.replaceAll(' ', '').split(',');
                emails.forEach(async (email) => {
                    await send(module.from, email, module.settings.subject || "", pdf, module.settings.body);
                });
                break;
            case 'fax':
                pdf = await module.pdfDoc.saveAsBase64();
                let phones = module.settings.phone.replace(/[-() ]/g, '').split(',');
                phones.forEach(async (phone) => {
                    phone = phone.length != 11 ? '1' + phone : phone;
                    await send(module.from, phone + "@" + module.fax, module.settings.regarding || "", pdf, module.settings.cover);
                });
                break;
            case 'download':
                let pdfBytes = await module.pdfDoc.save();
                download(pdfBytes, $("#dataEntryTopOptionsButtons").next('div').text().trim() + ".pdf", "application/pdf");
                break;
        }
    }

    send = async (from, to, subject, pdf, body) => {
        module.ajax("email", {
            from: from,
            to: to,
            attachment: pdf,
            subject: subject,
            message: body
        }).then(function (response) {
            console.log(response.text);
            if (response.sent) {
                Swal.fire({
                    icon: 'success',
                    title: 'Document Sent',
                    text: 'The completed document has been successfully ' + module.settings.destination + 'ed!',
                });
                log('Form sent', 'To: ' + to + '\nSubject: ' + subject);
            } else {
                failsafeDownload();
                log('Form send failed', 'To: ' + to + '\nSubject: ' + subject);
            }
        }).catch(function (err) {
            console.log(err);
            failsafeDownload();
            log('Form send failed', 'To: ' + to + '\nSubject: ' + subject);
        });
    }

    failsafeDownload = async () => {
        let uri = await module.pdfDoc.saveAsBase64({ dataUri: true });
        Swal.fire({
            icon: 'error',
            title: 'Issue Sending Fax/Email',
            text: 'REDCap was unable to send the form as requested. You may download the completed form below and send it manually.',
            footer: `<a href=${uri} style="font-size:large" download="REDCap_Form.pdf"><b>Download</b></a>`,
            allowOutsideClick: false
        });
    }

    download = (data, name, type) => {
        // Create a junk object to enable the download
        if (data !== null && navigator.msSaveBlob)
            return navigator.msSaveBlob(new Blob([data], { type: type }), name);
        var tmp = $("<a style='display: none;'/>");
        var url = window.URL.createObjectURL(new Blob([data], { type: type }));
        tmp.attr("href", url);
        tmp.attr("download", name);
        $("body").append(tmp);
        tmp[0].click();
        window.URL.revokeObjectURL(url);
        tmp.remove();
        log('Form Downloaded', 'File: ' + name);
    }

    issue = () => {
        Swal.fire({
            icon: 'error',
            title: 'Missing Configuration',
            text: 'Missing Email or Fax configuration to send this document. Please contact a REDCap administrator to resolve this.',
        });
    }

    $(document).ready(async () => {
        module.pdfDoc = await PDFLib.PDFDocument.load(Uint8Array.from(Object.values(module.pdf_base64)));
        // Load the config, play nice w/ Shazam
        if (typeof Shazam == "object") {
            let oldCallback = Shazam.beforeDisplayCallback;
            Shazam.beforeDisplayCallback = function () {
                if (typeof oldCallback == "function")
                    oldCallback();
                attachEvents();
            }
            setTimeout(attachEvents, 2000);
        }
        else {
            attachEvents();
        }
    });
})();