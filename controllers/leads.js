var lib = require('../lib');
var mongodb = require('mongodb');
var ObjectID = mongodb.ObjectID;

exports.addLeadRoutes = function (app) {
    
    app.get('/lead', lib.ensureAuthenticated, function (req, res, next) {
        lib.safeFindOne(app.collection.agent, {'_id': ObjectID(req.user._id.toHexString())}, function (agent) {
            app.collection.lead.find({'agentID': agent._id.toHexString()}).toArray(
                function (err, leads) {
                    if (err) {
                        next(err);
                        return false;
                    }
                    
                    // Need to also find properties to extract their addresses... 
                    
                    res.render('lead', {
                        leads: leads.sort(function (a, b) {
                            return b.lastPing - a.lastPing;
                        }),
                        agent: agent
                    });

                }
            );
        }, next);
    });


};