var lib = require('../lib');
var mongodb = require('mongodb');
var ObjectID = mongodb.ObjectID;

/**
 * TODO
 * Known issues:
 * - more edge case handling, mismatching ids, etc.
 * - ensure only leads' owner can touch them
 * 
 */

exports.addLeadRoutes = function (app) {
    
    app.get('/lead', lib.ensureAuthenticated, function (req, res, next) {
        var archivedToggle = req.param('archivedToggle') === "true";
        lib.safeFindOne(app.collection.agent, {'_id': ObjectID(req.user._id.toHexString())}, 
            function (agent) {
            app.collection.lead.find(
                {
                    $and : [
                             { agentID: agent._id.toHexString() },
                             // Note, archived coming back as String...
                             { archived: String(archivedToggle) }
                         ]
                }).toArray(
                function (err, leads) {
                    if (err) {
                        next(err);
                        return false;
                    }
                    
                    var propIds = [];
                    leads.forEach(function(val, idx){
                        propIds.push(ObjectID(val.property));
                    });
                    
                    app.collection.property.find(
                        {
                            '_id': { $in : propIds }
                        }
                    ).toArray(
                        function (err, props) {
                            if (!err) {
                                var propAddresses = {};
                                props.forEach(function(val, idx){
                                    propAddresses[val._id.toHexString()] = val.address;
                                });
                                
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
                                    propAddresses : propAddresses,
                                    agent: agent
                                });

                            }
                        }
                    );
                    

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
                                lead : lead,
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
    
    app.get('/lead/:leadId/archiveAction/:toggle', lib.ensureAuthenticated, function (req, res, next) {
        var toggle = req.param('toggle');
        lib.safeFindOne(app.collection.lead, {'_id': ObjectID(req.param('leadId'))}, 
            function (lead) {
                if (!lead) {
                    res.status(404).render('404');
                }
                else {
                    
                    app.collection.lead.update({_id: lead._id}, 
                        {'$set': {archived : toggle}}, function (err, updatedProp) {
                        if (err) {
                            next(err);
                        }
                        res.redirect('/lead');
                    });
                }
            }
        );
    });


};