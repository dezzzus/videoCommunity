/**
 * The API controller is UI-less, RESTful style API
 * For now, used for recording interactions with leads.
 * Intended to be called from video pages, and possibly from agent's dashboard page.  
 * Not secure, not for CORS or other external usage!
 */
var lib = require('../lib');
var mongodb = require('mongodb');
var ObjectID = mongodb.ObjectID;
var LeadStatus = { chatting : 0, getBackToMe : 1, stale : 2, archived : 3 };

var send500APIError = function(err, res) {
    if (err) {
        res.status(500).send({errorMessage : "unable to prcess request"});
        return true;
    }
    return false;
};

exports.addAPIRoutes = function (app) {

    app.post('/api/lead', function (req, res, next) {
        // TODO: validate req.body
        // TODO: protect with a unique token issued to a page (sign requests in the future)
        app.collection.lead.insert(
            {
                agentID : ObjectID(req.body.agentId),
                status : LeadStatus.chatting,
                lastPing : new Date()
            },
            function (err, dbProp){
                if (!send500APIError(err, res)) {
                    res.send(dbProp[0]._id.toHexString());
                }
            }
        );
    });
    
    app.put('/api/lead/:leadId/ping', function (req, res, next) {
        // TODO: validate req.body
        // TODO: protect with a unique token issued to a page (sign requests in the future)
        app.collection.lead.update({_id: ObjectID(req.param('leadId'))}, {'$set': {"lastPing" : new Date()}}, 
            function (err, updatedProp) {
                send500APIError(err, res);
            }
        );
    });

    app.post('/api/lead/msg', function (req, res, next) {
        // TODO: validate req.body inputs!
        // TODO: protect with a unique token issued to a page (sign requests in the future)
        app.collection.leadMsg.insert(
            {
                leadID : ObjectID(req.body.leadId),
                sender : req.body.sender,
                msg : req.body.msg,
                time : new Date()
            },
            function (err, dbProp){
                send500APIError(err, res);
            }
        );
    });
};