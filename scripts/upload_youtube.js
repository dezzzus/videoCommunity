/**
 * Created by anatoly on 25.04.15.
 */
var youtubedl = require('youtube-dl');
var shortid = require('shortid');
var aws_transcoder = require('../aws_transcode.js');
var mongodb = require('mongodb');
var MongoClient = mongodb.MongoClient;
var parse = require('csv-parse');
var fs = require('fs');


var mongoURI = 'mongodb://vizzit123:321tizziv@proximus.modulusmongo.net:27017/i8Jypyzy';
var app = {};
app.collection = {};

app.AWS = require('aws-sdk');
app.AWS.config.update({
    accessKeyId: 'AKIAJZUHGBIVMAN6BKSA',
    secretAccessKey: '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',
    region: 'us-east-1'
});
app.s3Stream = require('s3-upload-stream')(new app.AWS.S3());

app.transcoder = aws_transcoder.getTranscoderFunctions(app);

function uploadYouTube(youTubeLink, address, agent, beds, area) {
    var video = youtubedl(youTubeLink);

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
        landlord: '',
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
        app.transcoder.transcode(property.videoID,
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
}

function timedOutUpload(youTubeLink, address, beds, area, timeout){
    setTimeout(function(){
        uploadYouTube(youTubeLink, address, '549b7d49ec6da9a6da7f2baa', beds, area);
    }, timeout);
}

MongoClient.connect(mongoURI, function (dbErr, db) {
    if (dbErr) {
        throw dbErr;
    }

    app.collection.property = db.collection('property');
    var file = fs.readFileSync(process.argv[2], "utf8");

    parse(file, function (err, output) {
        for (var i = 0; i < output.length; i++) {
            var cvs_entry = output[i];
            console.log('Start uploading: '+cvs_entry[0]);
            timedOutUpload(cvs_entry[3], cvs_entry[0], cvs_entry[2], cvs_entry[1],i*60000);
        }
    });
});

