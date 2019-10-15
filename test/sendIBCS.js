var crypto = require('crypto');
var request = require('request');
var HASH_ALGORITHM = 'sha256';
var logger = require('../utils/Logger');
var botConfigs = require('../botConfigs.json');

//use the first bot config to test
var botConfig = botConfigs[0];

var botMessage = {
		"userId":"1118047444899559",
		"userProfile":
			{"firstName":"Kyle","lastName":"Zhang","sex":"male","language":null,"city":null,"province":null,"country":null},
		"text":"hi"
		};


logger.info('send IBCS', 'Sending message to BotEngine...' + JSON.stringify(botMessage));
var botMessageString = JSON.stringify(botMessage);
var secret = botConfig.config.msgSharedSecret;
signature = botConfig.config.hashAlgorithm + '=' + crypto.createHmac(botConfig.config.hashAlgorithm, secret).update(new Buffer(botMessageString, 'utf8')).digest('hex');

var options = {
    url: botConfig.config.msgReceiverEndUrl,
    headers: {
        'X-Hub-Signature': signature,
    'Content-Type': 'application/json'
    },
    json: true,
    body: botMessage
};
logger.info('send IBCS', 'bot name:' + botConfig.config.botName);
request.post(options, function (error, response, body) {
//logger.info('send IBCS', 'Response of sending to IBCS is...' + JSON.stringify(response));
if (response && response.facebook >= 200 && response.statusCode < 300) {
	logger.info('send IBCS', 'ok!!!');
} else {
	logger.info('send IBCS', "error!!! " + JSON.stringify(error));
    }
});