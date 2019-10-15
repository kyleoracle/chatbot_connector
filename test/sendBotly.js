var Botly = require('botly');
var logger = require('../utils/Logger');

var botly = new Botly({
    accessToken: 'xxx',
    verifyToken: 'bteam',
    webHookPath: '/' + 'chinese',
    notificationType: Botly.CONST.REGULAR
});

var payload = {id: '1808736592477682', text: 'sent by botly'};

botly.sendText(payload, function (error, data) {
    if (error) {
        logger.error('ibcs', 'error sending textMessage message to user [' + payload.id + ']...', error);
    }
    else {
        logger.info('ibcs', 'ok sending facebook textMessage message to user [' + payload.id + ']...', payload);
    }
});

botly.getUserProfile('1808736592477682', function (error, data) {
	if (error) {
		logger.error('ibcs', 'error...', error);
	}
	else {
		logger.info('ibcs', 'ok...', data);
	}
});


