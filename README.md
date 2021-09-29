# FormFill - Redcap External Module

## What does it do?

FormFill allows for a PDF to have it's data fields populated and then downloaded or emailed. If your institution uses an eFax solution then the this allows for the PDF to be directly faxed as well.

## Installing

This EM isn't yet available to install via redcap's EM database so you'll need to install to your modules folder (i.e. `redcap/modules/form_fill_v1.0.0`) manually.

## Configuration

Core configuration consists of selecting an active instrument, source file (a PDF stored on the redcap server), a CSS selector for the action button (i.e. Send Fax, Send Email, Download), destination information (i.e. email, phone number), and the source/target pairs for each item to be filled on the PDF. 

## Call Outs

* PDF Radio and dropdowns are not supported at this time.

* All dates are formatted m/d/y 

* We only support one instance of form fill per instrument

* PDF Checkboxes are supported, their data should be sourced from an text, note, or calc field. Each checkbox on the PDF should be indivudually named and data loaded for each.
