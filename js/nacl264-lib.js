(function(aGlobal) {
	'use strict';

	var IncomingMessageTypes = {
		EncodeFrameDone: 'encode-frame-done',
		SendBufferedData: 'send-buffered-data',
		SeekBuffer: 'seek-buffer'
	};

	var OutgoingMessageTypes = {
		SetParams: 'set-params',
		OpenEncoder: 'open-encoder',
		CloseEncoder: 'close-encoder',
		SendFrame: 'send-frame'
	};


	function nacl264_setEncoderParams(module, params) {
		module.postMessage({
			command: OutgoingMessageTypes.SetParams,
			params: params
		});
	}

	function nacl264_openEncoder(module) {
		module.postMessage({command: OutgoingMessageTypes.OpenEncoder});
	}

	function nacl264_closeEncoder(module) {
		module.postMessage({command: OutgoingMessageTypes.CloseEncoder});
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
			command: OutgoingMessageTypes.SendFrame,
			frame: ab
		});
	}

	// export - - - - - - - - - - - - - - - - - - - - - - - - -
	aGlobal.nacl264 = {
		setEncoderParams:    nacl264_setEncoderParams,
		openEncoder:         nacl264_openEncoder,
		closeEncoder:        nacl264_closeEncoder,
		sendFrameFromCanvas: nacl264_sendFrameFromCanvas,
		
		IncomingMessageTypes: IncomingMessageTypes,
		OutgoingMessageTypes: OutgoingMessageTypes
	};
})(window);
