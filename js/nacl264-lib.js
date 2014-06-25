// nacl264 - x264 on Google Native Client
// 2014.06 Satoshi Ueyama
// distributed under GPL

(function(aGlobal) {
	'use strict';

	var IncomingMessageTypes = {
		EncodeFrameDone: 'encode-frame-done',
		SendBufferedData: 'send-buffered-data',
		SeekBuffer: 'seek-buffer',
		EncoderClosed: 'encoder-closed'
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
	
	function ExpandableBuffer() {
		this.ab = new ArrayBuffer(256);
		this.pos = 0;
		this.maxPos = 0;
	}
	
	ExpandableBuffer.prototype = {
		write: function(sourceArrayBuffer) {
			var write_len = sourceArrayBuffer.byteLength;
		
			var required = this.pos + write_len;
			if (required > this.ab.byteLength) {
				this.expand(required * 2);
			}
			
			var pRead  = new Uint8Array(sourceArrayBuffer);
			var pWrite = new Uint8Array(this.ab);
			for (var i = 0;i < write_len;++i) {
				pWrite[this.pos++] = pRead[i];
			}
			
			if (this.pos > this.maxPos) {
				this.maxPos = this.pos;
			}
		},
		
		seek: function(pos) {
			this.pos = pos | 0;
		},
		
		expand: function(newLength) {
			var old = this.ab;
			var olen = old.byteLength;
			this.ab = new ArrayBuffer(newLength);
			
			var pRead  = new Uint8Array(old);
			var pWrite = new Uint8Array(this.ab);
			for (var i = 0;i < olen;++i) {
				pWrite[i] = pRead[i];
			}
		},
		
		exportBlob: function() {
			var exportLen = this.maxPos;
			var exportBuffer = new ArrayBuffer(exportLen);
			var pWrite = new Uint8Array(exportBuffer);
			var pRead  = new Uint8Array(this.ab);
			
			for (var i = 0;i < exportLen;++i) {
				pWrite[i] = pRead[i];
			}
			
			return new Blob([exportBuffer], {type: 'video/x-matroska'});
		}
	};

	// export - - - - - - - - - - - - - - - - - - - - - - - - -
	aGlobal.nacl264 = {
		setEncoderParams:    nacl264_setEncoderParams,
		openEncoder:         nacl264_openEncoder,
		closeEncoder:        nacl264_closeEncoder,
		sendFrameFromCanvas: nacl264_sendFrameFromCanvas,
		
		IncomingMessageTypes: IncomingMessageTypes,
		OutgoingMessageTypes: OutgoingMessageTypes,
		ExpandableBuffer: ExpandableBuffer
	};
})(window);
