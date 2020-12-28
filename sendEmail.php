<?php
$module = new \UWMadison\FormFill\FormFill();
use REDCap;

if ($_SERVER['REQUEST_METHOD'] != 'POST' || !isset($_POST['from']) || !isset($_POST['to']) || !isset($_POST['attachment'])) {
    echo "Missing required parameters";
}

// Set blank values if missing
if (!isset($_POST['subject'])) $_POST['subject'] = '';
if (!isset($_POST['message'])) $_POST['message'] = ' '; // Redcap requires a non-empty-string message

// Stash the PDF in the PHP tmp directory, send the email, and remove the file
$pdf = base64_decode($_POST['attachment']);
$path = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'tmpRedcap.pdf';
$file = fopen($path,'w');
fwrite($file,$pdf);
fclose($file);
$sent = REDCap::email($_POST['to'], $_POST['from'], $_POST['subject'], $_POST['message'], null, null, null, ['REDCap_Form.pdf'=>$path]);
unlink($path);

if ($sent) {
    echo "Email/Fax Sent";
} else {
    echo "Issue sending Email/Fax";
}