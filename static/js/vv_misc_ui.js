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

vvzzt.ui.tourSwitchRegistration = function(elemSelector, typeOfPage) {
    $(elemSelector).change(function () {
        var newTour = this.options[this.selectedIndex].value;
//        vvzzt.pubnub.pubnubPublish({
//            type : 'redirect_tour',
//            tour : newTour,
//            leadId : vvzzt.chat ? vvzzt.chat.leadId : null
//        })
        // Wait to allow pubnub call to succeed.
        setTimeout("window.location.href = /" + typeOfPage + "/" + newTour + "';", 1500);
    });
    
    // Remote control for tour change:
//    vvzzt.pubnub.pubnubSubscribe(function (m) {
//        if (vvzzt.chat && vvzzt.chat.leadId && vvzzt.chat.leadId != m.leadId) {
//            return; // does not apply to us
//        }
//        if (m.type === 'redirect_tour') {
//            var hasLead = vvzzt.chat && vvzzt.chat.leadId && vvzzt.chat.leadId != "null";
//            var leadArg = hasLead ? "?lead=" + vvzzt.chat.leadId : "";
//            window.location.href = "/" + typeOfPage + "/" + m.tour + leadArg;
//        }
//    });
};

/**
 * Probably belongs somewhere else:
*/

(function ($) {
    $.each(['show', 'hide'], function (i, ev) {
      var el = $.fn[ev];
      $.fn[ev] = function () {
        this.trigger(ev);
        return el.apply(this, arguments);
      };
    });
  })(jQuery);