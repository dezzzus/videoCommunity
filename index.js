var express = require('express');
var mongodb = require('mongodb');
var bodyParser = require('body-parser');
var MongoClient = mongodb.MongoClient;
var ObjectID = mongodb.ObjectID;

var app = express();
app.collection = {};
app.use(bodyParser.urlencoded({'extended': true}));
app.use(express.static(__dirname + '/static'));

app.set('view engine', 'ejs');

app.get('/', function (req, res) {
    res.render('index');
});

app.get('/contactus', function (req, res) {
    res.render('contactus');
});

app.get('/tour', function (req, res) {
    app.collection.tour.find({}).toArray(
        function (err, tours) {
            res.render('tour', {
                tours: tours
            });
        }
    );
});

app.post('/tour', function (req, res) {
    var videoUrl = req.body['videoUrl'];
    var newTour = {
        videoUrl: videoUrl
    };
    app.collection.tour.insert(newTour, function (err, dbTour) {
        if (err) {
            console.log('DB err' + err);
        }
    });
    res.redirect('/tour');
});

app.get('/tour/:tid', function (req, res) {
    var tid = req.param('tid');
    app.collection.tour.findOne({'_id': ObjectID(tid)}, function (err, tour) {
        res.render('tour_details', {
            tour: tour
        });
    });
});

var mongoURI = 'mongodb://vizzit123:321tizziv@proximus.modulusmongo.net:27017/i8Jypyzy';
var port = process.env.PORT || 3000;

MongoClient.connect(mongoURI, function (dbErr, db) {
    if (dbErr) throw dbErr;

    app.collection.tour = db.collection('tour');

    app.listen(port, function () {
        console.log('Vizzit app listening at port:%s', port)
    });
});

