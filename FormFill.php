<?php

namespace UWMadison\FormFill;

use ExternalModules\AbstractExternalModule;
use REDCap;

class FormFill extends AbstractExternalModule
{
    public function redcap_every_page_top($project_id)
    {
        // Custom Config page
        if ($this->isPage('ExternalModules/manager/project.php') && $project_id) {
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
                $doc_id = $valueArray[$settingIndex];
                if (!empty($doc_id)) {
                    list($mimeType, $docName, $fileContent) = REDCap::getFile($doc_id);
                    $file = unpack("C*", $fileContent);
                }
                continue;
            }

            if ($name == 'fill-value') {
                $fetched = [];
                $defaultEvent = $settings['event'][$settingIndex];
                foreach ($valueArray[$settingIndex] as $index => $field) {
                    $data = REDCap::getData($project_id, 'array', $record, $field)[$record];
                    $default = empty($data[$defaultEvent][$field]) ? reset($data)[$field] : $data[$defaultEvent][$field];
                    $data = empty($data[$event_id][$field]) ? $default : $data[$event_id][$field];
                    $type = $dd[$field]['field_type'];
                    $validation = $dd[$field]['text_validation_type_or_show_slider_number'];
                    if ($type == 'checkbox') // Only look at first check box
                        $data = reset($data) ? true : false;
                    if ($type == 'radio' || $type == 'yesno' || $type == 'dropdown') // Code blank, 0, and negatives as false
                        $data = $data == '' || $data == '0' ? false : !(intval($data) < 0);
                    $fetched[$index] = $this->escape($data);
                }
                $parsed[$name] = $fetched;
                $parsed['redcap-fields'] = $valueArray[$settingIndex];
                continue;
            }

            $parsed[$name] = $valueArray[$settingIndex];
        }

        if (!empty($file)) {
            $this->passArgument('pdf_base64', $file);
            $this->passArgument('settings', $parsed);
            $this->includeJs('pdf-lib.min.js');
            $this->includeJs('formfill.js');
        }
    }

    public function redcap_module_ajax($action, $payload, $project_id, $record, $instrument, $event_id)
    {
        $result = [];
        if ($action == "log") {
            $result = $this->projectLog($project_id, $record, $event_id, $payload['action'], $payload['changes']);
        } elseif ($action == "email") {
            $result = $this->sendEmail($payload['to'], $payload['from'], $payload['subject'], $payload['message'], $payload['attachment']);
        }
        return $result;
    }

    public function sendEmail($to, $from, $subject, $message, $attachment)
    {
        if (!isset($from) || !isset($to) || !isset($attachment)) {
            return [
                'text' => "Missing required parameters",
                'sent' => false
            ];
        }

        // Set blank values if missing
        if (!isset($subject)) $subject = '';
        if (!isset($message)) $message = ' '; // Redcap requires a non-empty-string message

        // Stash the PDF in the PHP tmp directory, send the email, and remove the file
        $pdf = base64_decode($attachment);
        $path = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'tmpRedcap.pdf';
        $file = fopen($path, 'w');
        fwrite($file, $pdf);
        fclose($file);
        $sent = REDCap::email($to, $from, $subject, $message, null, null, null, ['REDCap_Form.pdf' => $path]);
        unlink($path);

        return [
            'text' => $sent ? "Email/Fax Sent" : "Issue sending Email/Fax",
            'sent' => $sent
        ];
    }

    public function projectLog($project_id, $record, $event_id, $action, $changes)
    {
        $sql = NULL;
        $action =  empty($action)  ? "No action logged" : $action;
        $changes = empty($record) || empty($event_id) ? "Record Home Page\n{$changes}" : $changes;
        REDCap::logEvent($action, $changes, $sql, $record, $event_id, $project_id);
        return [
            'text' => 'Action logged'
        ];
    }

    private function initGlobal()
    {
        global $project_contact_email;
        global $from_email;
        $this->initializeJavascriptModuleObject();
        $data = json_encode([
            "prefix" => $this->getPrefix(),
            "from" => $from_email ? $from_email : $project_contact_email,
            "fax" => $this->getProjectSetting('fax-fufiller'),
            "format" => $this->getProjectSetting('date-format')
        ]);
        echo "<script>Object.assign({$this->getJavascriptModuleObjectName()}, {$data});</script>";
    }

    private function passArgument($name, $value)
    {
        echo "<script>{$this->getJavascriptModuleObjectName()}.{$name} = " . json_encode($value) . ";</script>";
    }

    private function includeJs($path)
    {
        echo "<script src={$this->getUrl($path)}></script>";
    }
}
