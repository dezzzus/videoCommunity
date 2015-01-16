/**
 * For now, a single place for all VV JS UI.
 * Will likely split in the future, but this makes it simpler to manage now
 * (better than embedded in html, here it can be jshinted).
 */

/**
 * Global namespace for easier access
 */
var vvzzt = vvzzt || {};
vvzzt.chat = vvzzt.chat || {};

vvzzt.chat.textChatRegistration = function(outputSelector, inputSelector, isPresenting, agentName, agentId, 
    propertyID) {
    var coutput = $(outputSelector), cinput = $(inputSelector);
    coutput.html('');
    var myName = 'me';
    var leadID = null;
    var otherName = agentName;
    if (isPresenting) {
        myName = agentName;
        otherName = 'Viewer';
    }

    var firstChatMsg = true;
    cinput.bind( 'keyup', function(e) {
        (e.keyCode || e.charCode) === 13 && function() {
            var msg = cinput.val();
            vvzzt.pubnub.pubnubPublish({
                type : 'textchat', text : msg }, 
                function() { 
                    cinput.val(''); 
            });
            if (firstChatMsg) {
                jQuery.post("/api/lead", {
                        agentID : agentId,
                        msg : msg,
                        propertyID : propertyID
                    }, 
                    function(data, textStatus, jqXHR){
                        leadID = data;
                    }
                );
            }
            else {
                jQuery.post("/api/lead/msg", {
                    leadID : leadID,
                    sender : isPresenting ? "agent" : "viewer",
                    msg : msg
                });
            }
        }();
    });
    
    vvzzt.pubnub.init();
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
