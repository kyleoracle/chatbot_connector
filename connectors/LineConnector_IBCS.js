/******************************************************************************
 Copyright (c) 2016, Oracle and/or its affiliates. All rights reserved.
 $revision_history$
 24-Nov-2016   Chris Choi, APAC Cloud Pursuit
 1.0           initial creation
 ******************************************************************************/

var Constants = require('../utils/Constants');
var _ = require('underscore');
var Promise = require('bluebird');
// LINEBot is a Line Messenger Bot Framework, it makes it easy to read
var LINEBot = require('line-messaging');
// Initialize Logger
var logger = require('../utils/Logger');
var eventEmitter;
var bot;
var express = require('express');
var request = require('request');
var crypto = require('crypto');
var bodyParser = require('body-parser');
var Microsoft = require('../utils/Microsoft');



var LineConnector_IBCS = function (app, eveEmitter, server, _config) {
    this.app = app;
    this.eventEmitter = eveEmitter;
    this.config = _config;
    this.moduleName = 'LineConnector_IBCS - ' + this.config.BOT_NAME;
    this.bot = LINEBot.create({
    channelID: this.config.LINE_CHANNEL_ID,
    channelSecret: this.config.LINE_CHANNEL_SECRET,
    channelToken: this.config.LINE_CHANNEL_ACCESS_CODE
    }, server);


}

// Initialize the Line Connector and set all needed listeners.
LineConnector_IBCS.prototype.start = function () {
	
	var self = this;
    self.app.use(self.bot.webhook("/line_ibcs/" + this.config.BOT_NAME));

    // callback for IBCS
    var serviceCallback = function (req, res) {
        var body = req.body;
        logger.info(self.moduleName, "got message from IBCS", body);
        self.sendMessageToLine(body, 1);
        res.status(202).send("ok");
    };
    var lineCallback = express();
    self.app.use(bodyParser.json());
    lineCallback.all("/", serviceCallback);
    self.app.use('/line_callback/' + self.config.BOT_NAME, lineCallback);

    // Listen for Line events. These events are fired when BOT Engine sends back a reply through BotEngineConnector,
    // hence LineConnector_IBCS needs to listen for these incoming message and direct them back to Line Server for delivery.
    self.eventEmitter.on(Constants.EVENT_SEND_TO_LINE + self.config.BOT_NAME, function (message) {
        logger.info(self.moduleName, 'BotEngine EventEmitting - bot');
        self.sendMessageToLine(message,1);
    });
  

    logger.info(self.moduleName, 'successfully init Line connector');

    // Listen for Line incoming Free Text messages
    self.bot.on(LINEBot.Events.MESSAGE, function(replyToken, message) {
            if (message.isMessageType('text')) {
                logger.info(self.moduleName, 'bot - received a free textMessage message from user [' + message.getUserId() + ']...', message.getText());
                var payload = {text: message.getText()};
                self.sendMessageToBot(message.getUserId(), payload,1);
            } else {
                logger.info(self.moduleName, 'received a non-textMessage message from user [' + message.getUserId() + ']...', message.getType());
                //To be implemented
            };
    });
   


    // Listen for Line incoming Button postback messages
    self.bot.on(LINEBot.Events.POSTBACK, function(replyToken, message) {
        logger.info(self.moduleName, 'Postback  received a button postback message from user [' + message.getUserId() + ']...', message);
        var payload = {text: message.getPostbackData()};
        self.sendMessageToBot(message.getUserId(), payload,1);
    });
   
};

/*
 Send message to BOT by firing an postbackEvent_toBot
 @param msg: JSON object representing the message received from Client and to be sent to BOT
 */
LineConnector_IBCS.prototype.sendMessageToBot = function (userId, msg, pageId) {

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
};

/*
 Transforms message received from line to BOT Engine format
 @param userId: user ID
 @param body: message received.
 @return formatted message
 */
LineConnector_IBCS.prototype.transformMessageToBotFormat = function(userId, body) {
	var self = this;
    return new Promise(function (resolve, reject) {
        //getUserProfile(userId).then(function (userProfile) {
            logger.info(self.moduleName, 'transforming message to BOT Engine format...', body);

            var text;
            if (body.text) {
				text = body.text;
			}else{
				// TODO
			}

            var msgToBot = {
                "userId": userId,
                "userProfile": {
                    "firstName": 'kyle',
                    "lastName": 'zhang',
                    "sex": 'male',
                    "language": null,
                    "city": null,
                    "province": null,
                    "country": null
                },
                "messagePayload": {
                    "type": "text",
                    "text": text
                }
            };
            //
            resolve(msgToBot);
         // translate with microsoft api
			// Microsoft.translate(text, 'zh-TW', 'en').then(function(translatedText){
			// 	var msgToBot = {
			// 			"userId": userId,
			// 			"userProfile": {
			// 				"firstName": 'kyle',
			// 				"lastName": 'zhang',
			// 				"sex": 'male',
			// 				"language": null,
			// 				"city": null,
			// 				"province": null,
			// 				"country": null
			// 			},
			// 			"text": translatedText
			// 	};
			// 	//
			// 	resolve(msgToBot);
			// });
            // logger.info(self.moduleName, 'transforming message to BOT Engine format...END ');
        //});

    });

};


/*
 send message(s) from BOT Engine to Line server.
 @param message: message received from BOT Engine
 */
LineConnector_IBCS.prototype.sendMessageToLine = function(body, pageId) {

	var self = this;
	
	// ibcs
	if(!body.messagePayload || !body.messagePayload.text) {
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
    	self.bot.pushTextMessage(body.userId, body.messagePayload.text);
    	logger.info(self.moduleName, 'ok sending line textMessage message to user [' + body.userId + ']...', body);
        break;
    case 'buttons':
    	//
    	var actions = [];
    	body.messagePayload.choices.forEach(function (optionItem) {
            logger.info(self.moduleName, 'sending button to Line format...', optionItem);
            actions.push(new LINEBot.MessageTemplateAction(optionItem, optionItem));
        });

        if (pageId==1) {
            var buttonTemplate = new LINEBot.ButtonTemplateBuilder('請選擇', body.messagePayload.text, Constants.LINE_IMG, actions);
            var messageBuilder = new LINEBot.TemplateMessageBuilder('this is a buttons template', buttonTemplate);
            var data = self.bot.pushMessage(body.userId, messageBuilder);
        }  
        logger.info(self.moduleName, 'ok sending line buttons to user [' + body.userId + ']...', body);
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
 Fetch user profile from Line

function getUserProfile(userId) {
    logger.info(self.moduleName, 'fetching user [' + userId + '] profile from Line...');
    var profile = bot.getProfile(userId);
    logger.info(self.moduleName, 'profile info: ' + profile.toString());
    return profile;
};
*/

function sleep(milliseconds) {
    var start = new Date().getTime();
    while (true) {
        if ((new Date().getTime() - start) > milliseconds) {
            break;
        }
    }
};


module.exports = LineConnector_IBCS;
