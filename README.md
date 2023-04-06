# FormFill - Redcap External Module

## What does it do?

FormFill allows for a PDF to have it's data fields populated and then downloaded or emailed. If your institution uses an eFax solution then the this allows for the PDF to be directly faxed as well.

## Installing

You can install the module from the REDCap EM repo or drop it directly in your modules folder (i.e. `redcap/modules/form_fill_v1.0.0`) manually.

## Configuration

Core configuration consists of selecting an active instrument, source file (a PDF stored on the redcap server), a CSS selector for the action button (i.e. Send Fax, Send Email, Download), destination information (i.e. email, phone number), and the source/target pairs for each item to be filled on the PDF.

## Call Outs

* Consider using [PDF Injector](https://github.com/tertek/redcap-pdf-injector) EM if you do not care about embedding PDF generation in a form or sending the PDF after creation.

* PDF Radios and dropdowns are not supported

* We only support one instance of form fill per instrument
