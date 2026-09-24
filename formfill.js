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
        $.each(module.settings, function (index, btnSetting) {
            if ((btnSetting.destination == 'email' && !btnSetting.email) ||
                (btnSetting.destination == 'fax' && (!btnSetting.phone || !module.fax))) {
                $(btnSetting.button).on('click', issue);
                return;
            }
            $(btnSetting.button).on('click', function () {
                fillPDF(index);
            });
        })
        initSuccess = true;
    }

    formatDateTimeValue = (val) => {
        if (typeof val !== "string" || !val.trim()) return val;

        val = val.trim();
        const format = module.format || 'MM/dd/y';

        // 1. Pure time (e.g. "14:30", "14:30:45", "2:30 PM")
        const pureTimeMatch = val.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*([ap]m))?$/i);
        if (pureTimeMatch) {
            let [, hStr, mStr, sStr, ampmStr] = pureTimeMatch;
            let h = parseInt(hStr, 10);
            let m = parseInt(mStr, 10);
            let hasSec = sStr !== undefined;
            let s = hasSec ? parseInt(sStr, 10) : 0;

            if (ampmStr) {
                let lower = ampmStr.toLowerCase();
                if (lower === 'pm' && h < 12) h += 12;
                if (lower === 'am' && h === 12) h = 0;
            }

            if (module.tzOffset && module.tzOffset !== 0) {
                h = (h + parseInt(module.tzOffset, 10)) % 24;
                if (h < 0) h += 24;
            }

            if (module.use12HourTime) {
                let ampm = h >= 12 ? 'PM' : 'AM';
                let h12 = h % 12 || 12;
                let mFormatted = m.toString().padStart(2, '0');
                let sFormatted = hasSec ? `:${s.toString().padStart(2, '0')}` : '';
                return `${h12}:${mFormatted}${sFormatted} ${ampm}`;
            } else {
                let hFormatted = h.toString().padStart(2, '0');
                let mFormatted = m.toString().padStart(2, '0');
                let sFormatted = hasSec ? `:${s.toString().padStart(2, '0')}` : '';
                return `${hFormatted}:${mFormatted}${sFormatted}`;
            }
        }

        // 2. Date or Datetime (e.g. "2026-09-24", "09-24-2026", "2026-09-24 14:30", "09-24-2026 14:30")
        let parts = val.split(/\s+/);
        let d = parts[0];
        let t = parts.slice(1).join(' ');

        let ymdMatch = d.match(/^(\d{4})[-\/](\d{2})[-\/](\d{2})$/);
        let mdyMatch = d.match(/^(\d{2})[-\/](\d{2})[-\/](\d{4})$/);
        let tMatch = t ? t.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*([ap]m))?$/i) : null;

        if (ymdMatch || mdyMatch) {
            let year, month, day;
            if (ymdMatch) {
                year = parseInt(ymdMatch[1], 10);
                month = parseInt(ymdMatch[2], 10);
                day = parseInt(ymdMatch[3], 10);
            } else {
                let isDmy = /^[dD]/.test(format);
                if (isDmy) {
                    day = parseInt(mdyMatch[1], 10);
                    month = parseInt(mdyMatch[2], 10);
                } else {
                    month = parseInt(mdyMatch[1], 10);
                    day = parseInt(mdyMatch[2], 10);
                }
                year = parseInt(mdyMatch[3], 10);
            }

            let dt;
            let hasTime = !!tMatch;
            let hasSec = false;

            if (hasTime) {
                let h = parseInt(tMatch[1], 10);
                let m = parseInt(tMatch[2], 10);
                hasSec = tMatch[3] !== undefined;
                let s = hasSec ? parseInt(tMatch[3], 10) : 0;
                let ampmStr = tMatch[4];

                if (ampmStr) {
                    let lower = ampmStr.toLowerCase();
                    if (lower === 'pm' && h < 12) h += 12;
                    if (lower === 'am' && h === 12) h = 0;
                }

                // Construct in local time to avoid UTC parsing timezone shifts
                dt = new Date(year, month - 1, day, h, m, s);

                if (module.tzOffset && module.tzOffset !== 0) {
                    dt.setHours(dt.getHours() + parseInt(module.tzOffset, 10));
                }
            } else {
                // Pure date constructed in local time
                dt = new Date(year, month - 1, day);
            }

            let formattedDate = typeof formatDate === 'function'
                ? formatDate(dt, format)
                : `${(dt.getMonth() + 1).toString().padStart(2, '0')}/${dt.getDate().toString().padStart(2, '0')}/${dt.getFullYear()}`;

            if (!hasTime) {
                return formattedDate;
            }

            let formattedTime;
            let h = dt.getHours();
            let m = dt.getMinutes().toString().padStart(2, '0');
            let s = hasSec ? `:${dt.getSeconds().toString().padStart(2, '0')}` : '';

            if (module.use12HourTime) {
                let ampm = h >= 12 ? 'PM' : 'AM';
                let h12 = h % 12 || 12;
                formattedTime = `${h12}:${m}${s} ${ampm}`;
            } else {
                let h24 = h.toString().padStart(2, '0');
                formattedTime = `${h24}:${m}${s}`;
            }

            return `${formattedDate} ${formattedTime}`;
        }

        return val;
    };

    fillPDF = async (settingsIndex) => {

        // Grab any blank values that might be on this form and do any formatting   
        const btnSettings = module.settings[settingsIndex];
        const pdfDoc = module.pdfDoc[settingsIndex];
        let localVals = [...btnSettings['fill-value']];
        $.each(btnSettings['redcap-fields'], function (index, name) {

            // Grab local values
            if ($(`*[name=${name}]`).length > 0) {
                localVals[index] = $(`*[name=${name}]`).val();
            }

            if (typeof localVals[index] == "string") {
                localVals[index] = formatDateTimeValue(localVals[index]);
            }
        });

        // Flip though all fields on the form 
        let form = pdfDoc.getForm();
        let fields = form.getFields();
        $.each(fields, function (_, pdfField) {
            let index = btnSettings['pdf-field-name'].indexOf(pdfField.getName());
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
        let pdf = await pdfDoc.saveAsBase64();
        let uri = await pdfDoc.saveAsBase64({ dataUri: true });
        switch (btnSettings.destination) {
            case 'email':
                let emails = btnSettings.email.replaceAll(' ', '').split(',');
                emails.forEach(async (email) => {
                    await send(module.from, email, btnSettings.subject || "", pdf, uri, btnSettings.body);
                });
                break;
            case 'fax':
                let phones = btnSettings.phone.replace(/[-() ]/g, '').split(',');
                phones.forEach(async (phone) => {
                    phone = phone.length != 11 ? '1' + phone : phone;
                    await send(module.from, phone + "@" + module.fax, btnSettings.regarding || "", pdf, uri, btnSettings.cover);
                });
                break;
            case 'download':
                let pdfBytes = await pdfDoc.save();
                download(pdfBytes, $("#dataEntryTopOptionsButtons").next('div').text().trim() + ".pdf", "application/pdf");
                break;
        }
    }

    send = async (from, to, subject, pdf, uri, body) => {
        const msg = `To: ${to}\nSubject: ${subject}`

        module.ajax("email", {
            from: from,
            to: to,
            attachment: pdf,
            subject: subject,
            message: body
        }).then(async function (response) {
            console.log(response.text);
            if (response.sent) {
                Swal.fire({
                    icon: 'success',
                    title: 'Document Sent',
                    text: 'The completed document has been successfully sent!',
                });
                log('Form sent', msg);
                return;
            }
            failsafeDownload(uri);
            log('Form send failed', msg);
        }).catch(async function (err) {
            console.log(err);
            failsafeDownload(uri);
            log('Form send failed', msg);
        });
    }

    failsafeDownload = async (uri) => {
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
        module.pdfDoc = []
        $.each(module.pdf_base64, async function (index, pdf) {
            module.pdfDoc[index] = await PDFLib.PDFDocument.load(Uint8Array.from(Object.values(pdf)));
        });
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