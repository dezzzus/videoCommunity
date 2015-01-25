module.exports = {
    ensureAuthenticated: function (req, res, next) {
        req.session.returnTo = req.url;
        if (req.isAuthenticated()) {
            if (req.user && req.user.approved) {
                return next();
            }
            else {
                res.redirect('/beta_not_yet');
                return;
            }
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

    reportError: function (err) {
        // Always dump for logging:
        console.log("Error found: " + err);
        console.log("Eurrent time: " + new Date());
        console.log("Stack\n" + err.stack);

        if (process.env.OPENSHIFT_NODEJS_IP) {
            app.awsMailer.sendMail({
                from: 'noreply@virtualvizzit.com',
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
    
    fixupAgentPhotoURL: function(agent) {
        if (!agent.photoURL || agent.photoURL === '') {
            agent.photoURL = 'http://cdn.virtualvizzit.com/' + agent.photoFileId;
        }
    }

};