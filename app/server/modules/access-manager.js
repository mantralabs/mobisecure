var DBManager   = require('./db-manager');
var ObjectID 	= DBManager.Mongo.ObjectID;
var moment 		= require('moment');
var https 		= require('https');
var apn 		= require('apn');
var geo 		= require('geo-distance-js');
var http		= require('http');
var querystring 	= require('querystring');

var accessRequests = DBManager.DB.collection('access_requests');
var devices = DBManager.DB.collection('devices');
var accounts = DBManager.DB.collection('accounts');

exports.initiateAccessRequest = function(latitude, longitude, callback){
	findNearDevices(geo, latitude, longitude, function(e, o){
		callback(e, o);
	});
};

exports.createAccessRequest = function(user_id, device_id, callback){
	accounts.findOne({_id:ObjectID(user_id)}, function(e, o){
		if(o){
			var data = {device_id:device_id, user:o, created:moment(), granted:0};
			devices.findOne({_id:ObjectID(device_id)}, function(e, device){
                                if(device){
                                	console.log('creating access request for device');
                                	console.log(device);
									accessRequests.insert(data, {safe:true}, function(e, request){
										callback(null, request[0]);
										
										var gcm_data = {'message':'newrequest:'+request[0]._id, 'msgcnt':1, 'soundname':"beep.wav"};
										sendNotificationToAndroidDevice([device.tablet_id], gcm_data, function(){
											//do nothing here
										});
                                	});
                                 }
			});

		}else{
			callback('user could not be located');
		}
	});
};

exports.viewRequestOnDevice = function(request_id, device_id, callback){
	accessRequests.findOne({device_id:device_id, _id:request_id}, function(e, request){
			if(e)
				callback(e);
			else
				callback(null, request);
		});
}

exports.viewNewAccessRequests = function(device_id, callback){
	accessRequests.find({device_id:device_id, granted:0}).sort({created: -1}).toArray(callback);
}


exports.viewRequest = function(request_id, callback){
	console.log('fetching request '+request_id);
        accessRequests.findOne({_id:request_id}, function(e, o){
                if(e){
                        callback(e);
                }else{
                        callback(null, o);
                }
        });
}

// var data = {device_id:device_id, request_id:request_id};
exports.grantAccess = function(data, callback){
	//data._id = data._id;
	//data.device_id = data.device_id;

	accessRequests.findOne({_id:data.request_id, device_id:data.device_id}, function(e, o){
		if(o){
			o.granted = 1;
			o.granted_at = moment();
			var user_id = o.user._id;
			accounts.findOne({_id:user_id}, function(e, account){
				var device_type = account.device_type;
                        	var device_token = account.device_token;
                        	accessRequests.save(o, {safe:true}, function(e){
                                	if(e)
                                        	callback(e)
                                	else{
                                        	if(device_type == 'android'){
                                                	var gcm_data = {'message':'Your request has been approved.', 'msgcnt':1, 'soundname':"beep.wav"};
                                                	sendNotificationToAndroidUser([device_token], gcm_data, function(){
                                                        	//do nothing here
                                                	});
                                        	}else if(device_type == 'ios'){
                                                	sendNotificationToIOS(device_token, 'Your request has been approved', function(){
                                                        	//do nothing here
                                                	});
                                        	}
                                        	callback(null, o);
                                	}
                        	});
			});
		}else{
			callback('request could not be located');
		}
	});
};


// var data = {device_id:device_id, request_id:request_id};
exports.rejectAccess = function(data, callback){
        //data._id = data._id;
        //data.device_id = data.device_id;

        accessRequests.findOne({_id:data.request_id, device_id:data.device_id}, function(e, o){
                if(o){
                        o.granted = -1;
                        o.granted_at = moment();
			var user_id = o.user._id;
			accounts.findOne({_id:user_id}, function(e, account){
				var device_type = account.device_type;
	                        var device_token = account.device_token;
        	                accessRequests.save(o, {safe:true}, function(e){
                	                if(e)
                        	                callback(e)
                                	else{
                                        	if(device_type == 'android'){
                                                	var gcm_data = {'message':'Your request has been rejected.', 'msgcnt':1, 'soundname':"beep.wav"};
                                                	sendNotificationToAndroidUser([device_token], gcm_data, function(){
                                                        	//do nothing here
                                                	});
                                        	}else if(device_type == 'ios'){
                                                	//sendNotificationToIOS();
                                       		}
	
	                                        callback(null, o);
        	                        }
                	        });
			});
                }else{
                        callback('request could not be located');
                }
        });
};

exports.accessLogsForDevice = function(device_id, callback){
	accessRequests.find({device_id:device_id}).toArray(function(e, o){
		callback(e,o);
	});
}

var findNearDevices = function(geo, latitude, longitude, callback){
	devices.find({}).toArray(function(e, o){
		if(o){
			for(i = 0; i < o.length; i++){
				var device = o[i];
				var device_lat = device.latitude;
				var device_long = device.longitude;
				var distance = geo.getDistance(latitude, longitude, device_lat, device_long);
				o[i].distance = distance;
			}
			
			o.sort(function(device1, device2){
					if(device1.distance > device2.distance)
						return 1;
					else if(device1.distance < device2.distance)
						return -1;
					else 
						return 0;
				});
			callback(null, o);
		}else
			callback('No device located');
	});
};

//recipients format : ["id1", "id2", ..]
//message format : {"msg":"My Message"}
var sendNotificationToAndroidDevice = function(recipients, message, callback){
	//console.log(recipients);
	
	var post_data = JSON.stringify({registration_ids:recipients, data:message});
	
	var options = {
		hostname:"android.googleapis.com",
		method:"POST",
		port:443,
		path:"/gcm/send",
		rejectUnauthorized:false,
		headers:{
			"Content-Type"	:"application/json",
			"Content-Length":post_data.length,
			"Authorization"	:"key=AIzaSyDJhgErM1ONj_R5hPe8HUyoTsUFm0QP19Q",
		}
	};

	var req = https.request(options, function(res) {
     		 res.setEncoding('utf8');
      		 res.on('data', function (chunk) {
          	 	console.log('Response from GCM: ' + chunk);
        	 });
	});
	
	req.on('error', function(err){console.log(err)});
	
	// post the data
	console.log(post_data);
  	req.write(post_data);
  	req.end();
};


var sendNotificationToAndroidUser = function(recipients, message, callback){
        //console.log(recipients);

        var post_data = JSON.stringify({registration_ids:recipients, data:message});

        var options = {
                hostname:"android.googleapis.com",
                method:"POST",
                port:443,
                path:"/gcm/send",
                rejectUnauthorized:false,
                headers:{
                        "Content-Type"  :"application/json",
                        "Content-Length":post_data.length,
                        "Authorization" :"key=AIzaSyDiswP6-uqkqYt2sIrD7ZG_tAtR3u3pQsg",
                }
        };

        var req = https.request(options, function(res) {
                 res.setEncoding('utf8');
                 res.on('data', function (chunk) {
                        console.log('Response from GCM: ' + chunk);
                 });
        });

        req.on('error', function(err){console.log(err)});

        // post the data
        console.log(post_data);
        req.write(post_data);
        req.end();
};


var sendNotificationToIOS = function(token, message, callback){
	var options = {
  		host: 'localhost',
  		path: "/mobisecure/iospushnotification.php?device_token="+token+"&message="+encodeURIComponent(message)
	};
	console.log(options);
	
	http.get(options, function(res) {
  		console.log('STATUS: ' + res.statusCode);
  		//console.log('HEADERS: ' + JSON.stringify(res.headers));
	}).on('error', function(e) {
  		console.log('ERROR: ' + e.message);
	});

}


var sendNotificationToIOSBak = function(token, message, callback){
	console.log(token);
	var device = new apn.Device(token);	
	var service = new apn.Connection({ gateway:'gateway.push.apple.com' });
	
	service.on('connected', function() {
    		console.log("Connected");
	});

	service.on('transmitted', function(notification, device) {
    		console.log("Notification transmitted to:" + device.token.toString('hex'));
	});

	service.on('transmissionError', function(errCode, notification, device) {
    		console.error("Notification caused error: " + errCode + " for device ", device, notification);
	});

	service.on('timeout', function () {
    		console.log("Connection Timeout");
	});

	service.on('disconnected', function() {
    		console.log("Disconnected from APNS");
	});

	service.on('socketError', console.error);

	var note = new apn.Notification();
	note.setAlertText(message);
	
	service.pushNotification(note, device);

};
