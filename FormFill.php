<?php

namespace UWMadison\FormFill;

use ExternalModules\AbstractExternalModule;
use REDCap;

class FormFill extends AbstractExternalModule
{

    private $module_global = 'FormFill';
    private $PDFlibJS = "https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.16.0/pdf-lib.min.js";
    private $sha = "sha512-fY7ysH3L9y/DP/DVYqPNopiQ+Ubd9t0dt9C4riu0RZwYOvMejMnKVAnXK7xfB0SIawKP0c4sQoh2niIMSkkWAw==";

    public function redcap_every_page_top($project_id)
    {
        // Custom Config page
        if (strpos(PAGE, 'manager/project.php') !== false && $project_id != NULL) {
            $this->initGlobal();
            $this->includeJs('config.js');
        }
    }

    public function redcap_data_entry_form($project_id, $record, $instrument, $event_id)
    {
        $settings = $this->getProjectSettings();
        $settingIndex = -1;

        // Note: We only support one form fill per page here
        foreach ($settings['instrument'] as $index => $instrumentList) {
            if (in_array($instrument,  $instrumentList))
                $settingIndex = $index;
        }

        if ($settingIndex == -1)
            return;

        $this->initGlobal();
        $parsed = [];
        $dd = REDCap::getDataDictionary('array');

        foreach ($settings as $name => $valueArray) {
            if (in_array($name, ['enabled', 'filable-instance', 'instrument', 'filable-field', 'event']))
                continue;

            if ($name == 'pdf') {
                $file = $valueArray[$settingIndex];
                if (!empty($file))
                    $file = unpack("C*", file_get_contents($file));
                continue;
            }

            if ($name == 'fill-value') {
                $fetched = [];
                $defaultEvent = $settings['event'][$settingIndex];
                foreach ($valueArray[$settingIndex] as $index => $field) {
                    $data = REDCap::getData($project_id, 'array', $record, $field)[$record];
                    $data = empty($data[$event_id][$field]) ? empty($data[$defaultEvent][$field]) ? reset($data)[$field] : $data[$defaultEvent][$field] : $data[$event_id][$field];
                    $type = $dd[$field]['field_type'];
                    $validation = $dd[$field]['text_validation_type_or_show_slider_number'];
                    if ($type == 'checkbox') // Only look at first check box
                        $data = reset($data) ? true : false;
                    if ($type == 'radio' || $type == 'yesno' || $type == 'dropdown') // Code blank, 0, and negatives as false
                        $data = $data == '' || $data == '0' ? false : !(intval($data) < 0);
                    $fetched[$index] = $data;
                }
                $parsed[$name] = $fetched;
                $parsed['redcap-fields'] = $valueArray[$settingIndex];
                continue;
            }

            $parsed[$name] = $valueArray[$settingIndex];
        }

        if (!empty($file)) {
            $this->passArgument('debug', $settings);
            $this->passArgument('pdf_base64', $file);
            $this->passArgument('settings', $parsed);
            $this->includePDFlibJS();
            $this->includeJs('formfill.js');
        }
    }

    public function sendEmail()
    {
        if ($_SERVER['REQUEST_METHOD'] != 'POST' || !isset($_POST['from']) || !isset($_POST['to']) || !isset($_POST['attachment'])) {
            echo json_encode([
                'text' => "Missing required parameters",
                'sent' => false
            ]);
            return;
        }

        // Set blank values if missing
        if (!isset($_POST['subject'])) $_POST['subject'] = '';
        if (!isset($_POST['message'])) $_POST['message'] = ' '; // Redcap requires a non-empty-string message

        // Stash the PDF in the PHP tmp directory, send the email, and remove the file
        $pdf = base64_decode($_POST['attachment']);
        $path = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'tmpRedcap.pdf';
        $file = fopen($path, 'w');
        fwrite($file, $pdf);
        fclose($file);
        $sent = REDCap::email($_POST['to'], $_POST['from'], $_POST['subject'], $_POST['message'], null, null, null, ['REDCap_Form.pdf' => $path]);
        unlink($path);

        echo json_encode([
            'text' => $sent ? "Email/Fax Sent" : "Issue sending Email/Fax",
            'sent' => $sent
        ]);
    }

    public function projectLog()
    {
        // We expect all of these to be set, just being safe.
        $sql = NULL;
        $action =  empty($_POST['action'])  ? "No action logged" : $_POST['action'];

        REDCap::logEvent($action, $_POST['changes'], $sql, $_POST['record'], $_GET['eventid'], $_GET['pid']);
        echo json_encode([
            'text' => 'Action logged'
        ]);
    }

    private function initGlobal()
    {
        global $project_contact_email;
        global $from_email;
        $data = json_encode([
            "modulePrefix" => $this->PREFIX,
            "from" => $from_email ? $from_email : $project_contact_email,
            "router" => $this->getUrl('router.php'),
            "fax" => $this->getSystemSetting('fax-fufiller')
        ]);
        echo "<script>var {$this->module_global} = {$data};</script>";
    }

    private function passArgument($name, $value)
    {
        echo "<script>{$this->module_global}.{$name} = " . json_encode($value) . ";</script>";
    }

    private function includeJs($path)
    {
        echo "<script src={$this->getUrl($path)}></script>";
    }

    private function includePDFlibJS()
    {
        echo "<script src={$this->PDFlibJS} integrity={$this->sha} crossorigin='anonymous'></script>";
    }
}
