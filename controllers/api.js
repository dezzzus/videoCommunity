/**
 * The API controller is UI-less, RESTful style API
 * For now, used for recording interactions with leads.
 * Intended to be called from video pages, and possibly from agent's dashboard page.  
 * Not secure, not for CORS or other external usage!
 */

// TODO: validate req.body everywhere
// TODO: error handling when things can't be found
// TODO: protect with a unique token issued to a page (sign requests in the future)

var lib = require('../lib');
var mongodb = require('mongodb');
var ObjectID = mongodb.ObjectID;
var LeadStatus = { chatting : 0, getBackToMe : 1, stale : 2, archived : 3 };
var notifyMailer = null;

var send500APIError = function(err, res) {
    if (err) {
        res.status(500).send({errorMessage : "unable to prcess request"});
        return true;
    }
    return false;
};

var recordPing = function(app, leadId, res) {
    app.collection.lead.update({_id: ObjectID(leadId)}, {'$set': {"lastPing" : new Date()}}, 
        function (err, updatedProp) {
            send500APIError(err, res);
        }
    );  
};

/**
 * This one probably does not belong here.
 * TODO: move to the proper module
 */
var notifyAgentAboutLead = function(req, app, agentID, propID, leadID, firstMsg) {
    app.collection.agent.findOne({_id: ObjectID(agentID)}, function (err, agent) {
        if (agent) {
            if (!err && notifyMailer) {
                var msgText = "To view the lead, please log in from your computer's browser, and go to 'My Leads' page.<br>"
                    + 'If you are reading this on your computer, you can follow '
                    + '<a href = "http://' + req.headers.host + '/video_lead/' + propID + '?lead=' + leadID + '">'
                    + 'this link'
                    + '</a>'
                    + ' directly to start chatting.';
                notifyMailer.sendMail({
                    from: 'info@virtualvizzit.com',
                    to: agent.email,
                    subject: 'You have a new sales lead (Chat message: ' + firstMsg + ')',
                    html: msgText
                }, function (err, info) {
                    if (err) {
                        // log it?
                    }
                });
            }
        }
    });  
};



var addLeadMsg = function(app, leadId, res, msg, sender) {
    app.collection.leadMsg.insert(
        {
            leadID : leadId,
            sender : sender,
            msg : msg,
            time : new Date()
        },
        function (err, dbProp){
            send500APIError(err, res);
        }
    );
};

exports.addAPIRoutes = function (app, mailer) {
    notifyMailer = mailer;
    app.post('/api/lead', function (req, res, next) {
        app.collection.lead.insert(
            {
                agentID : req.body.agentID,
                status : LeadStatus.chatting,
                property: req.body.propertyID,
                lastPing : new Date(),
                archived : String(false) // TODO: convert this to boolean once confusion in query sorted out
            },
            function (err, dbProp){
                if (!send500APIError(err, res)) {
                    var leadID = dbProp[0]._id.toHexString();
                    
                    // First message is always from viewer
                    addLeadMsg(app, dbProp[0]._id.toHexString(), res, req.body.msg, "viewer");
                    
                    notifyAgentAboutLead(req, app, req.body.agentID, req.body.propertyID, leadID, req.body.msg || "");
                    
                    res.send(leadID);
                }
            }
        );
    });
    
    /**
     * Ping to indicate lead is still active
     */
    app.put('/api/lead/:leadId/ping', function (req, res, next) {
        recordPing(app, req.param('leadId'), res);
    });
    
    /**
     * Record new chat message
     */
    app.post('/api/lead/msg', function (req, res, next) {
        addLeadMsg(app, req.body.leadID, res, req.body.msg, req.body.sender);
        app.collection.lead.update({_id: ObjectID(req.param('leadId'))}, {'$set': {"lastPing" : new Date()}}, 
            function (err, updatedProp) {
                if(!send500APIError(err, res)) {
                    recordPing(app, req.body.leadID, res);
                }
            }
        );
    });
    
    /**
     * Get this lead's chat history
     */
    app.get('/api/lead/msg/:leadId', function (req, res, next) {
        app.collection.leadMsg.find({'leadID': req.param('leadId')}).toArray(
            function (err, msgs) {
                if (!send500APIError(err, res)) {
                    res.send(msgs.sort(function (a, b) {
                        return a.time - b.time;
                    }));
                }
            }
        );
    });


};