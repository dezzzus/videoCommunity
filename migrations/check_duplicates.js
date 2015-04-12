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
