$(document).ready(function () {
    console.log("Loaded Form Fill config")
    let $modal = $('#external-modules-configure-modal');
    let prefix = ExternalModules.UWMadison.FormFill.prefix;
    $modal.on('show.bs.modal', function () {
        // Making sure we are overriding this modules's modal only.
        if ($(this).data('module') !== prefix) return;

        if (typeof ExternalModules.Settings.prototype.resetConfigInstancesOld === 'undefined')
            ExternalModules.Settings.prototype.resetConfigInstancesOld = ExternalModules.Settings.prototype.resetConfigInstances;

        ExternalModules.Settings.prototype.resetConfigInstances = function () {
            ExternalModules.Settings.prototype.resetConfigInstancesOld();

            if ($modal.data('module') !== prefix) return;
            $modal.find(".sub_parent td").css("background-color", "#e6e6e6");

            $modal.find("tr[field=destination]").each(function () {
                $(this).nextUntil('.sub_start').hide();
            });

            if ($modal.find("[name='date-format']").val() == "") {
                $modal.find("[name='date-format']").val('MM/dd/y');
            }

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
        if ($(this).data('module') !== prefix) return;
        if (typeof ExternalModules.Settings.prototype.resetConfigInstancesOld !== 'undefined')
            ExternalModules.Settings.prototype.resetConfigInstances = ExternalModules.Settings.prototype.resetConfigInstancesOld;
    });
});