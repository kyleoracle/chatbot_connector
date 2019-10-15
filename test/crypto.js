var crypto = require('crypto');

var HASH_ALGORITHM = 'sha256';
var secret = 'xxx';

var botMessage = {"userId":"1118047444899559","userProfile":{"firstName":"Kyle","lastName":"Zhang","sex":"male","language":null,"city":null,"province":null,"country":null},"text":"hello"};

var botMessageString = JSON.stringify(botMessage);
var signature = HASH_ALGORITHM + '=' + crypto.createHmac(HASH_ALGORITHM, secret).update(new Buffer(botMessageString, 'utf8')).digest('hex');

console.log(signature);


