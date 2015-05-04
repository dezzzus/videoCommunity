var mongodb = require('mongodb');
var ObjectID = mongodb.ObjectID;

module.exports = {
    ensureAuthenticated: function (req, res, next) {
        req.session.returnTo = req.url;
        if (req.isAuthenticated()) {
            return next();
        }
        res.redirect('/login');
    },

    safeFindOne: function (collection, query, callback, next) {
        collection.findOne(query, function (err, result) {
            if (err) {
                next(err);
            }

            callback(result);
        })

    },

    processReqField: function (reqMap, obj, fieldName, updatedFields, conditionFunc, setFunc) {
        var reqValue = reqMap[fieldName];
        if (reqValue !== '' &&
            (!conditionFunc && reqValue !== obj[fieldName] ||
            conditionFunc && conditionFunc(obj, reqValue))) {
            if (!setFunc) {
                updatedFields[fieldName] = reqValue;
            }
            else {
                setFunc(updatedFields, reqValue);
            }
        }

    },

    isEmptyObject: function (obj) {
        return Object.keys(obj).length === 0;
    },

    reportError: function (err, mailer) {
        // Always dump for logging:
        console.log("Error found: " + err);
        console.log("Eurrent time: " + new Date());
        console.log("Stack\n" + err.stack);

        if (process.env.VCAP_APP_PORT) {
            mailer.sendMail({
                from: 'info@virtualvizzit.com',
                to: 'shikolay@gmail.com',
                subject: 'Virtualvizzit errors',
                text: JSON.stringify(err) + '\n' + err.stack
            }, function (email_err, info) {
                if (email_err) {
                    console.log("Can't email due to " + email_err);
                }
            });
        }
    },

    randomInt: function (low, high) {
        return Math.floor(Math.random() * (high - low) + low);
    },

    fixupAgentPhotoURL: function (agent) {
        if (!agent.photoURL || agent.photoURL === '') {
            agent.photoURL = 'http://cdn.virtualvizzit.com/' + agent.photoFileId;
        }
    },

    getRightId: function (source) {
        if (source.length == 24) {
            return ObjectID(source)
        }
        else {
            return source;
        }

    },

    compareIds: function (a, b) {
        if (a.toHexString && b.toHexString) {
            return a.equals(b);
        }
        else {
            return a == b;
        }
    }

};
