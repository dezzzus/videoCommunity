var mongodb = require('mongodb');
var MongoClient = mongodb.MongoClient;


var mongoURI = 'mongodb://vizzit123:321tizziv@proximus.modulusmongo.net:27017/i8Jypyzy';

MongoClient.connect(mongoURI, function (dbErr, db) {
    if (dbErr) {
        throw dbErr;
    }

    agents = db.collection('agent');

    agents.find().toArray(function (err, agentsArr) {
        for (var i = 0; i < agentsArr.length; i++) {
            agents.update(
                {'_id': agentsArr[i]['_id']},
                {'$set': {'email': agentsArr[i]['email'].toLowerCase()}},
                function (err, result) {
                    console.log('mail updated!');
                }
            );

        }
    });


});
