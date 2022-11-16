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
var CLIENT_ID = 'zf99QjeGGbOwyEqzfUBMzskO1zag2fPP',
    CLIENT_SECRET = 'gemClGo7m8oOetXJ',
    BUCKET_KEY = 'das-japan-zf99qjeggbowyeqzfubmzsko1zag2fpp-transient',
    DA4A_UQ_ID = 'PDFPlot',
    DA4A_FQ_ID = 'zf99QjeGGbOwyEqzfUBMzskO1zag2fPP.PDFPlot+dev',
    DA4A_ENGINE = 'Autodesk.AutoCAD+24_1',
    SOURCE_DWG = 'source.dwg',
    RESULT_PDF = 'result.pdf',
    VIEWABLE_PDF = '',
    VIEWABLE_URN = '',
    FILE_PATH = '',
    FILE_NAME = '';

var ForgeSDK = require('forge-apis');
var fs = require('fs');
var express = require('express');

var app = express();
var bodyParser = require('body-parser');
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

var router = express.Router();

const querystring = require('querystring');
const parse = querystring.parse;

var multer = require('multer');
var request = require('request');

var FormData = require('form-data');

var upload = multer({ dest: "./uploads/" });

require('date-utils');

var bucketsApi = new ForgeSDK.BucketsApi(), // Buckets Client
    objectsApi = new ForgeSDK.ObjectsApi(), // Objects Client
    derivativesApi = new ForgeSDK.DerivativesApi(); // Derivatives Client
    itemsApi = new ForgeSDK.ItemsApi(); // Items Client

// Initialize the 2-legged oauth2 client
var oAuth2TwoLegged = new ForgeSDK.AuthClientTwoLegged(CLIENT_ID, CLIENT_SECRET,
    ['code:all', 'data:create', 'data:write', 'data:read', 'bucket:read', 'bucket:update', 'bucket:create'], true);

/**
 * General error handling method
 * @param err
 */
function defaultHandleError(err) {
    console.error('\x1b[31m Error:', err, '\x1b[0m');
}

// Gets the details of a bucket specified by a bucketKey.
// Uses the oAuth2TwoLegged object that you retrieved previously.
// @param bucketKey
var getBucketDetails = function (bucketKey) {
    return bucketsApi.getBucketDetails(bucketKey, oAuth2TwoLegged, oAuth2TwoLegged.getCredentials());
};

// Create a new bucket.
// Uses the oAuth2TwoLegged object that you retrieved previously.
// @param bucketKey
var createBucket = function (bucketKey) {
    var createBucketJson = { 'bucketKey': bucketKey, 'policyKey': 'temporary' };
    return bucketsApi.createBucket(createBucketJson, {}, oAuth2TwoLegged, oAuth2TwoLegged.getCredentials());
};

// This function first makes an API call to getBucketDetails endpoint with the provided bucketKey.
// If the bucket doesn't exist - it makes another call to createBucket endpoint.
// @param bucketKey
// @returns {Promise - details of the bucket in Forge}
var createBucketIfNotExist = function (bucketKey) {
    return new Promise(function (resolve, reject) {
        getBucketDetails(bucketKey).then(function (resp) {
            resolve(resp);
        },
            function (err) {
                if (err.statusCode === 404) {
                    createBucket(bucketKey).then(function (res) {
                        resolve(res);
                    },
                        function (err) {
                            reject(err);
                        });
                }
                else {
                    reject(err);
                }
            });
    });
};

// Upload a File to previously created bucket.
// Uses the oAuth2TwoLegged object that you retrieved previously.
// @param bucketKey
// @param filePath
// @param fileName
// @returns {Promise}
var uploadFile = function (bucketKey, filePath, fileName) {
    return new Promise(function (resolve, reject) {
        fs.readFile(filePath, function (err, data) {
            if (err) {
                reject(err);
            }
            else {
                //* obsolute
                //objectsApi.uploadObject(bucketKey, fileName, data.length, data, {}, oAuth2TwoLegged, oAuth2TwoLegged.getCredentials()).then(
                objectsApi.uploadResources(bucketKey, [{ objectKey: fileName, data }], { useAcceleration: true }, oAuth2TwoLegged, oAuth2TwoLegged.getCredentials()).then(
                    function (res) {
                        resolve(res);
                    }, function (err) {
                        reject(err);
                    }
                );
            }
        });

    });
};

// Delete the file uploaded by the application.
// Uses the oAuth2TwoLegged object that you retrieved previously.
// @param bucketKey
// @param fileName
var deleteFile = function (bucketKey, fileName) {
    //console.log("**** Deleting a file from bucket:" + bucketKey + ", filename:" + fileName);
    return objectsApi.deleteObject(bucketKey, fileName, oAuth2TwoLegged, oAuth2TwoLegged.getCredentials());
};

// Download the file by the application.
// Uses the oAuth2TwoLegged object that you retrieved previously.
// @param bucketKey
// @param fileName
var downloadFile = function (bucketKey, fileName) {
    console.log("**** Downloading a file from bucket:" + bucketKey + ", filename:" + fileName);
    return new Promise(function (resolve, reject) {
        //objectsApi.getObject(bucketKey, fileName).then(
        objectsApi.downloadResources(bucketKey, [{ objectKey: fileName, responseType: 'arraybuffer' } ], { useCdn: true, minutesExpiration: 15 }, oAuth2TwoLegged, oAuth2TwoLegged.getCredentials()).then(
            function (res) {
                resolve(res);
            }, function (err) {
                reject(err);
            }
        );
    });
};

// Get the buckets owned by an application.
// Uses the oAuth2TwoLegged object that you retrieved previously.
var getBuckets = function () {
    return bucketsApi.getBuckets({}, oAuth2TwoLegged, oAuth2TwoLegged.getCredentials());
};

// Delete Bucket(hidden endpoint)
var deleteBucket = function (bucketKey) {
    uri = "https://developer.api.autodesk.com/oss/v2/buckets/" + bucketKey;
    request.delete({
        url: uri,
        headers: {
            'content-type': 'application/json',
            'authorization': 'Bearer ' + oAuth2TwoLegged.getCredentials().access_token
        }
    }, function (error, res, body) {
        var data = JSON.stringify(res);
        if (JSON.parse(data).statusCode === 200) {
            console.log("**** Delete Bucket succeeded :" + bucketKey);
        } else {
            console.log("Error : " + JSON.parse(body).detail);
        }
    });
};

// Encode file address to urn
function base64encode(str) {
    return new Buffer(str).toString('base64');
}

// Translate seed file to SVF file
var translateFile = function (encodedURN) {
    var postJob =
        {
            input: {
                urn: encodedURN
            },
            output: {
                formats: [
                    {
                        type: "svf",
                        views: ["2d", "3d"]
                    }
                ]
            }
        };

    return new Promise(function (resolve, reject) {
        derivativesApi.translate(postJob, { xAdsForce: "true" }, oAuth2TwoLegged, oAuth2TwoLegged.getCredentials()).then(
            function (res) {
                resolve(res);
            }, function (err) {
                reject(err);
            }
        );
    });
};

// Copy a file.
var copyFile = function (orgname, destname) {
    return new Promise(function (resolve, reject) {
        objectsApi.copyTo(BUCKET_KEY, orgname, destname, oAuth2TwoLegged, oAuth2TwoLegged.getCredentials()).then(
            function (res) {
                resolve(res);
            }, function (err) {
                reject(err);
            }
        );
    });
};

// Create signed URL for upload/download
var createSignedURL = function (name, access) {
    return new Promise(function (resolve, reject) {
        var opts = {
            'minutesExpiration': 15,
            'useCdn': true
        };
        objectsApi.createSignedResource(BUCKET_KEY, name, opts, { access: access }, oAuth2TwoLegged, oAuth2TwoLegged.getCredentials()).then(
            function (res) {
                resolve(res);
            }, function (err) {
                reject(err);
            }
        );
    });
};

// Delete the manifst file.
var deleteManifestFile = function (encodedURN) {
    return new Promise(function (resolve, reject) {
        derivativesApi.deleteManifest(encodedURN, oAuth2TwoLegged, oAuth2TwoLegged.getCredentials()).then(
            function (res) {
                var myjson = JSON.stringify({ 'delete': res.body });
                resolve(myjson);
            }, function (err) {
                reject(err);
            }
        );
    });
};    

// Check the manifst file to get translation status.
var manifestFile = function (encodedURN) {
    return new Promise(function (resolve, reject) {
        derivativesApi.getManifest(encodedURN, {}, oAuth2TwoLegged, oAuth2TwoLegged.getCredentials()).then(
            function (res) {
                var myjson = JSON.stringify({ 'status': res.body.status, 'progress': res.body.progress });
                resolve(myjson);
            }, function (err) {
                reject(err);
            }
        );
    });
};    

// Get access token
router.get('/credentials', async function (req, res) {
    // Initialize the 2-legged oauth2 client
    try {
        const token = await getToken();
        res.json({
            access_token: token.access_token,
            expires_in: token.expires_in
        });
    } catch (err) {
        next(err);
    }
});

// Get Credentials
let cache = {};
async function getToken() {
    const key = 'forge_credentials';
    if (cache[key]) {
        return cache[key];
    }
    let credentials = await oAuth2TwoLegged.authenticate();
    console.log("**** Got Credentials", credentials);
    cache[key] = credentials;
    setTimeout(() => { delete cache[key]; }, credentials.expires_in * 1000);
    return credentials;
}

// Start Design Automation process
router.post("/process", function (req, res) {

    console.log("**** Design Automation API process started");

    oAuth2TwoLegged.authenticate().then(function (credentials) {

        createBucketIfNotExist(BUCKET_KEY).then(function (createBucketRes) {

            createSignedURL(SOURCE_DWG, 'read').then(function (signedURLRes) {
                var signedURLforInput = JSON.parse(JSON.stringify(signedURLRes.body)).signedUrl;
                console.log("Signed URL for InputDWG was created:\n" + signedURLforInput);

                createSignedURL(RESULT_PDF, 'write').then(function (signedURLRes) {
                    var signedURLforOutput = JSON.parse(JSON.stringify(signedURLRes.body)).signedUrl;
                    console.log("Signed URL for OutputPDF was created:\n" + signedURLforOutput);

                    // Create WorkItem
                    var payload =
                    {
                        //"activityId": DA4A_FQ_ID,
                        "activityId": "AutoCAD.PlotToPDF+prod",
                        "arguments": {
                            //"DWGInput": {
                            "HostDwg": {
                                "url": signedURLforInput,
                                "headers": {
                                    "Authorization": "Bearer " + credentials.access_token,
                                    "Content-type": "application/octet-stream"
                                },
                                "verb": "get"
                            }, 
                            //"PDFOutput": {
                            "Result": {
                                "url": signedURLforOutput,
                                "headers": {
                                    "Authorization": "Bearer " + credentials.access_token,
                                    "Content-Type": "application/octet-stream"
                                },
                                "verb": 'put'
                            },
                            "onComplete": {
                                "verb": "post",
                                "url": "http://forge-da4a-pdf-output.herokuapp.com/api/oncomplete"
                            }
                        }
                    };

                    var uri = "https://developer.api.autodesk.com/da/us-east/v3/workitems";
                    request.post({
                        url: uri,
                        headers: {
                            'content-type': 'application/json',
                            'authorization': 'Bearer ' + credentials.access_token
                        },
                        body: JSON.stringify(payload)
                    }, function (error, workitemres, body) {
                        var data = JSON.stringify(workitemres);
                        if (JSON.parse(data).statusCode === 200) {
                            var id = JSON.parse(JSON.parse(data).body).id;
                            console.log(" WorkItem was created >> WorkItem Id :" + id);
                            console.log(" Process status :" + JSON.parse(JSON.parse(data).body).status);
                            data = id;
                        } else {
                            console.log("Error : " + error);
                        }
                        res.send(data);
                    });
                        
                }, defaultHandleError);

            }, defaultHandleError);

        }, defaultHandleError);

    }, defaultHandleError);

});

// Download the created PDF by signed URL
router.get("/download", function (req, res) {

    oAuth2TwoLegged.authenticate().then(function (credentials) {
        downloadFile(BUCKET_KEY, RESULT_PDF).then(function (downloadRes) {
            console.log(downloadRes);
            //var signedURL = JSON.stringify(signedURLRes.body); // obsolete way
            var signedURL = JSON.stringify(downloadRes[0]);
            console.log("**** Download was started = " + signedURL);
            res.end(signedURL);
        }, defaultHandleError);
        /*
        createSignedURL(RESULT_PDF, 'read').then(function (signedURLRes) {
            var signedURL = JSON.stringify(signedURLRes.body);
            console.log("**** Download was started = " + signedURL);
            res.end(signedURL);
        }, defaultHandleError);
        */
    }, defaultHandleError);

});

// Get process status on Design Automation API
router.get('/process-status/:id', function (req, res) {

    var workitemid = JSON.parse(JSON.stringify(req.params)).id;

    oAuth2TwoLegged.authenticate().then(function (credentials) {

        var uri = "https://developer.api.autodesk.com/da/us-east/v3/workitems/" + workitemid;
        request.get({
            url: uri,
            headers: {
                'authorization': 'Bearer ' + credentials.access_token
            }
        }, function (error, workitemres, body) {
            var data = JSON.stringify(workitemres);
            if (JSON.parse(data).statusCode === 200) {
                data = JSON.parse(data).body;
                console.log(" Process status :" + JSON.parse(data).status);
            } else {
                console.log("Error : " + error);
            }
            res.send(data);
        });


    }, defaultHandleError);

});

// Start Translation
router.get('/start-translation', function (req, res) {

    oAuth2TwoLegged.authenticate().then(function (credentials) {

            //var dt = new Date();
            //var formatted = dt.toFormat("YYYY-MM-DD-HH24-MI-SS");
            VIEWABLE_PDF = /*formatted + "-" + */RESULT_PDF;
            //copyFile(RESULT_PDF, VIEWABLE_PDF).then(function (copytoRes) {
                console.log("VIEWABLE_PDF : " + VIEWABLE_PDF );
                //var body = JSON.parse(JSON.stringify(copytoRes)).body;
                //VIEWABLE_URN = base64encode(JSON.parse(JSON.stringify(body)).objectId);
                //VIEWABLE_URN = base64encode("urn:adsk.objects:os.object:das-japan-zf99qjeggbowyeqzfubmzsko1zag2fpp-transient/result.pdf");
                VIEWABLE_URN = base64encode("urn:adsk.objects:os.object:" + BUCKET_KEY + "/" + RESULT_PDF);
                console.log(" " + VIEWABLE_PDF + " was copied for viewable creation");
                var urn = VIEWABLE_URN;
                console.log("VIEWABLE_URN : " + VIEWABLE_URN);
                translateFile(urn).then(function (translateRes) {

                    console.log("**** Tranlation started :" + urn);
                    var myjson = JSON.stringify({ 'urn': urn });
                    res.end(myjson);

                }, defaultHandleError);


            //}, defaultHandleError);

    }, defaultHandleError);

});

// Get Translation status
router.get('/translation-status', function (req, res) {

    var urn = VIEWABLE_URN;

    oAuth2TwoLegged.authenticate().then(function (credentials) {

        manifestFile(urn).then(function (manifestRes) {

            console.log(" Translation status :" + manifestRes);

            var progress = JSON.parse(manifestRes).progress;
            if (progress === 'complete') {
                /*
                deleteFile(BUCKET_KEY, VIEWABLE_PDF).then(function (deleteRes) {
                    console.log(" " + VIEWABLE_PDF + " for viewable creation was deleted");
                }, defaultHandleError);
                */
            }
            res.end(manifestRes);

        }, defaultHandleError);

    }, defaultHandleError);

});

// Upload Source drawing
router.post("/drawing-upload", upload.single("file"), function (req, res) {

    FILE_NAME = req.file.originalname;
    FILE_PATH = req.file.path;
    SOURCE_DWG = FILE_NAME,

    oAuth2TwoLegged.authenticate().then(function (credentials) {

        console.log("**** Upload Source drawing");

        createBucketIfNotExist(BUCKET_KEY).then(function (createBucketRes) {

            getBuckets().then(function (getBucketsRes) {
                var bucketsArray = getBucketsRes.body.items;
                bucketsArray.map(function (currentBucket) {
                    //console.log(currentBucket.bucketKey);
                });
            }, function (err) {
                console.error(err);
            });

            console.log("**** Uploading started :" + FILE_NAME);

            uploadFile(BUCKET_KEY, FILE_PATH, FILE_NAME).then(function (uploadRes) {

                //var objectId = uploadRes.body.objectId; // obsolute endpoint in uploadFile()
                var objectId = uploadRes[0].completed.objectId;
                var urn = base64encode(objectId);
                console.log("**** Source drawing file was uploaded :" + urn);
                res.sendStatus(200);

            }, defaultHandleError);

        }, defaultHandleError);

    }, defaultHandleError);

});

// Delete Activity
router.get("/delete-activity", function (req, res) {

    oAuth2TwoLegged.authenticate().then(function (credentials) {

        console.log("**** Check existing Activity");

        var uri = "https://developer.api.autodesk.com/da/us-east/v3/activities";
        request.get({
            url: uri,
            headers: {
                'authorization': 'Bearer ' + credentials.access_token
            }
        }, function (error, activityres, body) {

            var data = JSON.stringify(activityres);
            if (JSON.parse(data).statusCode === 200) {
                var list = JSON.parse(JSON.parse(data).body).data;
                for (let i = 0; i < list.length; i++) {
                    console.log(" " + list[i]);
                    if (list[i] === DA4A_FQ_ID) {
                        console.log(" " + DA4A_FQ_ID + " Activity is already there");

                        var uri = "https://developer.api.autodesk.com/da/us-east/v3/activities/" + DA4A_UQ_ID;
                        request.delete({
                            url: uri,
                            headers: {
                                'authorization': 'Bearer ' + credentials.access_token
                            }
                        }, function (error, activitydelres, body) {
                            if (JSON.parse(JSON.stringify(activitydelres)).statusCode === 204) {
                                console.log(" " + DA4A_FQ_ID + " Activity was deleted");
                            } else {
                                console.log("Error : " + error);
                                res.sendStatus(JSON.parse(JSON.stringify(activitydelres)).statusCode);
                            }
                        });

                    }
                } 
            } else {
                console.log("Error : " + error);
                res.sendStatus(JSON.parse(data).statusCode);
            }
        });

    }, defaultHandleError);
    res.sendStatus(200);

});

// (Re)Register Activity
router.get("/register-activity", function (req, res) {

    oAuth2TwoLegged.authenticate().then(function (credentials) {

        console.log("**** Create Activity");

        // Create Activity
        var payload =
        {
            "id": DA4A_UQ_ID,
            "commandLine": ['$(engine.path)\\accoreconsole.exe /i "$(args[DWGInput].path)" /s "$(settings[script].path)"'],
            "parameters": {
                "DWGInput": {
                    "zip": false,
                    "ondemand": false,
                    "verb": "get",
                    "description": "Source drawing",
                    "required": true
                },
                "PDFOutput": {
                    "zip": false,
                    "ondemand": false,
                    "verb": "put",
                    "description": "putput PDF drawing",
                    "required": true,
                    "localName": "result.pdf"
                }
            },
            "settings": {
                "script": {
                    "value": "_tilemode 0 -export _pdf _all result.pdf\n"
                }
            },
            "engine": DA4A_ENGINE,
            "appbundles": [],
            "description": "PDF output"
        };

        var uri = "https://developer.api.autodesk.com/da/us-east/v3/activities";
        request.post({
            url: uri,
            headers: {
                'content-type': 'application/json',
                'authorization': 'Bearer ' + credentials.access_token
            },
            body: JSON.stringify(payload)
        }, function (error, activityres, body) {
            var data = JSON.stringify(activityres);
            if (JSON.parse(data).statusCode === 200) {

                console.log(" Activity was created");

                // Create Alias
                var payload =
                {
                    "version": 1,
                    "id": "dev"
                };

                var uri = "https://developer.api.autodesk.com/da/us-east/v3/activities/" + DA4A_UQ_ID + "/aliases";
                request.post({
                    url: uri,
                    headers: {
                        'content-type': 'application/json',
                        'authorization': 'Bearer ' + credentials.access_token
                    },
                    body: JSON.stringify(payload)
                }, function (error, aliasres, body) {
                    data = JSON.stringify(aliasres);
                    if (JSON.parse(data).statusCode === 200) {
                        console.log(" Activity's Alias was created");
                        res.sendStatus(200);
                    } else {
                        console.log("Error : " + error);
                        res.sendStatus(JSON.parse(data).statusCode);
                    }
                });

            } else {
                console.log("Error : " + error);
                res.sendStatus(JSON.parse(data).statusCode);
            }

        });

    }, defaultHandleError);

});

// onComplete callback
router.post("/oncomplete", function (req, res) {
// to BIM 360 Docs
/*
    console.log("**** onComplete callback was invoked !!");
    oAuth2TwoLegged.authenticate().then(function (credentials) {

        var data = JSON.stringify(credentials);
        var token = JSON.parse(data).access_token;

        var payload =
        {
            "jsonapi": {
                "version": "1.0"
            },
            "data": {
                "type": "objects",
                "attributes": {
                    "name": "result.pdf"
                },
                "relationships": {
                    "target": {
                        "data": {
                            "type": "folders",
                            "id": "urn:adsk.wipprod:fs.folder:co.poo-Zp6mRe-eqjsyQVeXeQ"
                        }
                    }
                }
            }
        };

        var projectId = 'b.dd31c918-027a-4a29-9946-ec292facdf7a'; // DA4A folder

        var uri = "https://developer.api.autodesk.com/data/v1/projects/" + projectId + "/storage";
        request.post({
            url: uri,
            headers: {
                'content-type': 'application/vnd.api+json',
                'authorization': 'Bearer ' + credentials.access_token
            },
            body: JSON.stringify(payload)
        }, function (error, createstorageres, body) {
            var data = JSON.stringify(createstorageres);
            if (JSON.parse(data).statusCode === 201) {
                console.log(body);
            } else {
                console.log("Error : " + error);
            }
        });


    }, defaultHandleError);
*/
});

module.exports = router;
