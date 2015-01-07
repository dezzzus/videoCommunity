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

vvzzt.ui.tourSwitchRegistration = function(elemSelector) {
    $(elemSelector).change(function () {
        var newTour = this.options[this.selectedIndex].value;
        vvzzt.pubnub.pubnubPublish({
            type : 'redirect_tour',
            tour : newTour 
        });
        // Wait to allow pubnub call to succeed.
        setTimeout("window.location.href = '/tour/" + newTour + "';", 1500);
    });
    
    // Remote control for tour change:
    vvzzt.pubnub.pubnubSubscribe(function (m) {
        if (m.type === 'redirect_tour') {
            window.location.href = "/tour/" + m.tour;
        }
    });
};

vvzzt.ui.textChatRegistration = function(outputSelector, inputSelector, isPresenting, agentName) {
    var coutput = $(outputSelector), cinput = $(inputSelector);
    coutput.html('');
    var myName = 'me';
    var otherName = agentName;
    if (isPresenting) {
        myName = agentName;
        otherName = 'Viewer';
    }

    cinput.bind( 'keyup', function(e) {
        (e.keyCode || e.charCode) === 13 && vvzzt.pubnub.pubnubPublish({
               type : 'textchat', text : cinput.val() }, 
               function() { 
                   cinput.val(''); 
               });
        });
    
    var firstChatMsg = true;
    vvzzt.pubnub.pubnubSubscribe(function (m, isFromMyself) {
        if (m.type === 'textchat') {
            var prev = coutput.html();
            if (!firstChatMsg) {
                prev = prev + '<br>';
            } 
            else {
                coutput.show();
                firstChatMsg = false;
            }
            
            var uname = otherName;
            var nameClass = "chat_other_username";
            var msgClass = "chat_other_user_content";
            if (isFromMyself) {
                uname = myName;
                nameClass = "chat_my_username";
                msgClass = "chat_my_content";
            }
            coutput.html( prev + '<div><div class="'+nameClass+'">'+uname+':&nbsp;</div>'+ 
                '<div class="'+msgClass+'">' + (''+m.text).replace( /[<>]/g, '' ) + '</div></div>' );
            coutput.scrollTop(coutput.height());
        }
    });


};
