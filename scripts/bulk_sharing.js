var mongodb = require('mongodb');
var MongoClient = mongodb.MongoClient;
var lib = require('../lib.js');

var mongoURI = 'mongodb://vizzit123:321tizziv@proximus.modulusmongo.net:27017/i8Jypyzy';

MongoClient.connect(mongoURI, function (dbErr, db) {
    if (dbErr) {
        throw dbErr;
    }
    app = {
        collection: {
            agent: db.collection('agent'),
            property: db.collection('property')
        }
    };

    function claimVideo(videoID, agentID, callback, next) {
        lib.safeFindOne(app.collection.property, {'videoID': videoID}, function (property) {
            var newProperty = {
                'playerType': property.playerType,
                'address': property.address,
                'agent': agentID,
                'note': '',
                'group': '',
                'videoID': videoID,
                'hasThumb': property.hasThumb,
                'creationDate': new Date()
            };
            app.collection.property.insert(newProperty, function (err, dbProp) {
                if (err) {
                    next(err);
                }
                else {
                    callback(videoID);
                }
            });
        }, next);
    }


    var next = function (err) {
        console.log(err);
    };

    lib.safeFindOne(app.collection.agent, {'email': 'timmy@caaboston.com'}, function (agent) {
        app.collection.property.find({'agent':'554c19f323c88e1f0010d114'}).toArray(function (err, properties) {
            for (var j = 0; j < properties.length; j++) {
                var currentVid = properties[j].videoID;
                claimVideo(currentVid, agent._id.toHexString(), function (vid) {
                    console.log('Video shared '+vid);
                }, next);
            }

        });

    }, next);
});