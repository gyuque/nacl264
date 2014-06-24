(function() {
	var gFrameCount = 0;
	var gOutBuffer = new nacl264.ExpandableBuffer();
	
	function listenNaClEvents() {
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
		g.arc(290+gFrameCount, 260, 80, 0, Math.PI*2, false);
		g.fill();
	}
	
	function onNaClModuleLoad() {
		var module = document.getElementById('nacl264-embed');
		
		console.log("NaCl module loaded.");
		nacl264.setEncoderParams(module, {
			fps: 30,
			width: 640,
			height: 480
		});
		
		drawTestPicture();
		nacl264.openEncoder(module);
		nacl264.sendFrameFromCanvas(module, document.getElementById('cv1') );
	}
	
	function handleMessage(message_event) {
		var module = document.getElementById('nacl264-embed');
		var mbody = message_event.data;
		var mtype = mbody.type;
		
		var M = nacl264.IncomingMessageTypes;
		switch(mtype) {
		case M.EncodeFrameDone:
			console.log("DONE");
			if (++gFrameCount < 130) {
				drawTestPicture();
				nacl264.sendFrameFromCanvas(module, document.getElementById('cv1') );
			} else {
				nacl264.closeEncoder(module);
			}
			
			break;

		case M.SendBufferedData:
			gOutBuffer.write(mbody.content);
			break;

		case M.SeekBuffer:
			gOutBuffer.seek(mbody.position);
			break;
			
		case M.EncoderClosed:
			makeSaveLink();
			break;
		}
	}
	
	function makeSaveLink() {
		var blob = gOutBuffer.exportBlob();
		
		var a = document.getElementById('result-dl');
		a.style.display = 'block';
		a.href = window.URL.createObjectURL(blob);
		a.setAttribute('download', 'nacl264-generated.mkv');
	}
	
	listenNaClEvents();
})();