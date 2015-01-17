var lib = require('../lib');
var mongodb = require('mongodb');
var ObjectID = mongodb.ObjectID;

exports.addLeadRoutes = function (app) {
    
    app.get('/lead', lib.ensureAuthenticated, function (req, res, next) {
        var archivedToggle = req.param('archivedToggle') === "true";
        lib.safeFindOne(app.collection.agent, {'_id': ObjectID(req.user._id.toHexString())}, 
            function (agent) {
            app.collection.lead.find(
                {
                    'agentID': agent._id.toHexString(),
                    'archived': archivedToggle
                }).toArray(
                function (err, leads) {
                    if (err) {
                        next(err);
                        return false;
                    }
                    
                    // Need to also find properties to extract their addresses... 
                    var allLeads = leads.sort(function (a, b) {
                        return b.lastPing - a.lastPing;
                    });
                    
                    // Anything more than X sec is inactive - need to tune the X
                    var curTime = new Date();
                    var firstInactive = -1;
                    allLeads.forEach(function(val, idx){
                        if (firstInactive == -1 &&
                            curTime.getTime() - val.lastPing.getTime() > 10000) {
                            firstInactive = idx;
                        }
                    });
                    var activeLeads = [];
                    var inactiveLeads = [];
                    if (firstInactive == -1) {
                        activeLeads = allLeads;
                    }
                    else {
                        activeLeads = allLeads.slice(0, firstInactive);
                        inactiveLeads = allLeads.slice(firstInactive);
                    }
                    res.render('lead', {
                        activeLeads : activeLeads,
                        inactiveLeads : inactiveLeads,
                        archived : archivedToggle,
                        agent: agent
                    });

                }
            );
        }, next);
    });

    app.get('/lead/:leadId', lib.ensureAuthenticated, function (req, res, next) {
        lib.safeFindOne(app.collection.lead, {'_id': ObjectID(req.param('leadId'))}, 
            function (lead) {
                if (!lead) {
                    res.status(404).render('404');
                }
                else {
                    // find chat history
                    app.collection.leadMsg.find({'leadID': req.param('leadId')}).toArray(
                        function (err, msgs) {
                            chatMsgs = msgs.sort(function (a, b) {
                                return a.time - b.time;
                            });
                            
                            res.render('lead_details', {
                                chatMsgs : chatMsgs,
                                lastPing : lead.lastPing,
                                myName : req.user.name
                            });

                        }
                    );
                }
            }
        );
    });

};