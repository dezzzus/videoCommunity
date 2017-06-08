/**
 * Created by anatoly on 25.04.15.
 */
var youtubedl = require('./lib/youtube-dl.js');
var shortid = require('shortid');
var aws_transcoder = require('../aws_transcode.js');
var mongodb = require('mongodb');
var MongoClient = mongodb.MongoClient;
var parse = require('csv-parse');
var fs = require('fs');
var request = require('request');


var mongoURI = 'mongodb://admin:66pM9A398qY9UdxL@cluster0-shard-00-00-tmrfr.mongodb.net:27017,cluster0-shard-00-01-tmrfr.mongodb.net:27017,cluster0-shard-00-02-tmrfr.mongodb.net:27017/tour?ssl=true&replicaSet=Cluster0-shard-0&authSource=admin';
var app = {};
app.collection = {};

app.AWS = require('aws-sdk');
app.AWS.config.update({
    accessKeyId: 'AKIAJBIBF4XSPP2F7OQQ',
    secretAccessKey: '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',
    region: 'us-east-1'
});
app.s3Stream = require('s3-upload-stream')(new app.AWS.S3());

app.transcoder = aws_transcoder.getTranscoderFunctions(app);

function uploadYouTube(youTubeLink, address, landlord, agent, beds, area) {
    try {
        request.get({url: youTubeLink}, function (err, httpResponse, body) {
            /*if (!body || body.includes('<div id="unavailable-submessage" class="submessage">\nSorry about that.')) {
                console.log ('Error occured in uploading ' + youTubeLink);
                console.log ('There is no video file.');
                return;
            }*/
            console.log (youTubeLink);
            var video = youtubedl(youTubeLink, ['--format=18'], {cwd: __dirname, maxBuffer: 1000 * 1024},
                function (err, info) {
                console.log (err);
                    if (err) throw err;
                });

            video.on('info', function (info) {
                console.log('Download started');
                console.log('filename: ' + info.filename);
                console.log('size: ' + info.size);
            });

            var property = {
                _id: shortid.generate(),
                playerType: 'flowplayer',
                address: address,
                agent: agent,
                note: '',
                group: '',
                price: '',
                beds: beds,
                baths: '',
                description: '',
                landlord: landlord,
                area: area,
                videoID: shortid.generate(),
                uploadToken: null,
                hasThumb: true, // from this point on, all videos have thumbnails
                creationDate: new Date()
            };

            var upload = app.s3Stream.upload({
                Bucket: 'vizzitupload',
                Key: property.videoID
            });

            upload.on('uploaded', function () {
                console.log('File uploaded: ' + property.videoID);
                app.transcoder.transcode(agent, property.videoID,
                    function (err) {
                        if (err) {
                            console.log('Transcoding error(' + property.videoID + '): ' + err);
                        }
                        else {
                            console.log('File transcoded: ' + property.videoID);
                        }
                    });
            });

            upload.on('error', function (err) {
                if (err) {
                    console.log('Upload error ' + err);
                }
            });

            video.pipe(upload);

            app.collection.property.insert(property, function (err, dbProp) {
                if (err) {
                    console.log('Db error ' + err);
                }
                else {
                    console.log('Property writed to db: ' + property._id);
                }
            });
        });
    } catch (e) {
        console.log('Error occured in uploading ' + youTubeLink);
    }
}

function timedOutUpload(youTubeLink, address, landlord, beds, area, timeout){
    setTimeout(function(){
        uploadYouTube(youTubeLink, address, landlord, '590a2dc759bc78001d1dc0d6' , beds, area);
    }, timeout);
}

if (process.argv[2]) {
    MongoClient.connect(mongoURI, function (dbErr, db) {
        if (dbErr) {
            throw dbErr;
        }

        app.collection.property = db.collection('property');
        app.collection.agent = db.collection('agent');
        var file = fs.readFileSync(process.argv[2], "utf8");

        parse(file, function (err, output) {
            for (var i = 0; i < output.length; i++) {
                var cvs_entry = output[i];
                console.log('Start uploading: ' + cvs_entry[0]);
                timedOutUpload(cvs_entry[4], cvs_entry[0], cvs_entry[1], cvs_entry[3], cvs_entry[2], i * 60000);
            }
        });
    });
}

module.exports = {
    upload_script: function (property_col, agent_col, upload_entries) {
        app.collection.property = property_col;
        app.collection.agent = agent_col;

        upload_entries.forEach(function(entry, idx){
            console.log('Start uploading: '+ entry.address);
            timedOutUpload(entry.youtubelink, entry.address, entry.landlord, entry.beds, entry.area, idx*60000);
        })
    }
};