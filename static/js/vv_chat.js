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
vvzzt.chat.leadId = null;

vvzzt.chat.addToChatOutput = function(coutput, first, uname, msg, fromMe) {
    
    var nameClass = "chat_other_username";
    var msgClass = "chat_other_user_content";
    if (fromMe) {
        nameClass = "chat_my_username";
        msgClass = "chat_my_content";
    }

    var prev = coutput.html();
    if (!first) {
        prev = prev + '<br>';
    }
    coutput.html( prev + '<div class="oneChatMsg"><div class="'+nameClass+'">'+uname+':&nbsp;</div>'+ 
        '<div class="'+msgClass+'">' + (''+msg).replace( /[<>]/g, '' ) + '</div></div>' );
    coutput.scrollTop(coutput.height());
  
};

/**
 * Pings to be able to confirm whether this lead is still active or not.
 */
vvzzt.chat.startLeadHeartbeat = function(leadId) {
    var interval = vvzzt.chat.leadHeartbeatInterval || 10000;
    var z = setInterval(function () {
        jQuery.ajax({
            url: '/api/lead/'+leadId+'/ping',
            type: 'PUT'
          });
    }, interval);
};

vvzzt.chat.showChatAlert = function(msg, removeAfter) {
    if ($('#chat_alert').hasClass('in')) {
        return;
    }
    
    $('#chat_alert').html(msg);
    $('#chat_alert').addClass('in');
    setTimeout(function(){
        $('#chat_alert').removeClass('in');
    }, removeAfter);
};

vvzzt.chat.textChatRegistration = function(chatBoxSelector, outputSelector, inputSelector, 
    isPresenting, agentName, agentId, 
    propertyID, leadID, leadHeartbeatInterval) {
    vvzzt.chat.leadHeartbeatInterval = leadHeartbeatInterval;
    var coutput = $(outputSelector), cinput = $(inputSelector);
    coutput.html('');
    var myName = 'me';
    var otherName = agentName;
    if (isPresenting) {
        myName = agentName;
        otherName = 'Viewer';
    }
    vvzzt.chat.leadId = leadID;
    var agentDelayedTitle = "Apologies, this is taking a little longer than expected. ";
    var agentDelayedMsg = "If you'd like the Agent to get back to you, please send via this chat your contact info" +
    ' and anything else you would like the Agent to know about your needs. ';
    
    // When the selector is first shown to viewer, show alert
    if (!isPresenting) {
        var firstChatAlertShown = false;
        
        // this is just a placeholder:
        $('<div>')
            .attr( 'id', 'chat_alert' )
            .html('')
            .addClass('alert alert-attention flyover flyover-top-offset')
            .appendTo( $(chatBoxSelector) );

        $(chatBoxSelector).on('show', function() {
            if (!firstChatAlertShown) {
                firstChatAlertShown = true;
                
                setTimeout(function(){
                    vvzzt.chat.showChatAlert(
                        '<h1>Thank you for your interest!</h1>' +
                        '<p>' +
                        "   If you'd like to contact the Agent and chat with them in real time, please enter your chat message here." +
                        '</p>',
                        5000);
                }, 200);
            }
        });
    }

    var firstChatMsg = true;
    var receivedResponses = false;

    if (leadID && isPresenting) {
        // get history, assuming this is agent session!
        jQuery.get("/api/lead/msg/" + leadID, {
            }, 
            function(data, textStatus, jqXHR){
                if (data && data.length) {
                    coutput.show();
                    $.each(data, function(idx, entry){
                        var uname = entry.sender;
                        var isFromMe = true;
                        if (uname === "viewer") {
                            isFromMe = false;
                        }
                        else {
                            uname = myName;
                        }

                        vvzzt.chat.addToChatOutput(coutput, firstChatMsg, 
                            uname, entry.msg, isFromMe);
                        firstChatMsg = false;
                    });
                }
            }
        );

    }
    
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
                        vvzzt.chat.leadId = leadID;
                        // Start heartbeat 
                        vvzzt.chat.startLeadHeartbeat(leadID);
                        
                        vvzzt.chat.addToChatOutput(coutput, false, 
                            "auto-response", "Waiting for the agent to respond.  Please allow a couple of minutes...", false);
                        
                        // If after enough time, no response, suggest to leave contact info
                        setTimeout(function(){
                            if (!receivedResponses) {
                                vvzzt.chat.showChatAlert(
                                    '<h1>' + agentDelayedTitle + '</h1>' +
                                    '<p>' +
                                    agentDelayedMsg +
                                    '<br>  Thank you!' +
                                    '</p>',
                                    6000);
                                vvzzt.chat.addToChatOutput(coutput, false, 
                                    "auto-response", agentDelayedTitle + agentDelayedMsg, false);
                            }
                        }, 120000);
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
            if (firstChatMsg) {
                coutput.show();
                firstChatMsg = false;
            }
            
            if (!isFromMyself) {
                receivedResponses = true;
            }
            
            vvzzt.chat.addToChatOutput(coutput, firstChatMsg, 
                isFromMyself ? myName : otherName, m.text, isFromMyself);
        }
    });


};
