var crypto = require('crypto');
var request = require('request');
var logger = require('../utils/Logger');

var message = {
	  "recipient":{
	  	"id":"1808736592477682"
	  },
	  "message":{
	  	"text":"hello, world!"
	  }
};
var options = {
    url: 'https://graph.facebook.com/v2.6/me/messages?access_token=xxx',
    json: true,
    body: message
};

request.post(options, function (error, response, body) {
	logger.info('send FB', 'error:' + JSON.stringify(error));
	logger.info('send FB', 'response:' + JSON.stringify(response));
	logger.info('send FB', 'body:' + JSON.stringify(body));
});


