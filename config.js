$(document).ready(function () {
    console.log("Loaded Form Fill config")
    var $modal = $('#external-modules-configure-modal');
    $modal.on('show.bs.modal', function () {
        // Making sure we are overriding this modules's modal only.
        if ($(this).data('module') !== FormFill.modulePrefix) return;

        if (typeof ExternalModules.Settings.prototype.resetConfigInstancesOld === 'undefined')
            ExternalModules.Settings.prototype.resetConfigInstancesOld = ExternalModules.Settings.prototype.resetConfigInstances;

        ExternalModules.Settings.prototype.resetConfigInstances = function () {
            ExternalModules.Settings.prototype.resetConfigInstancesOld();

            if ($modal.data('module') !== FormFill.modulePrefix) return;

            $modal.find("tr[field=destination]").each(function () {
                $(this).nextUntil('.sub_start').hide();
            });

            // Hide rows dependining on destination type
            $modal.find("tr[field=destination]").on('click', function () {
                let $set = $(this).nextUntil('.sub_start');
                $set.hide();
                let selection = $(this).find('input:checked').val();
                if (selection == 'email') {
                    $set.eq(0).show();
                    $set.eq(1).show();
                    $set.eq(2).show();
                } else if (selection == 'fax') {
                    $set.eq(3).show();
                    $set.eq(4).show();
                    $set.eq(5).show();
                }
            });
            $modal.find("tr[field=destination] input:checked").click();
        };
    });

    $modal.on('hide.bs.modal', function () {
        // Making sure we are overriding this modules's modal only.
        if ($(this).data('module') !== FormFill.modulePrefix) return;
        if (typeof ExternalModules.Settings.prototype.resetConfigInstancesOld !== 'undefined')
            ExternalModules.Settings.prototype.resetConfigInstances = ExternalModules.Settings.prototype.resetConfigInstancesOld;
    });
});