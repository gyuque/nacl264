(function() {
	var gFrameCount = 0;
	
	function listenNaClEvents() {
		drawTestPicture();
		
		var container = document.getElementById('nacl-container');
		container.addEventListener('load', onNaClModuleLoad, true);
		container.addEventListener('message', handleMessage, true);
	}
	
	function drawTestPicture() {
		var cv = document.getElementById('cv1');
		var g = cv.getContext('2d');
		g.fillStyle = "#000";
		g.fillRect(0, 0, 640, 480);

		g.fillStyle = "#35f";
		g.beginPath();
		g.arc(200, 200, 120, 0, Math.PI*2, false);
		g.fill();

		g.fillStyle = "#9f8";
		g.beginPath();
		g.arc(290, 260, 80, 0, Math.PI*2, false);
		g.fill();
	}
	
	function onNaClModuleLoad() {
		var module = document.getElementById('nacl264-embed');
		
		console.log("NaCl module loaded.");
		nacl264_setEncoderParams(module, {
			fps: 30,
			width: 640,
			height: 480
		});
		
		nacl264_openEncoder(module);
		nacl264_sendFrameFromCanvas(module, document.getElementById('cv1') );
	}
	
	function handleMessage(message_event) {
		var module = document.getElementById('nacl264-embed');
		var mbody = message_event.data;
		var mtype = mbody.type;
		
		switch(mtype) {
		case 'encode-frame-done':
			console.log("DONE");
			if (++gFrameCount < 130) {
				nacl264_sendFrameFromCanvas(module, document.getElementById('cv1') );
			} else {
				nacl264_closeEncoder(module);
			}
			
			break;
		}
	}
	
	function nacl264_setEncoderParams(module, params) {
		module.postMessage({
			command: "set-params",
			params: params
		});
	}

	function nacl264_openEncoder(module) {
		module.postMessage({command: "open-encoder"});
	}

	function nacl264_closeEncoder(module) {
		module.postMessage({command: "close-encoder"});
	}
	
	function nacl264_sendFrameFromCanvas(module, canvas) {
		var g = canvas.getContext('2d');
		var w = canvas.width | 0;
		var h = canvas.height | 0;
		
		var idat = g.getImageData(0, 0, w, h);
		var pixels = idat.data;
		var len = w*3 * h;
		
		var ab = new ArrayBuffer(len);
		var u8_array = new Uint8Array(ab);
		var readPos = 0;
		var writePos = 0;
		for (var y = 0;y < h;++y) {
			for (var x = 0;x < w;++x) {
				u8_array[writePos++] = pixels[readPos++];
				u8_array[writePos++] = pixels[readPos++];
				u8_array[writePos++] = pixels[readPos++];
				++readPos;
			}
		}
		
		module.postMessage({
			command: "send-frame",
			frame: ab
		});
	}
	
	listenNaClEvents();
})();