(function() {
	var USE_MP4 = true;
	
	var gFrameCount = 0;
	var gBallX  = -19;
	var gBallY  = -90;
	var gBallYa = 0;
	var gOutBuffer = new nacl264.ExpandableBuffer();
	
	function listenNaClEvents() {
		var container = document.getElementById('nacl-container');
		container.addEventListener('load', onNaClModuleLoad, true);
		container.addEventListener('message', handleMessage, true);
	}
	
	function drawLabel(frameIndex) {
		var cv = document.getElementById('cv1');
		var g = cv.getContext('2d');
		
		g.font = '28px normal';
		g.fillStyle = "#fff";
		g.fillText("Encoded frame "+frameIndex, 8, 34);
	}
	
	function drawTestPattern(g) {
		g.fillStyle = "#000";
		g.fillRect(0, 0, 800, 600);
		
		g.fillStyle = "#fff";
		for (var i = 0;i < 30;++i) {
			g.fillRect(20, 20 + i*2, 110, 1);
			g.fillRect(130, 21 + i*2, 110, 1);
			g.fillRect(240, 21 + i*3, 110, 1);
		}
	}
	
	function drawTestPicture() {
		var baseY = 390;
		var ballRadius = 60;
		var cv = document.getElementById('cv1');
		var g = cv.getContext('2d');
//return drawTestPattern(g);
		var fg = window.floorGradient;
		var wg = window.wallGradient;
		var bg = window.ballGradient;
		var sg = window.shadowGradient;
		if (!fg) {
			fg = g.createLinearGradient(0, baseY, 0, 480);
			fg.addColorStop(0, '#c0c6cf');
			fg.addColorStop(1, '#f0f6ff');

			wg = g.createLinearGradient(0, 0, 0, baseY);
			wg.addColorStop(0, '#222');
			wg.addColorStop(0.8, '#333');
			wg.addColorStop(1, '#555');
			
			bg = g.createRadialGradient(-ballRadius/5, -ballRadius/2, 1, 0, -ballRadius/3, ballRadius*1.5);
			bg.addColorStop(0, '#fff');
			bg.addColorStop(0.06, '#89f');
			bg.addColorStop(0.3, '#25b');
			bg.addColorStop(0.6, '#128');
			bg.addColorStop(0.8, '#25b');
			bg.addColorStop(1, '#58d');

			sg = g.createRadialGradient(0, 0, ballRadius/2, 0, 0, ballRadius);
			sg.addColorStop(0, 'rgba(0,0,0,0.3)');
			sg.addColorStop(1, 'rgba(0,0,0,0)');
			
			window.floorGradient = fg;
			window.wallGradient = wg;
			window.ballGradient = bg;
			window.shadowGradient = sg;
		}
		
		g.fillStyle = wg;
		g.fillRect(0, 0, 640, baseY);

		g.fillStyle = fg;
		g.fillRect(0, baseY, 640, 480 - baseY);

		g.save();
		g.translate(gBallX, baseY + ballRadius);
		g.scale(1, 0.2);
		g.fillStyle = sg;
		g.beginPath();
		g.arc(0, 0, ballRadius, 0, Math.PI*2, false);
		g.fill();
		g.restore();

		g.save();
		g.translate(gBallX, gBallY);
		g.fillStyle = bg;
		g.beginPath();
		g.arc(0, 0, ballRadius, 0, Math.PI*2, false);
		g.fill();
		g.restore();

		gBallX += 1.25;
		gBallY += gBallYa;
		if (gBallY > baseY) {
			gBallY = baseY;
			gBallYa *= -0.8;
		}
		
		gBallYa += 0.8;
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
		nacl264.setOutputType(module, USE_MP4 ? 'mp4' : 'mkv');
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
			if (++gFrameCount <= 600) {
				drawTestPicture();
				nacl264.sendFrameFromCanvas(module, document.getElementById('cv1') );
				drawLabel(gFrameCount-1);
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
		var blob = gOutBuffer.exportBlob(USE_MP4 ? null : 'video/x-matroska');
		
		var a = document.getElementById('result-dl');
		a.style.display = 'block';
		a.href = window.URL.createObjectURL(blob);
		a.setAttribute('download', 'nacl264-generated.' + (USE_MP4 ? 'mp4' : 'mkv'));
		
		if (USE_MP4) {
			showPreviewVideo(a.href);
		}
	}
	
	function showPreviewVideo(videoURL) {
		var container = document.getElementById('preview-cell');
		var v = document.createElement('video');

		container.appendChild(v);
		v.src = videoURL;
		v.autoplay = 'autoplay';
		v.controls = 'controls';

		var source_canvas = document.getElementById('cv1');
		v.width = source_canvas.width | 0;
		v.height = source_canvas.height | 0;
	}
	
	listenNaClEvents();
})();