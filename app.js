var express = require('express');
var app = express();
var fs = require('fs');
var serv = require('http').Server(app);

app.get('/', function(req, res){
    res.sendFile(__dirname + '/client/index.html');
});
app.use('/client', express.static(__dirname + '/client'));

serv.listen(80);
console.log("Server started.");

var SOCKET_LIST = {};
var TO_RADIANS = Math.PI/180; 

var Vector2 = {};

var Entity = function(){
	var self = {
		position: {x: 250, y: 250},
		velocity: {x: 0, y: 0},
		rotation: {x:0, y: 0},
		width: 100,
		height: 100,
		id: "",
	}

	self.update = function(){
		self.updatePosition();
	}

	self.updatePosition = function() {
		self.rotation = rotatingVector(self.velocity.x, self.velocity.y, self.angle);
		self.position.x += self.rotation.x;
		self.position.y += self.rotation.y;
	}
	return self;
}

	
function rotatingVector(vx, vy, angle){
	var firstX = vx;
	var firstY = vy;
	vx = firstX*Math.cos(angle*TO_RADIANS) - firstY*Math.sin(angle*TO_RADIANS);
	vy = firstX*Math.sin(angle*TO_RADIANS) + firstY*Math.cos(angle*TO_RADIANS);
	return {x: vx, y: vy};
}

var Player = function(id){
	var self = Entity();
	self.id = id;
	self.number = "" + Math.floor(10*Math.random());
	self.pressingRight = false;
	self.pressingLef = false;
	self.pressingUp = false;
	self.pressingDown = false;
	self.pressedLmb = false;
	self.pressedShift = false;
	self.isShooting = false;
	self.boosted = false;
	self.timerOfBoost = 0;
	self.maxSpd = 0.1;
	self.rotationSpd = 2.5;
	self.angle = 0;
	self.hp = 100;
	self.delay = 0;
	self.width = 100;
	self.height = 100;

	console.log("Player initialized with id = " + self.id);
	
	self.boost = function(){
		self.velocity.y *= 2;
		self.rotationSpd *= 2;
		self.boosted = true;
	}
	
	self.removeBoost = function(){
		self.velocity.y /= 2;
		self.rotationSpd /=2;
		self.boosted = false;
	}
	
	var super_update = self.update;
	self.update = function(){
		self.updateSpd();
		super_update();

		for(var i in Player.list){
        	var player = Player.list[i];
    		if(isCollide(self, player) && self.id != player.id){
    			player.rotation.x -= self.rotation.x;
    			player.rotation.y -= self.rotation.y;
    			self.position.y += player.rotation.x;
    			self.position.x += player.rotation.y;
    			self.hp -= 0.5;
    			player.hp -= 0.5;
    		}
    		console.log(Player.list[i].id);
    	} 

		if(self.hp <= 0){
			self.position.x = Math.floor((Math.random() * 600) + 1);
			self.position.y = Math.floor((Math.random() * 600) + 1);
			self.velocity.x = 0;
			self.velocity.y = 0;
			self.angle = 0;
			self.hp = 100;
		}

		if(self.isShooting && self.delay++ > 20){
			Bullet(self);
			self.delay = 0;
		}
	}

	self.updateSpd = function(){
		if(self.delay < 10){
			self.delay++;
		}
		if(self.pressingRight)
			self.angle += self.rotationSpd;
		else if(self.pressingLeft)
			self.angle -= self.rotationSpd;
			//else if( self.spdX != 0)
			//	self.spdX -= self.maxSpd;
			
		if(self.pressedShift && !self.boosted){
			self.timerOfBoost += 6;
			self.boost();
		}
		if(self.boosted){
			self.timerOfBoost -= 0.5;
			if(self.timerOfBoost <= 0)
				self.removeBoost();
		}
		if(self.pressingDown && self.velocity.y < 0)
			self.velocity.y += self.maxSpd;
		else if(self.pressingUp && self.velocity.y > -6)
			self.velocity.y -= self.maxSpd;
		else if(!self.pressingDown && !self.pressingUp && self.velocity.y < 0)
		{
			self.velocity.y += self.maxSpd/2;
		}
		if(self.velocity.y > 0){
			self.velocity.y = 0;
		}
			
	}

	Player.list[self.id] = self;

	initPack.player.push({
        id:self.id,
        position: self.position,  
        number: self.number,
        angle: self.angle,
        hp: self.hp,
        width: self.width,
        height: self.height
    });

	return self;
}

Player.list = {};

Player.onConnect = function(socket){
	var player = Player(socket.id);
	
	socket.on('keyPress',function(data){
		if(data.inputId === 'left')
			player.pressingLeft = data.state;
		else if(data.inputId === 'right')
			player.pressingRight = data.state;
		else if(data.inputId === 'up')
			player.pressingUp = data.state;
		else if(data.inputId === 'down')
			player.pressingDown = data.state;

		if(data.inputId === 'lmb'){
			if(!player.boosted){
				player.isShooting = data.state;
			}else{
				player.isShooting = false;
			}
		}
		
		if(data.inputId === 'lshift'){
			player.pressedShift = data.state;
			player.isShooting = false;
		}
	});
	socket.emit('self',{selfID: socket.id});
}

Player.onDisconnect = function(socket){
	delete Player.list[socket.id];
	removePack.player.push(socket.id);
}

Player.update = function(){
	var pack = [];
	for(var i in Player.list){
		var player = Player.list[i];
		player.update();
		pack.push({
			position: player.position, 
			number: player.number,
			angle: player.angle,
			id: player.id,
			hp: player.hp,
			width: player.width,
        	height: player.height
		});
	}
	return pack;
}



var Bullet = function(player){
	var self = Entity();
	self.id = Math.random();
	self.position.x = player.position.x+25;
	self.position.y = player.position.y+25;
	self.velocity.x = 0;
	self.velocity.y = -5+player.velocity.y;
	self.angle = player.angle;
	self.timer = 0;
	self.toRemove = false;
	self.ownerId = player.id;
	self.width = 21;
	self.height = 50;

    var super_update = self.update;
    self.update = function(){
    	for(var i in Player.list){
        	var player = Player.list[i];
    		if(isCollide(self, player) && self.ownerId != player.id){
    			player.hp -= 10;
    			self.toRemove = true;
    		}
    		console.log(Player.list[i].id);
    	}    
        if(self.timer++ > 100)
            self.toRemove = true;
        super_update();
	}

	initPack.bullet.push({
        id: self.id,
        position: self.position, 
        angle: self.angle,
        width: self.width,
        height: self.height
    });

	Bullet.list[self.id] = self;
	return self;
}

Bullet.list = {};

Bullet.update = function(){
	
	var pack = [];

	for(var i in Bullet.list){
        var bullet = Bullet.list[i];
        bullet.update();
        if(bullet.toRemove){
            delete Bullet.list[i];
            removePack.bullet.push(bullet.id);
        } else
            pack.push({
                id:bullet.id,
                position: bullet.position,
                angle: bullet.angle,
                width: bullet.width,
        		height: bullet.height

        });
    }
    return pack;
}

var io = require('socket.io')(serv,{});
io.sockets.on('connection', function(socket){
	socket.id = Math.random();
	SOCKET_LIST[socket.id] = socket;
	console.log("Socket connected with id = "+socket.id);
	Player.onConnect(socket);
	socket.on('disconnect', function(){
		delete SOCKET_LIST[socket.id];
		Player.onDisconnect(socket);
	});
});

var initPack = { player: [], bullet: [] };
var removePack = { player: [], bullet: [] };

setInterval(function(){
	var pack = {
		player: Player.update(),
		bullet: Bullet.update()
	}

	for(var i in SOCKET_LIST){
		var socket = SOCKET_LIST[i];
		socket.emit('init', initPack);
		socket.emit('update', pack);
		socket.emit('remove', removePack);
	}

	initPack.player = [];
    initPack.bullet = [];
    removePack.player = [];
    removePack.bullet = [];


}, 1000/60);

function isCollide(a, b) {
   	return !(((a.position.y + a.height) < (b.position.y)) || (a.position.y > (b.position.y + b.height)) || ((a.position.x + a.width) < b.position.x) || (a.position.x > (b.position.x + b.width)));
}