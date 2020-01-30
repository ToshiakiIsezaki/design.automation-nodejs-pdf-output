/////////////////////////////////////////////////////////////////////////////////
// Copyright (c) Autodesk, Inc. All rights reserved
// Written by Toshiaki Isezaki 2019 - Forge Partner Development
//
// Permission to use, copy, modify, and distribute this software in
// object code form for any purpose and without fee is hereby granted,
// provided that the above copyright notice appears in all copies and
// that both that copyright notice and the limited warranty and
// restricted rights notice below appear in all supporting
// documentation.
//
// AUTODESK PROVIDES THIS PROGRAM "AS IS" AND WITH ALL FAULTS.
// AUTODESK SPECIFICALLY DISCLAIMS ANY IMPLIED WARRANTY OF
// MERCHANTABILITY OR FITNESS FOR A PARTICULAR USE.  AUTODESK, INC.
// DOES NOT WARRANT THAT THE OPERATION OF THE PROGRAM WILL BE
// UNINTERRUPTED OR ERROR FREE.
/////////////////////////////////////////////////////////////////////////////////
var _viewer = null;

// Launch viewer
function initializeViewer(urn) {

    if (_viewer !== null) {
        _viewer.uninitialize();
        _viewer = null;
    }

    // Intialize Viewer
    var options = {
        env: 'AutodeskProduction',
        api: 'derivativeV2',  // for models uploaded to EMEA change this option to 'derivativeV2_EU'
        language: 'ja',
        getAccessToken: getCredentials
    };

    Autodesk.Viewing.Initializer(options, function () {
        $("#start").prop("disabled", false);

        _viewer = new Autodesk.Viewing.GuiViewer3D(document.getElementById('viewer3d'));
        //_viewer = new Autodesk.Viewing.Viewer3D(document.getElementById('viewer3d'), {});  // No Navigation control & Environment Light(need _viewer.impl.setLightPreset(1);)

        var startedCode = _viewer.start();
        if (startedCode > 0) {
            console.error('Failed to create a Viewer: WebGL not supported.');
            return;
        }

        console.log('Initialization complete, loading a model next...');
        _viewer.addEventListener(Autodesk.Viewing.TOOLBAR_CREATED_EVENT, onToolbarCreated);
        _viewer.addEventListener(Autodesk.Viewing.EXTENSION_LOADED_EVENT, onExtensionLoaded);
        _viewer.addEventListener(Autodesk.Viewing.GEOMETRY_LOADED_EVENT, onViewerGeometryLoaded);

        // Change loading-spinnner
        //replaceSpinner();

        // Load viewable
        var documentId = 'urn:' + urn;
        Autodesk.Viewing.Document.load(documentId, onDocumentLoadSuccess, onDocumentLoadFailure);

    });

    function onDocumentLoadSuccess(viewerDocument) {

        var viewables = viewerDocument.getRoot().search({
            'type': 'geometry',
            'role': '2d'
        });

        _viewer.loadDocumentNode(viewerDocument, viewables[0]).then(i => {
            _viewer.setTheme("light-theme");
            _viewer.setSwapBlackAndWhite(true);
            _viewer.setLightPreset(2);
            _viewer.disableHighlight();
            apiStatus("VR");
        });

    }

    function onDocumentLoadFailure() {
        console.error('Failed fetching Forge manifest');
    }

    function onExtensionLoaded(event) {

        console.log("onExtensionLoaded");

    }

    function onToolbarCreated(event) {
        console.log("onToolbarCreated");

    }

    function onViewerGeometryLoaded(event) {
        console.log("onViewerGeometryLoaded");

        // Zoom object extents
        _viewer.fitToView();
    }

}

function replaceSpinner() {
    var spinners = document.getElementsByClassName('spinner');
    if (spinners.length === 0) return;
    var spinner = spinners[0];
    spinner.classList.remove('spinner');
    spinner.classList.add('lds-ring');
    spinner.innerHTML = '<div></div>';
}

// Submit button
$(document).on("click", "[id^='start']", function () {

    $("#start").prop("disabled", true);
    $("#download").prop("disabled", true);

    // Triger process
    apiStatus("DA");
    $("#loaders").css('visibility', 'visible');
    var uri = '/api/process/';
    $.ajax({
        url: uri,
        type: 'POST',
        contentType: 'text/plain'
    }).done(function (res) {

        var workitemId = res;

        // Set timer to repeat getting WorkItem status
        var startTime = new Date().getTime();
        var timeout = 1000 * 60 * 5; // 5 minutes
        var timer = setInterval(function () {
            var dt = (new Date().getTime() - startTime) / timeout;
            if (dt >= 1.0) {
                clearInterval(timer);
            } else {

                // Check Process Status
                var uri = '/api/process-status/' + workitemId;
                $.ajax({
                    url: uri,
                    type: 'GET',
                    contentType: 'text/plain'
                }).done(function (res) {

                    if (res) {
                        var status = JSON.parse(res).status;
                        console.log("Process status:" + status);
                        if (status === 'success') {
                            console.log("Design Automation Process Report >> " + JSON.parse(res).reportUrl);
                            $("#start").prop("disabled", false);
                            $("#download").prop("disabled", false);
                            clearInterval(timer);

                            // Start Translation
                            apiStatus("MD");
                            uri = '/api/start-translation/';
                            $.ajax({
                                url: uri,
                                type: 'GET',
                                dataType: 'json',
                                beforeSend: function (xhr) {
                                },
                                success: function (res) {
                                    if (res) {

                                        // Viewable drawing
                                        var urn = JSON.parse(JSON.stringify(res)).urn;

                                        // Set timer to repeat getting manifest
                                        var startTime = new Date().getTime();
                                        var timeout = 1000 * 60 * 5; // 5 minutes
                                        var timer = setInterval(function () {
                                            var dt = (new Date().getTime() - startTime) / timeout;
                                            if (dt >= 1.0) {
                                                clearInterval(timer);
                                            }
                                            else {
                                                // Check Translation Status
                                                var uri = '/api/translation-status/';
                                                $.ajax({
                                                    url: uri,
                                                    type: 'GET',
                                                    dataType: 'json',
                                                    beforeSend: function (xhr) {
                                                        //$("#progress").progressbar("option", "value", 0);
                                                    },
                                                    success: function (res) {
                                                        if (res) {
                                                            var data = JSON.stringify(res);
                                                            var status = JSON.parse(data).status;
                                                            var progress = JSON.parse(data).progress;
                                                            console.log(status + ' ' + progress);
                                                            if (progress === 'complete') {
                                                                clearInterval(timer);
                                                                initializeViewer(urn);
                                                                apiStatus("");
                                                                $("#loaders").css('visibility', 'hidden');
                                                            }
                                                        }
                                                    },
                                                    error: function (res) {
                                                        console.log('error:' + res.error[0]);
                                                    }

                                                });

                                            }
                                        }, 2000);

                                    }
                                },
                                error: function (res) {
                                    console.log('error:' + res);
                                }
                            });

                        } else if (status === 'failedInstructions' ||
                            status === 'failedLimitDataSize' ||
                            status === 'failedLimitProcessingTime' ||
                            status === 'failedDownload' ||
                            status === 'failedUpload') {
                            clearInterval(timer);
                            apiStatus("");
                            $("#loaders").css('visibility', 'hidden');
                            alert("Failed to PDFoutput process");
                            console.log("Design Automation Process Report >> " + JSON.parse(res).reportUrl);
                       }
                    }

                }).fail(function (jqXHR, textStatus, errorThrown) {
                    clearInterval(timer);
                    apiStatus("");
                    $("#loaders").css('visibility', 'hidden');
                    alert("Failed to PDFoutput process");
                    console.log('Failed : ', jqXHR, textStatus, errorThrown);
                    console.log("Design Automation Process Report >> " + JSON.parse(res).reportUrl);
                });

            }

        }, 2000);

    }).fail(function (jqXHR, textStatus, errorThrown) {
        $("#loaders").css('visibility', 'hidden');
        alert("Failed to CoilCreation process");
        console.log('Failed : ', jqXHR, textStatus, errorThrown);
    });

});

// Download button
$(document).on("click", "[id^='download']", function () {

    $("#start").prop("disabled", false);
    $("#download").prop("disabled", true);

    var uri = '/api/download';
    $.ajax({
        url: uri,
        type: 'GET',
        contentType: 'application/json'
    }).done(function (res) {
        console.log(res);
        apiStatus("DM");
        var link = document.createElement('a');
        var downloadUrl = JSON.parse(res).signedUrl;
        link.href = downloadUrl;
        link.click();
        setTimeout(apiStatus, 3000, "VR");
    }).fail(function (jqXHR, textStatus, errorThrown) {
        console.log('Failed : ', jqXHR, textStatus, errorThrown);
    });

});

// Upload Source button
$(document).on("click", "[id^='uploadtemplate']", function () {

    if ($('#form-file-template').val().length === 0) {
        alert("Source drawing isn't selected\nSelect Source drawing first\nNote that file name must be source.dwg");
        return;
    }

    var yesno = window.confirm("Are you sure to upload Source drawing?");
    if (yesno) {

        $("#start").prop("disabled", true);
        $("#download").prop("disabled", true);

        apiStatus("DA");
        $("#loaders").css('visibility', 'visible');

        var form = $('#data-form-template').get()[0];

        var formData = new FormData(form);

        var uri = '/api/template-upload';
        $.ajax({
            url: uri,
            type: 'POST',
            data: formData,
            processData: false,
            contentType: false
        }).done(function (res) {
            apiStatus("VR");
            $("#loaders").css('visibility', 'hidden');
            $("#start").prop("disabled", false);
            alert("Source drawing was loaded");
        }).fail(function (jqXHR, textStatus, errorThrown) {
            apiStatus("");
            $("#loaders").css('visibility', 'hidden');
            alert("Failed to upload Source drawing : " + errorThrown);
        });

        formData.delete("file");

    }

});

// Delete AppBundle button
$(document).on("click", "[id^='delappbundle']", function () {

    var yesno = window.confirm("Are you sure to delete AppBundle?\nWorkItem stops working.");
    if (yesno) {

        $("#start").prop("disabled", true);
        $("#download").prop("disabled", true);

        apiStatus("DA");
        $("#loaders").css('visibility', 'visible');

        var uri = '/api/delete-appbundle';
        $.ajax({
            url: uri,
            type: 'GET',
            contentType: 'application/json'
        }).done(function (res) {
            apiStatus("VR");
            $("#loaders").css('visibility', 'hidden');
            alert("AppBundle was deleted");
        }).fail(function (jqXHR, textStatus, errorThrown) {
            apiStatus("");
            $("#loaders").css('visibility', 'hidden');
            alert("Failed to delete AppBundle : " + errorThrown);
        });

    }

});

// Register AppBundle button
$(document).on("click", "[id^='regiappbundle']", function () {

    if ($('#form-file-appbundle').val().length === 0) {
        alert("Zipped package bundle isn't selected\nSelect zipped package bundle first");
        return;
    }

    var yesno = window.confirm("Are you sure to register AppBundle?");
    if (yesno) {

        $("#start").prop("disabled", true);
        $("#download").prop("disabled", true);

        apiStatus("DA");
        $("#loaders").css('visibility', 'visible');

        var form = $('#data-form-appbundle').get()[0];
        
        var formData = new FormData(form);

        var uri = '/api/appbundle-upload';
        $.ajax({
            url: uri,
            type: 'POST',
            data: formData,
            processData: false,
            contentType: false
        }).done(function (res) {
            apiStatus("VR");
            $("#loaders").css('visibility', 'hidden');
            $("#start").prop("disabled", false);
            alert("AppBundle was registered");
        }).fail(function (jqXHR, textStatus, errorThrown) {
            apiStatus("");
            $("#loaders").css('visibility', 'hidden');
            alert("Failed to register AppBundle : " + errorThrown);
        });

        formData.delete("file");

    }

});

// Delete Activity button
$(document).on("click", "[id^='delactivity']", function () {

    var yesno = window.confirm("Are you sure to delete Activity?\nWorkItem stops working.");
    if (yesno) {

        $("#start").prop("disabled", true);
        $("#download").prop("disabled", true);

        apiStatus("DA");
        $("#loaders").css('visibility', 'visible');

        var uri = '/api/delete-activity';
        $.ajax({
            url: uri,
            type: 'GET',
            contentType: 'application/json'
        }).done(function (res) {
            apiStatus("VR");
            $("#loaders").css('visibility', 'hidden');
            alert("Activity was deleted");
        }).fail(function (jqXHR, textStatus, errorThrown) {
            apiStatus("");
            $("#loaders").css('visibility', 'hidden');
            alert("Failed to delete Activity : " + errorThrown);
        });

    }

});

// Register Activity button
$(document).on("click", "[id^='regiactivity']", function () {

    var yesno = window.confirm("Are you sure to register Activity?");
    if (yesno) {

        $("#start").prop("disabled", true);
        $("#download").prop("disabled", true);

        apiStatus("DA");
        $("#loaders").css('visibility', 'visible');

        var uri = '/api/register-activity';
        $.ajax({
            url: uri,
            type: 'GET',
            contentType: 'application/json'
        }).done(function (res) {
            apiStatus("VR");
            $("#loaders").css('visibility', 'hidden');
            $("#start").prop("disabled", false);
            alert("Activity was registered");
        }).fail(function (jqXHR, textStatus, errorThrown) {
            apiStatus("");
            $("#loaders").css('visibility', 'hidden');
            alert("Failed to register Activity : " + errorThrown);
        });

    }

});

// Reload viewer
function onViewModel() {
    var mode = Autodesk.Viewing.Private.getParameterByName("mode");
    if (mode !== "admin") {
        $("#delappbundle").prop("disabled", true);
        $("#regiappbundle").prop("disabled", true);
        $("#form-file").prop("disabled", true);
        $("#delactivity").prop("disabled", true);
        $("#regiactivity").prop("disabled", true);
    }

    var urn = "dXJuOmFkc2sub2JqZWN0czpvcy5vYmplY3Q6ZnBkLWphcGFuLWF2cGc1ZmdyaDVxYnBvOGhrMTVsc3p6ZzhkcmZrbnJvdXdtd2QwcDhsbXNlMzJwN29qb3h6NXB6b251dGktN2ctZGE0YS9sYW5kaW5nLmR3Zw==";
    initializeViewer(urn);
}

// API status
function apiStatus(api_name) {

    switch (api_name) {
        case 'OA':
            $("#OA").css('visibility', 'visible');
            $("#DA").css('visibility', 'hidden');
            $("#MD").css('visibility', 'hidden');
            $("#DM").css('visibility', 'hidden');
            $("#VR").css('visibility', 'hidden');
            break;

        case 'DA':
            $("#OA").css('visibility', 'hidden');
            $("#DA").css('visibility', 'visible');
            $("#MD").css('visibility', 'hidden');
            $("#DM").css('visibility', 'hidden');
            $("#VR").css('visibility', 'hidden');
            break;

        case 'MD':
            $("#OA").css('visibility', 'hidden');
            $("#DA").css('visibility', 'hidden');
            $("#MD").css('visibility', 'visible');
            $("#DM").css('visibility', 'hidden');
            $("#VR").css('visibility', 'hidden');
            break;

        case 'DM':
            $("#OA").css('visibility', 'hidden');
            $("#DA").css('visibility', 'hidden');
            $("#MD").css('visibility', 'hidden');
            $("#DM").css('visibility', 'visible');
            $("#VR").css('visibility', 'hidden');
            break;

        case 'VR':
        default:
            $("#OA").css('visibility', 'hidden');
            $("#DA").css('visibility', 'hidden');
            $("#MD").css('visibility', 'hidden');
            $("#DM").css('visibility', 'hidden');
            $("#VR").css('visibility', 'visible');
            break;
    }
}

// Get credentials
function getCredentials(callback) {
    fetch('/api/credentials').then(res => {
        res.json().then(data => {
            callback(data.access_token, data.expires_in);
        });
    });
    apiStatus("OA");
}
