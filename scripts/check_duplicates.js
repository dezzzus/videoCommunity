var mongodb = require('mongodb');
var MongoClient = mongodb.MongoClient;


var mongoURI = 'mongodb://admin:66pM9A398qY9UdxL@cluster0-shard-00-00-tmrfr.mongodb.net:27017,cluster0-shard-00-01-tmrfr.mongodb.net:27017,cluster0-shard-00-02-tmrfr.mongodb.net:27017/tour?ssl=true&replicaSet=Cluster0-shard-0&authSource=admin';

MongoClient.connect(mongoURI, function (dbErr, db) {
    if (dbErr) {
        throw dbErr;
    }

    agents = db.collection('agent');

    agents.find().toArray(function (err, agentsArr) {
        for (var i = 0; i < agentsArr.length; i++) {
            agents.find({'email': agentsArr[i]['email']}).toArray(function (secErr, checkAgents) {
                if (!secErr) {
                    if (checkAgents.length > 1) {
                        console.log('duplicates founded:' + checkAgents[0]['email']);
                    }
                    else {
                        console.log('checked:' + checkAgents[0]['email']);
                    }
                } else {
                    console.log(secErr);
                }
            });

        }
    });


});
