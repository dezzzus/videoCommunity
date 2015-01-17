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
    coutput.html( prev + '<div><div class="'+nameClass+'">'+uname+':&nbsp;</div>'+ 
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
    
    // When the selector is first shown to viewer, show alert
    if (!isPresenting) {
        
        $('<div>')
            .attr( 'id', 'chat_alert' )
            .html(
               '<h1>Thank you for your interest!</h1>' +
               '<p>' +
               "   If you'd like to contact the Agent and chat with them in real time, please enter your chat message here." +
               '</p>')
            .addClass('alert alert-attention flyover flyover-top-offset')
            .appendTo( $(chatBoxSelector) );

        $(chatBoxSelector).on('show', function() {
            setTimeout(function() {
                $('#chat_alert').addClass('in');
                setTimeout(function(){
                    $('#chat_alert').removeClass('in');
                }, 5000);

            }, 500);
            
        });
        
        
    }

    var firstChatMsg = true;

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
                        // Start heartbeat 
                        vvzzt.chat.startLeadHeartbeat(leadID);
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
            
            vvzzt.chat.addToChatOutput(coutput, firstChatMsg, 
                isFromMyself ? myName : otherName, m.text, isFromMyself);
        }
    });


};
