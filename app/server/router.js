var DBManager   = require('./modules/db-manager');
var ObjectID 	= DBManager.Mongo.ObjectID;

var CT = require('./modules/country-list');
var AM = require('./modules/account-manager');
var EM = require('./modules/email-dispatcher');
var PM = require('./modules/profile-manager');
var AccessManager = require('./modules/access-manager');

module.exports = function(app) {

	app.get('/', function(req, res){
		if (req.cookies.email == undefined || req.cookies.pass == undefined){
			res.render('login', { title: 'Hello - Please Login To Your Account' });
		}	else{
			AM.autoLogin(req.cookies.email, req.cookies.pass, function(o){
				if (o != null){
				    req.session.user = o;
					res.redirect('/home');
				}	else{
					res.render('login', { title: 'Hello - Please Login To Your Account' });
				}
			});
		}
	});
	
	app.post('/login', function(req, res){
		AM.manualLogin(req.param('email'), req.param('pass'), function(e, o){
			if (!o){
				res.json(e, 400);
			}else{
				if(req.param('device_type') && req.param('device_token')){
					AM.saveDeviceInfo(req.param('email'), req.param('device_type'), req.param('device_token'), function(e, o){
						//do nothing
					});
				}
				req.session.user = o;
				if (req.param('remember-me') == 'true'){
					res.cookie('email', o.email, { maxAge: 900000 });
					res.cookie('pass', o.pass, { maxAge: 900000 });
				}
				res.json(o, 200);
			}
		});
	});


	app.post('/device/login', function(req, res){
		AM.deviceLogin({
						username:req.param('username'), 
						password:req.param('password'), 
						tablet_id:req.param('tablet_id'), 
						latitude:req.param('latitude'), 
						longitude:req.param('longitude')
					}, function(e, device){
						if(e){
							res.json(e, 400);
						}else{
							req.session.device = device;
							res.json(device, 200);
						}
		});
	});
	
	app.get('/home', function(req, res) {
	    if (req.session.user == null){
	        res.redirect('/');
	    }   else{
			res.render('home', {
				title : 'Control Panel',
				countries : CT,
				udata : req.session.user
			});
	    }
	});
	
	app.post('/home', function(req, res){
		if (req.param('user') != undefined) {
			AM.updateAccount({
				user 		: req.param('user'),
				name 		: req.param('name'),
				email 		: req.param('email'),
				country 	: req.param('country'),
				pass		: req.param('pass')
			}, function(e, o){
				if (e){
					res.send('error-updating-account', 400);
				}	else{
					req.session.user = o;
					if (req.cookies.user != undefined && req.cookies.pass != undefined){
						res.cookie('user', o.user, { maxAge: 900000 });
						res.cookie('pass', o.pass, { maxAge: 900000 });	
					}
					res.send('ok', 200);
				}
			});
		}	else if (req.param('logout') == 'true'){
			res.clearCookie('user');
			res.clearCookie('pass');
			req.session.destroy(function(e){ res.send('ok', 200); });
		}
	});

	app.get('/logout', function(req, res){
		res.clearCookie('user');
                res.clearCookie('pass');
                req.session.destroy(function(e){ 
			res.json('ok');
		});
	});

	app.get('/profile', function(req, res) {
	    if (req.session.user == null){
	        res.json(403, {'msg':'Not Authorized'});
	    }   else{
			PM.fetchProfileForUser(ObjectID(req.session.user._id), function(e, profile){
				res.json(profile);
			})
	    }
	});

	app.post('/profile', function(req, res) {
		if (req.session.user == null){
	        res.json(403, {'msg':'Not Authorized'});
	    }else{
	    	PM.updateProfile({
	    		_id : ObjectID(req.session.user._id),
	    		fullname : req.param('fullname'),
	    		mobile : req.param('mobile'),
	    		address_line_1 : req.param('add_line_1'),
	    		address_line_2 : req.param('add_line_2'),
	    		landmark : req.param('landmark'),
	    		city : req.param('city'),
	    		state : req.param('state'),
	    		country : req.param('country'),
	    		pincode : req.param('pincode'),
	    	}, function(e, profile){
	    		if(e){
	    			res.json(400, {'msg':e});
	    		}else{
	    			res.json(profile);
	    		}
	    	});
	    }
	});

	app.get('/avatar', function(req, res){
		if (req.session.user != null){
			res.sendfile('./uploads/'+req.session.user._id+'.png');
		}else if(req.session.user == null && req.session.device != null){
			var user_id = req.param('user_id');
			res.sendfile('./uploads/'+user_id+'.png');
		}else{	
			res.jsonp(403, {'msg':'Not Authorized'});
	    }
	});

	app.post('/avatar', function(req, res){
		if (req.session.user == null){
	        res.jsonp(403, {'msg':'Not Authorized'});
	    }else{
	    	var temp_path = req.files.file.path;
			var save_path = './uploads/'+req.session.user._id+'.png';
	    	PM.uploadAvatar(temp_path, save_path, function(e, o){
	    		if(e)
	    			res.jsonp(400, {msg:o});
	    		else
	    			res.jsonp({msg:o});
	    	});
	    }
	});


	app.post('/avatar-base64', function(req, res){
		if (req.session.user == null){
                	res.jsonp(403, {'msg':'Not Authorized'});
           	 }else{
			var base64file = req.param('file');
			console.log(base64file);
			var base64Data = base64file.replace(/^data:image\/png;base64,/,"");
			base64Data = base64Data.replace(/^data:image\/jpeg;base64,/,"");
			var save_path = './uploads/'+req.session.user._id+'.png';
  			require("fs").writeFile(save_path, base64Data, 'base64', function(e) {
  				if(e){
					res.json(400, {msg:e});
				}else{
					res.jsonp({msg:'success'});
				}
			});
		}
	});
	
// creating new accounts //
	
	app.get('/signup', function(req, res) {
		res.render('signup', {  title: 'Signup', countries : CT });
	});
	
	app.post('/users/signup', function(req, res){
		AM.addNewAccount({
			email 	: req.param('email'),
			pass	: req.param('pass'),
			mobile	: req.param('mobile'),
			fullname: req.param('fullname')
		}, function(e, o){
			if (e){
				res.json(400, {msg:e});
			}	else{
				res.json({msg:o[0]});
			}
		});
	});

// password reset //

	app.post('/lost-password', function(req, res){
	// look up the user's account via their email //
		AM.getAccountByEmail(req.param('email'), function(o){
			if (o){
				res.send('ok', 200);
				EM.dispatchResetPasswordLink(o, function(e, m){
				// this callback takes a moment to return //
				// should add an ajax loader to give user feedback //
					if (!e) {
					//	res.send('ok', 200);
					}	else{
						res.send('email-server-error', 400);
						for (k in e) console.log('error : ', k, e[k]);
					}
				});
			}	else{
				res.send('email-not-found', 400);
			}
		});
	});

	app.get('/reset-password', function(req, res) {
		var email = req.query["e"];
		var passH = req.query["p"];
		AM.validateResetLink(email, passH, function(e){
			if (e != 'ok'){
				res.redirect('/');
			} else{
	// save the user's email in a session instead of sending to the client //
				req.session.reset = { email:email, passHash:passH };
				res.render('reset', { title : 'Reset Password' });
			}
		})
	});
	
	app.post('/reset-password', function(req, res) {
		var nPass = req.param('pass');
	// retrieve the user's email from the session to lookup their account and reset password //
		var email = req.session.reset.email;
	// destory the session immediately after retrieving the stored email //
		req.session.destroy();
		AM.updatePassword(email, nPass, function(e, o){
			if (o){
				res.send('ok', 200);
			}	else{
				res.send('unable to update password', 400);
			}
		})
	});
	
// view & delete accounts //
	
	app.get('/print', function(req, res) {
		AM.getAllRecords( function(e, accounts){
			res.render('print', { title : 'Account List', accts : accounts });
		})
	});
	
	app.post('/delete', function(req, res){
		AM.deleteAccount(req.body.id, function(e, obj){
			if (!e){
				res.clearCookie('user');
				res.clearCookie('pass');
	            req.session.destroy(function(e){ res.send('ok', 200); });
			}	else{
				res.send('record not found', 400);
			}
	    });
	});
	
	app.get('/reset', function(req, res) {
		AM.delAllRecords(function(){
			res.redirect('/print');	
		});
	});


	/**
		To create a new customer account    
	**/
	app.post('/customer-accounts', function(req, res){
		if (req.session.user == null || req.session.user.admin == null || req.session.user.admin == undefined){
	        res.jsonp(403, {'msg':'Not Authorized'});
	    }else{
	    	var name = req.param('name');
	    	var add_line_1 = req.param('add_line_1');
	    	var add_line_2 = req.param('add_line_2');
	    	var landmark = req.param('landmark');
	    	var city = req.param('city');
	    	var pincode = req.param('pincode');
	    	var email = req.param('email');
	    	var pass = req.param('pass');
	    	var customerAccountData = {name:name,add_line_1:add_line_1, add_line_2:add_line_2, landmark:landmark, city:city, pincode:pincode};
	    	AM.addNewCustomerAccount(customerAccountData, {email:email, pass:pass}, function(e, o){
	    		if(o){
	    			res.jsonp({data:o});
	    		}else{
	    			res.jsonp(400, {msg:e});
	    		}
	    	})
	    }
	});

	/**
		To create a new device. Can be used both by Admin, and Customer
	**/
	app.post('/devices', function(req, res){
		if (req.session.user != null && (req.session.user.admin == 1 || req.session.user.customer_account_id != undefined)){
	        var data = {
				name:req.param('name'),
				add_line_1:req.param('add_line_1'), 
				add_line_2:req.param('add_line_2'), 
				landmark:req.param('landmark'), 
				city:req.param('city'), 
				username:req.param('username'), 
				password:req.param('password')
			};
	        if(req.session.user.admin != 1){
	        	data.customer_account_id = req.session.user.customer_account_id;
	        }else{
	        	data.customer_account_id = req.param('customer_account_id'); 
	        }
	        AM.addNewDevice(data, function(e, o){
	        	if(o){
	        		res.json(o);
	        	}else{
	        		res.json(400, e);
	        	}
	        });
	    }else{
	    	res.json(403, {'msg':'Not Authorized'});
	    }
	});

	
	/**
		To fetch devices based on customerAccountId. To be used by Admin only.
	**/
	app.get('/devices/:customerAccountId', function(req, res){
		if (req.session.user != null && req.session.user.admin == 1){
			var customerAccountId = req.param('customerAccountId');
	        AM.fetchDevices(customerAccountId, function(e, o){
	        	res.json(o);
	        });
		}else{
			res.json(403, {'msg':'Not Authorized'});
		}
	});

	/**
		To fetch devices of a customer. To be used by a logged in customer.
	**/
	app.get('/devices', function(req, res){
		if(req.session.user != null && req.session.user.customer_account_id != undefined){
			var customerAccountId = req.session.user.customer_account_id;
			AM.fetchDevices(customerAccountId, function(e, o){
	        	res.json(o);
	        })
		}else{
			res.json(403, {'msg':'Not Authorized'});
		}
	});



	//Access Requests
	app.post('/access/initiate-access-request', function(req, res){
	    if (req.session.user == null){
	        res.json(403, {'msg':'Not Authorized'});
	    }else{
	    	var latitude = req.param('latitude');
	    	var longitude = req.param('longitude');
	    	AccessManager.initiateAccessRequest(latitude, longitude, function(e, o){
	    		if(e){
	    			res.json(400, {msg:e});
	    		}else{
	    			res.json(o);
	    		}
	    	});
	    }
	});

	app.post('/access/create-access-request', function(req, res){
	    if (req.session.user == null){
	        res.json(403, {'msg':'Not Authorized'});
	    }else{
	    	var device_id = req.param('device_id');
	    	AccessManager.createAccessRequest(req.session.user._id, device_id, function(e, o){
	    		if(e){
	    			res.json(400, {msg:e});
	    		}else{
	    			res.json(o);
	    		}
	    	});
	    }
	});

	app.get('/access/new-requests', function(req, res){
		if(req.session.device != null){
			try{
				var deviceId = req.session.device._id;
				AccessManager.viewNewAccessRequests(deviceId, function(e, o){
					res.json(o);
				});
			}catch(err){
				res.jsonp(400, 'Device Id not correct');
			}
		}
	});

	
	app.get('/access/view-request/:requestId', function(req, res){
		if (req.session.user != null && req.session.user.admin == 1){
			var request_id = ObjectID(req.param('requestId'));
			AccessManager.viewRequest(request_id, function(e, o){
				if(e){
					res.json(400, {msg:e});
				}else{
					res.json(o);
				}
			});
		}else{
			res.json(403, 'Not Authorized');
		}
	});

	app.get('/access/view-request-on-device', function(req, res){
		console.log('new profile request from tablet');
		console.log(req.param('request_id'));
		if (req.session.device != null){
			var request_id = ObjectID(req.param('request_id'));
			var deviceId = req.session.device._id;
			AccessManager.viewRequestOnDevice(request_id, deviceId, function(e, o){
				if(e){
					res.json(400, {msg:e});
				}else{
					console.log(o);
					res.json(o);
				}
			});
		}else{
			res.json(403, 'Not Authorized');
		}
	});


	app.post('/access/grant-access', function(req, res){
		if (req.session.device != null){
			var request_id = req.param('request_id');
			var deviceId = req.session.device._id;
			
			AccessManager.grantAccess({device_id:deviceId, request_id:ObjectID(request_id)}, function(e, o){
				if(e){
					res.json(400, {msg:e});
				}else{
					res.json(o);
				}
			});
		}else{
			res.json(403, 'Not Authorized');
		}
	});

	app.post('/access/reject-access', function(req, res){
		if (req.session.device != null){
			var request_id = req.param('request_id');
                        var deviceId = req.session.device._id;
			
			AccessManager.rejectAccess({device_id:deviceId, request_id:ObjectID(request_id)}, function(e, o){
                                if(e){
                                        res.json(400, {msg:e});
                                }else{
                                        res.json(o);
                                }
                        });
		}else{
			res.json(403, 'Not Authorized');
		}
	


	});


	app.get('/access/logs/:deviceId', function(req, res){
		if (req.session.user != null && (req.session.user.admin == 1 || req.session.user.customer_account_id != undefined)){
			try{
				var deviceId = ObjectID(req.param('deviceId'))
			}catch(err){
				res.json(400, {msg:'Device id is not correct'});
				return;
			}
			if(req.session.user.customer_account_id != undefined){
				//Customer Account
				var customerAccountId = req.session.user.customer_account_id;
				AM.findDevice({_id:req.param('deviceId'), customer_account_id:customerAccountId}, function(e, o){
					if(e){
						res.json(400, {msg:'No device found'});
					}else{
						AccessManager.accessLogsForDevice(deviceId, function(e, o){
	        				res.json(o);
	        			});
					}
				});
			}else{
				//Admin
				AccessManager.accessLogsForDevice(deviceId, function(e, o){
	        		res.jsonp(o);
	        	});
			}
			
		}else if(req.session.device != null){
			var deviceId = req.session.device._id;
			AccessManager.accessLogsForDevice(deviceId, function(e, accessLogs){
	        	res.json(accessLogs);
	        });

		}else{
			res.json(403, {'msg':'Not Authorized'});
		}
	});
	
	app.get('*', function(req, res) { 
		res.jsonp(404, { msg: 'Page Not Found'}); 
	});

};
