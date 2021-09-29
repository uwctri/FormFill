<?php
if ( $_POST['route'] == "email" ) {
    $module->sendEmail();
} elseif ( $_POST['route'] == "log" ) {
    $module->projectLog();
}
?>