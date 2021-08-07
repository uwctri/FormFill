<?php

namespace UWMadison\FormFill;
use ExternalModules\AbstractExternalModule;
use ExternalModules\ExternalModules;
use REDCap;

class FormFill extends AbstractExternalModule {
    
    private $module_prefix = 'form_fill';
    private $module_global = 'FormFill';
    
    private $PDFlibJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.13.0/pdf-lib.min.js';
    private $sha = 'sha512-NgGjd0/V0QfzSn73hJQ5v7pZI7uzDWB+mU2OvlCJhCP3HDGn3vXOHt4yYv/jA4HSjQfjf7CfmeysLNftJYEWIg==';
    
    public function __construct() {
        parent::__construct();
    }
    
    public function redcap_every_page_top($project_id) {
        // Custom Config page
        if (strpos(PAGE, 'ExternalModules/manager/project.php') !== false && $project_id != NULL) {
            $this->initGlobal();
            $this->includeJs('config.js');
        }
    }
    
    public function redcap_data_entry_form($project_id, $record, $instrument, $event_id, $group_id, $repeat_instance) {
        $allInstruments = $this->getProjectSetting('instrument');
        $settingIndex = -1;
        
        // Note: We only support one form fill per page here
        foreach ( $allInstruments as $index => $instrumentList ) {
            if ( in_array($instrument,  $instrumentList) )
                $settingIndex = $index;
        }
        
        if ( $settingIndex == -1 )
            return;
        
        $this->initGlobal();
        $settings = $this->getProjectSettings();
        $parsed = [];
        $dd = REDCap::getDataDictionary('array');
        
        foreach ( $settings as $name => $valueArray ) {
            if ( in_array($name, ['enabled','filable-instance','instrument','filable-field','event']) )
                continue;
                
            if ( $name == 'pdf' ) {
                $file = $valueArray[$settingIndex];
                if ( !empty($file) )
                    $file = unpack("C*", file_get_contents($file));
                continue;
            }
            
            if ( $name == 'fill-value' ) {
                $fetched = [];
                $defaultEvent = $this->getProjectSetting('event')[$settingIndex];
                foreach ( $valueArray[$settingIndex] as $index => $field ) {
                    $data = REDCap::getData( $project_id, 'array', $record, $field)[$record];
                    $data = empty($data[$event_id][$field]) ? empty($data[$defaultEvent][$field]) ? reset($data)[$field] : $data[$defaultEvent][$field] : $data[$event_id][$field];
                    $type = $dd[$field]['field_type'];
                    $validation = $dd[$field]['text_validation_type_or_show_slider_number'];
                    if ( $type == 'checkbox' ) // Only look at first check box
                        $data = reset($data) ? true : false;
                    if ( $type == 'radio' || $type == 'yesno' || $type=='dropdown' ) // Code blank, 0, and negatives as false
                        $data = $data == '' || $data == '0' ? false : !(intval($data) < 0);
                    $fetched[$index] = $data;
                }
                $parsed[$name] = $fetched;
                $parsed['redcap-fields'] = $valueArray[$settingIndex];
                continue;
            }
            
            $parsed[$name] = $valueArray[$settingIndex];
        }
         
        if ( !empty($file) ) {
            $this->passArgument('pdf_base64',$file);
            $this->passArgument('settings',$parsed);
            $this->includePDFlibJS();
            $this->includeJs('formfill.js');
        }
    }
    
    private function initGlobal() {
        global $project_contact_email;
        global $from_email;
        $data = array(
            "modulePrefix" => $this->module_prefix,
            "from" => $from_email ? $from_email : $project_contact_email,
            "POST" => $this->getUrl('sendEmail.php'),
            "fax" => $this->getSystemSetting('fax-fufiller')
        );
        echo "<script>var ".$this->module_global." = ".json_encode($data).";</script>";
    }
    
    private function passArgument($name, $value) {
        echo "<script>".$this->module_global.".".$name." = ".json_encode($value).";</script>";
    }
    
    private function includeJs($path) {
        echo '<script src="' . $this->getUrl($path) . '"></script>';
    }
    
    private function includePDFlibJS() {
        echo '<script src="'. $this->PDFlibJS .'" integrity="'. $this->sha .'" crossorigin="anonymous"></script>';
    }
}

?>
