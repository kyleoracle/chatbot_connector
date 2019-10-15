var Constants = require('../utils/Constants');
var request = require('request');
var crypto = require('crypto');
var bodyParser = require('body-parser');
var Promise = require('bluebird');
// Botly is a Facebook Messenger Bot Framework, it makes it easy to read
var Botly = require('botly');
// Initialize Logger
var logger = require('../utils/Logger');
var express = require('express');
var Microsoft = require('../utils/Microsoft');

var FacebookConnector_IBCS = function (app, eveEmitter, _config) {
    this.app = app;
    this.eventEmitter = eveEmitter;
    this.config = _config;
    this.moduleName = 'FacebookConnector_IBCS - ' + this.config.BOT_NAME;
    this.botly = new Botly({
        accessToken: this.config.FACEBOOK_ACCESS_TOKEN,
        verifyToken: this.config.FACEBOOK_VERIFY_TOKEN,
        webHookPath: '/' + this.config.BOT_NAME,
        notificationType: Botly.CONST.REGULAR
    });

}

// Initialize the Facebook Connector and set all needed listeners.
// @param app: express HTTP app to bind to.
// @param evEmitter: postbackEvent_toBot emitter
FacebookConnector_IBCS.prototype.start = function () {

    var self = this;
    logger.info(self.moduleName , 'started...');

    // Listen for facebook incoming Free Text messages
    self.botly.on('message', function (userId, message, data) {
        logger.info(self.moduleName, 'received a free textMessage message from user [' + userId + ']...', data);
        self.sendMessageToBot(userId, data);

    });

    // Listen for facebook incoming Button postback messages
    // postback is the string representation of a JSON object 'button payload'
    self.botly.on("postback", function (userId, message, postback) {
        logger.info(self.moduleName, 'received a button postback message from user [' + userId + ']...', postback);
        self.sendMessageToBot(userId, {text: postback});

    });


    // configure express with botly details
    // add JSON body parser to express app, and add a verification method that will intercept incoming requests and
    // use the 'x-hub-signature' header to verify that the request is actaully coming from Facebook and not spoofed.
    self.app.use("/fb_ibcs/" + self.config.BOT_NAME, bodyParser.json({verify: self.verifyRequestSignature}));
    self.app.use("/fb_ibcs", self.botly.router());

    // callback for IBCS
    var serviceCallback = function (req, res) {
        var body = req.body;
        logger.info(self.moduleName, "got message from IBCS", body);
        self.sendMessageToFacebook(body);
        res.status(202).send("ok");
    };
    var facebookCallback = express();
    self.app.use(bodyParser.json());
    facebookCallback.all("/", serviceCallback);
    self.app.use('/fb_callback/' + self.config.BOT_NAME, facebookCallback);

    /*
     Verify request authenticity by inspecting the 'x-hub-signature' header provided by Facebook and compare against
     the facebook app secret encrypted with SHA1
     */
    var verifyRequestSignature = function (req, res, buf) {
        var signature = req.headers["x-hub-signature"];

        if (!signature) {
            logger.error(self.moduleName, 'message source is not trusted');
        } else {
            var elements = signature.split('=');
            var method = elements[0];
            var signatureHash = elements[1];

            var expectedHash = crypto.createHmac('sha1', self.config.FACEBOOK_APP_SECRET)
                .update(buf)
                .digest('hex');

            if (signatureHash != expectedHash) {
                logger.error(self.moduleName, 'Couldnt validate the request signature....');
                throw new Error("Couldn't validate the request signature.");

            }
        }
    }
}

/*
 Send message to BOT by firing an postbackEvent_toBot
 @param msg: JSON object representing the message received from Client and to be sent to BOT
 */
FacebookConnector_IBCS.prototype.sendMessageToBot = function (userId, msg) {
    var self = this;
    return new Promise(function (resolve, reject) {
        self.transformMessageToBotFormat(userId, msg).then(function (botMessage) {
            logger.info(self.moduleName, 'Sending message to BotEngine...', botMessage);
            var botMessageString = JSON.stringify(botMessage);
            var secret = self.config.MSG_SHARED_SECRET;
            signature = self.config.HASH_ALGORITHM + '=' + crypto.createHmac(self.config.HASH_ALGORITHM, secret)
                    .update(new Buffer(botMessageString, 'utf8')).digest('hex');
            var options = {
                url: self.config.MSG_RECEIVER_URL,
                headers: {
                    'X-Hub-Signature': signature,
                    'Content-Type': 'application/json'
                },
                json: true,
                body: botMessage
            };
            logger.info(self.moduleName, 'URL...', self.config.MSG_RECEIVER_URL);
            logger.info(self.moduleName, 'X-Hub-Signature...', signature);
            request.post(options, function (error, response, body) {
                logger.info(self.moduleName, 'Response of sending to IBCS is...', response);
                if (response && response.statusCode === 202) {
                	logger.info(self.moduleName, "send to IBCS OK");
                    resolve("ok");
                } else {
                    logger.error(self.moduleName, "send to IBCS ERROR: " + JSON.stringify(error));
                    reject(error);
                }
            });
        });
    });
}

/*
 Transforms message received from facebook to BOT Engine format
 @param userId: user ID
 @param body: JSON message received.
 @return formatted message
 */
FacebookConnector_IBCS.prototype.transformMessageToBotFormat = function (userId, body) {
    var self = this;
    return new Promise(function (resolve, reject) {

        self.getUserProfile(userId).then(function (userProfile) {
            logger.info(self.moduleName, 'transforming message to BOT Engine format, facebook msg body is ', body);
            var text;
			if (body.text) {
				text = body.text;
			}
			// translate with microsoft api
			Microsoft.translate(text, 'zh-TW', 'en').then(function(translatedText){
				var msgToBot = {
						"userId": userId,
						"userProfile": {
							"firstName": userProfile.first_name,
							"lastName": userProfile.last_name,
							"sex": userProfile.gender,
							"language": null,
							"city": null,
							"province": null,
							"country": null
						},
						"messagePayload": {
                            "type": "text",
                            "text": translatedText
                        }
				};
				resolve(msgToBot);
			});
			logger.info(self.moduleName, "end of transformMessageToBotFormat");
        });
    });

}

/*
 send message(s) from BOT Engine to Facebook server.
 @param message: message received from BOT Engine
 */
FacebookConnector_IBCS.prototype.sendMessageToFacebook = function (body) {
    var self = this;
    // Set 'Typing On' indicator between sending messages
    self.botly.sendAction({id: body.userId, action: Botly.CONST.ACTION_TYPES.TYPING_ON}, function (err, data) {});
	if(!body.messagePayload.text) {
		logger.info(self.moduleName, '!!! body.text is null!!!');
		return;
	}
	
	// decide type
    var type;
    var payload;
    if(body.messagePayload.text){
    	type = 'text';
    }
    if(body.messagePayload.choices){
    	type = 'buttons';
    }
    if (body.messagePayload.attachment && body.messagePayload.attachment.payload) {
		type = body.messagePayload.attachment.type;
	}
    
    // create payload
    switch (type) {
    case 'text':
    	payload = {id: body.userId, text: body.messagePayload.text};
        self.botly.sendText(payload, function (error, data) {
            if (error) {
                logger.error(self.moduleName, 'error sending textMessage message to user [' + payload.id + ']...', error);
            }
            else {
                logger.info(self.moduleName, 'ok sending facebook textMessage message to user [' + payload.id + ']...', payload);
            }
        });
        break;
    case 'buttons':
    	var buttons = self.createFacebookButtons(body.choices, Constants.FACEBOOK_LIMIT_BUTTONS_TEXT, false);
    	payload = {id: body.userId, text: body.messagePayload.text, buttons: buttons};
    	self.botly.sendButtons(payload, function (error, data) {
             if (error) {
                 logger.error(self.moduleName, 'error sending textMessage message to user [' + payload.id + ']...', error);
             }
             else {
                 logger.info(self.moduleName, 'ok sending facebook textMessage message to user [' + payload.id + ']...', payload);
             }
         });
        break;
    case 'image':
    	// TODO
    	logger.info(self.moduleName, 'got image from IBCS:');
        break;
    case 'template':
    	logger.info(self.moduleName, 'got template from IBCS:');
    	// TODO
    	break;
    }
};


/*
 Transforms message received from BOT Engine to Facebook format
 @param userId: user ID
 @param body: JSON message to send to facebook.
 @return formatted JSON object accordinf to Facebook Specifications
 */
FacebookConnector_IBCS.prototype.transformMessageToFacebookFormat = function (body) {
    var self = this;
    logger.info(self.moduleName, 'transforming body to facebook format...', body);
    if(!body) {
        logger.info(self.moduleName, 'body is null!!!');
        return;
    }
   
    // decide type
    var type;
    var out;
    if(body.messagePayload.text){
    	type = 'text';
    }
    if(body.messagePayload.choices){
    	type = 'buttons';
    }
    if (body.messagePayload.attachment && body.messagePayload.attachment.payload) {
		type = body.messagePayload.attachment.type;
	}
    
    // create payload
    switch (type) {
    case 'text':
    	out = {id: body.userId, text: body.messagePayload.text};
        break;
    case 'buttons':
    	var buttons = self.createFacebookButtons(body.messagePayload.choices, Constants.FACEBOOK_LIMIT_BUTTONS_TEXT, false);
        out = {id: body.messagePayload.userId, text: body.messagePayload.text, buttons: buttons};
        break;
    case 'image':
    	// TODO
    	logger.info(self.moduleName, 'got image from IBCS:');
        break;
    case 'template':
    	logger.info(self.moduleName, 'got template from IBCS:');
    	// TODO
    	break;
    }
    return out;
};


/*
 Convert BotEngine options to Facebook Buttons
 @param options: BontEngine 'options' array to be converted to facebook buttons
 @param maxLength: the length of the array to return back.
 @param isQuickReply: boolean flag to indicate if to create options as 'Quick Replies' buttons.
 */
FacebookConnector_IBCS.prototype.createFacebookButtons = function (options, maxLength, isQuickReply) {
    var self = this;
    var buttons = [];
    options.forEach(function (option) {
    	buttons.push(self.botly.createPostbackButton(option, option));
    });
    return buttons.slice(0, maxLength);
}


/*
 Fetch user profile from facebook
 */
FacebookConnector_IBCS.prototype.getUserProfile = function (userId) {
    var self = this;
    return new Promise(function (resolve, reject) {
        logger.info(self.moduleName, 'fetching user [' + userId + '] profile from facebook...');
//        var userProfile = {
//        		  "first_name": "Kyle",
//        		  "last_name": "Zhang",
//        		  "locale": "en_US",
//        		  "timezone": -7,
//        		  "gender": "male"
//        		};
//        
//        resolve(userProfile);
        self.botly.getUserProfile(userId, function (error, userProfile) {
            if (error) {
            	logger.info(self.moduleName, 'error profile', error);
                reject(error);
            }
            else {
            	logger.info(self.moduleName, 'ok profile', userProfile);
                resolve(userProfile);
            }
        });
    });

}

/*
    Translate BotEngine Response item keys to corresponding Facebook Item key
 */
FacebookConnector_IBCS.prototype.mapFacebookItemKey = function (key) {
    var self = this;
    if (key.toUpperCase() === Constants.DICTIONARY_BOT_ITEM_TITLE.toUpperCase()) {
        return Constants.DICTIONARY_FACEBOOK_ITEM_TITLE;
    }
    else if (key.toUpperCase() === Constants.DICTIONARY_BOT_ITEM_SUBTITLE.toUpperCase()) {
        return Constants.DICTIONARY_FACEBOOK_ITEM_SUBTITLE;
    }
    else if (key.toUpperCase() === Constants.DICTIONARY_BOT_ITEM_IMAGEURL.toUpperCase()) {
        return Constants.DICTIONARY_FACEBOOK_ITEM_IMAGEURL;
    }
    else if (key.toUpperCase() === Constants.DICTIONARY_BOT_ITEM_CARDURL.toUpperCase()) {
        return Constants.DICTIONARY_FACEBOOK_ITEM_CARDURL;
    }
    else if (key.toUpperCase() === Constants.DICTIONARY_BOT_ITEM_OPTIONS.toUpperCase()) {
        return Constants.DICTIONARY_FACEBOOK_ITEM_OPTIONS;
    }
    else if (key.toUpperCase() === Constants.DICTIONARY_BOT_ITEM_PROMPT.toUpperCase()) {
        return Constants.DICTIONARY_FACEBOOK_ITEM_PROMPT;
    }
    else {
        return key.toLowerCase();
    }
}

module.exports = FacebookConnector_IBCS;