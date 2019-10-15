/******************************************************************************
 Copyright (c) 2016, Oracle and/or its affiliates. All rights reserved.
 $revision_history$
 13-Nov-2016   Tamer Qumhieh, Oracle A-Team
 1.0           initial creation
 ******************************************************************************/


var moduleName = 'MessagePlatformServer';

// Modules Import
var Constants = require('./utils/Constants');
var fs = require('fs');
var http = require('http');
var express = require('express');
var Promise = require('bluebird');
var request = require('request');
var emitter = require('events').EventEmitter;
var logger = require('./utils/Logger');
var Microsoft = require('./utils/Microsoft');
var FacebookConnector_IBCS = require('./connectors/FacebookConnector_IBCS');
var LineConnector_IBCS = require('./connectors/LineConnector_IBCS');
var WeChatConnector_IBCS = require('./connectors/WeChatConnector_IBCS');
var botConfigs = require('./botConfigs.json');

// initialize express
var app = express();
// This line is commented out here however added again in the FacebookConnector, as a now we added some extra security verification steps.
//app.use(bodyParser.json());
var server = http.createServer(app);

server.listen(Constants.HTTP_PORT, function () {
    logger.info(moduleName, 'Listening on ' + server.address().port);
});

// Initialize Events Emitter
var eventsEmitter = new emitter();


// Initialize & start Facebook/Line/Wechat Connector
getLocalBotClientConfigs().then(function (configs) {
    configs.forEach(function (config) {
        
        if (config.client === 'FB_IBCS') {
       	 logger.info(moduleName, "Got client: " + config.config.botName);
            var botConfig = {};
            botConfig.FACEBOOK_ACCESS_TOKEN = config.config.accessToken;
            botConfig.FACEBOOK_VERIFY_TOKEN = config.config.verifyToken;
            botConfig.BOT_NAME = config.config.botName;
            botConfig.FACEBOOK_PAGE_ID = config.config.pageId;
            botConfig.FACEBOOK_APP_SECRET = config.config.appSecret;
            botConfig.HASH_ALGORITHM = config.config.hashAlgorithm;
            botConfig.MSG_SHARED_SECRET = config.config.msgSharedSecret;
            botConfig.MSG_RECEIVER_URL = config.config.msgReceiverEndUrl;
            new FacebookConnector_IBCS(app, eventsEmitter, botConfig).start();
        }
        
        if (config.client === 'LINE_IBCS')
        {
        	logger.info(moduleName, "Got client: " + config.config.botName);
        	var botConfig = {};
        	botConfig.LINE_CHANNEL_ID = config.config.channelID;
        	botConfig.LINE_CHANNEL_SECRET = config.config.appSecret;
        	botConfig.LINE_CHANNEL_ACCESS_CODE = config.config.accessToken;
        	botConfig.BOT_NAME = config.config.botName;
        	botConfig.HASH_ALGORITHM = config.config.hashAlgorithm;
            botConfig.MSG_SHARED_SECRET = config.config.msgSharedSecret;
            botConfig.MSG_RECEIVER_URL = config.config.msgReceiverEndUrl;
        	new LineConnector_IBCS(app, eventsEmitter, server, botConfig).start();
        }
       
        if (config.client === 'WECHAT_IBCS') {
            var botConfig = {};
            botConfig.WECHAT_VERIFY_TOKEN = config.config.verifyToken;
            botConfig.BOT_NAME = config.config.botName;
            botConfig.WECHAT_APPID = config.config.appId;
            botConfig.WECHAT_SECRET = config.config.appSecret;
            botConfig.HASH_ALGORITHM = config.config.hashAlgorithm;
            botConfig.MSG_SHARED_SECRET = config.config.msgSharedSecret;
            botConfig.MSG_RECEIVER_URL = config.config.msgReceiverEndUrl;
            new WeChatConnector_IBCS(app, botConfig).start();
        }
    });
});

//log
app.get('/log', function(req, res) {
	Constants.LOG_SEND_URL = req.param('url');
	logger.info('log url is changed to:' + Constants.LOG_SEND_URL);
	res.send('ok')
});

//translate
app.get('/translate', function(req, res) {
	var text = req.param('text');
	Microsoft.translate(text, 'zh-TW', 'en').then(function(translatedText){
		res.send(translatedText)
	});
});


function getLocalBotClientConfigs() {
	return new Promise(function (resolve, reject) {
		logger.info(moduleName, 'Fetching Bot Client configs locally from botConfigs.json ...');
		resolve(botConfigs);
	});
}
