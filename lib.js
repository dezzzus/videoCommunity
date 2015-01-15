module.exports = {
    ensureAuthenticated: function (req, res, next) {
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

    }



};