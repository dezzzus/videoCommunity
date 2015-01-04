/**
 * For now, a single place for all VV JS UI.
 * Will likely split in the future, but this makes it simpler to manage now
 * (better than embedded in html, here it can be jshinted).
 */

/**
 * Global namespace for easier access
 */
var vvzzt = vvzzt || {};
vvzzt.ui = vvzzt.ui || {};

/**
 * Simple blocking prompt for now, use lightbox in the future:
 */
vvzzt.ui.confirmThenProceed = function(msg, func) {
    if (confirm(msg)) {
        func();
    }
};

vvzzt.ui.followURLAfterConfirm = function(msg, url) {
    vvzzt.ui.confirmThenProceed(msg, function() {
        window.location.href = url;
    });
};
