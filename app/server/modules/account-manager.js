var DBManager   = require('./db-manager');
var ObjectID 	= DBManager.Mongo.ObjectID;
var crypto 		= require('crypto');
var moment 		= require('moment');

/* Entity Collections */
var accounts = DBManager.DB.collection('accounts');
var customer_accounts = DBManager.DB.collection('customer_accounts');
var devices = DBManager.DB.collection('devices');

/* login validation methods */

exports.autoLogin = function(user, pass, callback)
{
	accounts.findOne({user:user}, function(e, o) {
		if (o){
			o.pass == pass ? callback(o) : callback(null);
		}	else{
			callback(null);
		}
	});
}

exports.manualLogin = function(email, pass, callback)
{
	accounts.findOne({email:email}, function(e, o) {
		if (o == null){
			callback('user-not-found');
		}	else{
			validatePassword(pass, o.pass, function(err, res) {
				if (res){
					callback(null, o);
				}	else{
					callback('invalid-password');
				}
			});
		}
	});
}

exports.saveDeviceInfo = function(email, device_type, device_token, callback)
{
		accounts.findOne({email:email}, function(e, o) {
                if (o == null){
                        callback('user-not-found');
                }else{
			o.device_type = device_type;
			o.device_token = device_token;	
			accounts.save(o, {safe:true}, function(e){
				if(e)
					callback(e);
				else
					callback(null, o);
			});

		}
	});
	
}

exports.deviceLogin = function(data, callback){
	console.log(data);
	devices.findOne({username:data.username}, function(e, o){
		if(o == null){
			callback('device credentials not correct');
		}else{
			validatePassword(data.password, o.password, function(e, res){
				if(res){
					if(data.tablet_id)
						o.tablet_id = data.tablet_id;
					if(data.latitude)
						o.latitude = data.latitude;
					if(data.longitude)
						o.longitude = data.longitude;
					devices.save(o, {safe:true}, function(e){
						if(e) 
							callback(e);
						else
							callback(null, o);
					});
				}else{
					callback('invalid password');
				}
			}); 
		}
	});
}

/* record insertion, update & deletion methods */

exports.addNewAccount = function(newData, callback)
{
	console.log(newData);
	createNewAccount(newData, callback);
}

exports.addNewCustomerAccount = function(customerAccountData, loginData, callback){
	customerAccountData.created = moment();
	customer_accounts.insert(customerAccountData, {safe:true}, function(e, customerAccount){
		if(customerAccount){
			customerAccount = customerAccount[0];
			loginData.customer_account_id = customerAccount._id;
			createNewAccount(loginData, function(e, loginAccount){
				if(e){
					//deleting customer account created in the step above
					console.log('deleting customer account with id '+customerAccount._id);
					customer_accounts.remove({_id:customerAccount._id}, true, function(e, o){
						callback('Login email already exist');
					});
				}else{
					loginAccount = loginAccount[0];
					customerAccount.email = loginAccount.email;
					callback(null, customerAccount);
				}
			});
		}else{
			callback('Customer account could not be created. Try again.')
		}
	});
}

exports.addNewDevice = function(deviceData, callback){
	deviceData.created = moment();
	deviceData.customer_account_id = ObjectID(deviceData.customer_account_id);
	
	devices.findOne({username:deviceData.username}, function(e, o) {
		if (o){
			callback('Another device already registered with this username');
		}else{
			saltAndHash(deviceData.password, function(hash){
				deviceData.password = hash;
				// append date stamp when record was created //
				deviceData.date = moment().format('MMMM Do YYYY, h:mm:ss a');
				//accounts.insert(newData, {safe: true}, callback);

				devices.insert(deviceData, {safe:true}, function(e, o){
           			     if(o){
                       			 callback(null, o[0]);
                		     }else{
                       			 callback(e);
                		     }
       				 });
			});
		}
	});
};


var generateSalt = function()
{
	var set = '0123456789abcdefghijklmnopqurstuvwxyzABCDEFGHIJKLMNOPQURSTUVWXYZ';
	var salt = '';
	for (var i = 0; i < 10; i++) {
		var p = Math.floor(Math.random() * set.length);
		salt += set[p];
	}
	return salt;
}

var md5 = function(str) {
	return crypto.createHash('md5').update(str).digest('hex');
}

var saltAndHash = function(pass, callback)
{
	var salt = generateSalt();
	callback(salt + md5(pass + salt));
}

var validatePassword = function(plainPass, hashedPass, callback)
{
	var salt = hashedPass.substr(0, 10);
	var validHash = salt + md5(plainPass + salt);
	callback(null, hashedPass === validHash);
}





exports.fetchDevices = function(customerAccountId, callback){
	try{
		customerAccountId = ObjectID(customerAccountId);
	}catch(err){
		callback('customer account id is not correct');
		return;
	}
	devices.find({customer_account_id:customerAccountId}).toArray(callback);
}

exports.fetchDeviceById = function(deviceId, callback){
	try{
		deviceId = ObjectID(deviceId);
	}catch(err){
		callback('device id is not correct');
		return;
	}
	devices.findOne({_id:deviceId}, callback);
}

exports.findDevice = function(data, callback){
	devices.findOne(data, callback);
}

var createNewAccount = function(newData, callback){
	accounts.findOne({email:newData.email}, function(e, o) {
		if (o){
			callback('email already registered');
		}	else{
			saltAndHash(newData.pass, function(hash){
				newData.pass = hash;
				// append date stamp when record was created //
				newData.date = moment().format('MMMM Do YYYY, h:mm:ss a');
				accounts.insert(newData, {safe: true}, callback);
			});
		}
	});
}

exports.updateAccount = function(newData, callback)
{
	accounts.findOne({user:newData.user}, function(e, o){
		o.name 		= newData.name;
		o.email 	= newData.email;
		o.country 	= newData.country;
		if (newData.pass == ''){
			accounts.save(o, {safe: true}, function(err) {
				if (err) callback(err);
				else callback(null, o);
			});
		}	else{
			saltAndHash(newData.pass, function(hash){
				o.pass = hash;
				accounts.save(o, {safe: true}, function(err) {
					if (err) callback(err);
					else callback(null, o);
				});
			});
		}
	});
}

exports.updatePassword = function(email, newPass, callback)
{
	accounts.findOne({email:email}, function(e, o){
		if (e){
			callback(e, null);
		}	else{
			saltAndHash(newPass, function(hash){
		        o.pass = hash;
		        accounts.save(o, {safe: true}, callback);
			});
		}
	});
}

/* account lookup methods */

exports.deleteAccount = function(id, callback)
{
	accounts.remove({_id: getObjectId(id)}, callback);
}

exports.getAccountByEmail = function(email, callback)
{
	accounts.findOne({email:email}, function(e, o){ callback(o); });
}

exports.validateResetLink = function(email, passHash, callback)
{
	accounts.find({ $and: [{email:email, pass:passHash}] }, function(e, o){
		callback(o ? 'ok' : null);
	});
}

exports.getAllRecords = function(callback)
{
	accounts.find().toArray(
		function(e, res) {
		if (e) callback(e)
		else callback(null, res)
	});
};

exports.delAllRecords = function(callback)
{
	accounts.remove({}, callback); // reset accounts collection for testing //
}

/* private encryption & validation methods */

var generateSalt = function()
{
	var set = '0123456789abcdefghijklmnopqurstuvwxyzABCDEFGHIJKLMNOPQURSTUVWXYZ';
	var salt = '';
	for (var i = 0; i < 10; i++) {
		var p = Math.floor(Math.random() * set.length);
		salt += set[p];
	}
	return salt;
}

var md5 = function(str) {
	return crypto.createHash('md5').update(str).digest('hex');
}

var saltAndHash = function(pass, callback)
{
	var salt = generateSalt();
	callback(salt + md5(pass + salt));
}

var validatePassword = function(plainPass, hashedPass, callback)
{
	var salt = hashedPass.substr(0, 10);
	var validHash = salt + md5(plainPass + salt);
	callback(null, hashedPass === validHash);
}

/* auxiliary methods */

var getObjectId = function(id)
{
	return accounts.db.bson_serializer.ObjectID.createFromHexString(id)
}

var findById = function(id, callback)
{
	accounts.findOne({_id: getObjectId(id)},
		function(e, res) {
		if (e) callback(e)
		else callback(null, res)
	});
};


var findByMultipleFields = function(a, callback)
{
// this takes an array of name/val pairs to search against {fieldName : 'value'} //
	accounts.find( { $or : a } ).toArray(
		function(e, results) {
		if (e) callback(e)
		else callback(null, results)
	});
}
