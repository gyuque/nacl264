// nacl264 - x264 on Google Native Client
// 2014.06 Satoshi Ueyama
// distributed under GPL

#include "instance.h"
static cli_output_t sCLIOutput;

extern "C" {
#include "output/matroska_ebml.h"
int mk_set_buffer_writer(hnd_t handle, mk_flush_proc fp, mk_seek_proc sp, void* user_data);
void mp4_set_buffer_writer(mp4CustomWriteFunction write_f, mp4CustomSeekFunction seek_f, void* opaque);
}

static size_t mkFlush(const void *buf, size_t size, void* user_data);
static size_t mkSeek(long pos, void* user_data);
static int mp4WriteBuffer(void *opaque, uint8_t *buf, int size);
static int64_t mp4SeekBuffer(void *opaque, int64_t offset, int whence);

// Tiny logger implementation
extern "C" void x264_cli_log( const char *name, int i_level, const char *fmt, ... ) {
	va_list arg;
	va_start( arg, fmt );
	vprintf(fmt, arg);
	va_end( arg );
}

// x264 Binding - - - - - - - -
NaCl264Instance::NaCl264Instance(PP_Instance instance) : 
	pp::Instance(instance),
	mNextPTS(0),mMaxPTS(0),mSecondPTS(0),
	mX264(NULL),
	mOutHandle(NULL),
	mTempPictureReady(false) {
	sCLIOutput = mkv_output;
	//x264_param_default(&mEncoderParams);
	x264_param_default_preset(&mEncoderParams, "fast", "grain");
	
	mContainerType = kContainerTypeMKV;
	mEncoderParams.i_fps_num = 30;
	mEncoderParams.i_fps_den = 1;
	mEncoderParams.i_width = 320;
	mEncoderParams.i_height = 240;
	mEncoderParams.b_annexb = 0;
	mEncoderParams.b_repeat_headers = 0;
	mEncoderParams.i_keyint_max = 50;
	
	x264_param_apply_profile(&mEncoderParams, "main");
}
		
NaCl264Instance::~NaCl264Instance() {
	cleanTempPicture();
	closeEncoder();
}

void NaCl264Instance::prepareTempPicture() {
	cleanTempPicture(); // clean old one
	
	x264_picture_init(&mTempPicture);
	x264_picture_alloc(&mTempPicture, X264_CSP_I420, mEncoderParams.i_width, mEncoderParams.i_height);
	mTempPictureReady = true;
}

void NaCl264Instance::cleanTempPicture() {
	if (mTempPictureReady) {
		x264_picture_clean(&mTempPicture);
		mTempPictureReady = false;
	}
}

void NaCl264Instance::HandleMessage(const pp::Var& var_message) {
	// message should be:
	// {
	//  command: 'command-name',
	//  foo: 1,
	//  bar: { ... }
	// }
	if (var_message.is_dictionary()) {
		pp::VarDictionary root_dic(var_message);
		if (root_dic.HasKey("command")) {
			pp::Var vCommand = root_dic.Get("command");
			if (vCommand.is_string()) {
				dispatchCommand(vCommand.AsString(), root_dic); 
			}
		}
	}
}

void NaCl264Instance::dispatchCommand(const std::string& cmdName, const pp::VarDictionary& msg_dic) {
	if (cmdName.compare("set-params") == 0) {
		if (msg_dic.HasKey("params")) {
			pp::Var vParams = msg_dic.Get("params");
			pp::VarDictionary dicParams(vParams);
			
			doSetParamsCommand(dicParams);
		}
	} else if (cmdName.compare("open-encoder") == 0) {
		doOpenEncoderCommand();
	} else if (cmdName.compare("close-encoder") == 0) {
		doCloseEncoderCommand();
	} else if (cmdName.compare("send-frame") == 0) {
		pp::Var vFrame = msg_dic.Get("frame");
		if (vFrame.is_array_buffer()) {
			pp::VarArrayBuffer ab(vFrame);
			doSendFrameCommand(ab);
		}
	} else if (cmdName.compare("set-output-type") == 0) {
		pp::Var vType = msg_dic.Get("type");
		if (vType.is_string()) {
			doSetOutputTypeCommand(vType);
		}
	}
}

// Set encoder parameters (Overwrite default if entry exists)
void NaCl264Instance::doSetParamsCommand(pp::VarDictionary& dicParams) {
	puts("set-params");
	if (dicParams.HasKey("fps")) {
		pp::Var v = dicParams.Get("fps");
		if (v.is_int()) {
			mEncoderParams.i_fps_num = v.AsInt();
			printf("  fps:%d\n", v.AsInt());
		}
	}

	if (dicParams.HasKey("width")) {
		pp::Var v = dicParams.Get("width");
		if (v.is_int()) {
			mEncoderParams.i_width = v.AsInt();
			printf("  width:%d\n", v.AsInt());
		}
	}

	if (dicParams.HasKey("height")) {
		pp::Var v = dicParams.Get("height");
		if (v.is_int()) {
			mEncoderParams.i_height = v.AsInt();
			printf("  height:%d\n", v.AsInt());
		}
	}
}

static inline int calcYUV_Y(int r, int g, int b) {
	const float fR = (float)r / 255.0f;
	const float fG = (float)g / 255.0f;
	const float fB = (float)b / 255.0f;
	
	const float fY = 0.299f * fR + 0.587f * fG + 0.114f * fB;
	const int iY = fY * 255.0f;
	
	return (iY > 255) ? 255 : iY;
}

static inline int calcYUV_U(int r, int g, int b) {
	const float fR = (float)r / 255.0f;
	const float fG = (float)g / 255.0f;
	const float fB = (float)b / 255.0f;

	const float f = -0.14713f*fR - 0.28886f*fG + 0.436f*fB;
	const int i = (f * 255.0f) + 128;
	if (i < 0) { return 0; }
	
	return (i > 255) ? 255 : i;
}

static inline int calcYUV_V(int r, int g, int b) {
	const float fR = (float)r / 255.0f;
	const float fG = (float)g / 255.0f;
	const float fB = (float)b / 255.0f;

	const float f = 0.615f*fR - 0.51499f*fG - 0.10001f*fB;
	const int i = (f * 255.0f) + 128;
	if (i < 0) { return 0; }
	
	return (i > 255) ? 255 : i;
}

void NaCl264Instance::doSetOutputTypeCommand(const pp::Var& vstrType) {
	const std::string& s = vstrType.AsString();
	if (s.at(2) == '4') {
		puts("Change container type to 'mp4'");
		mContainerType = kContainerTypeMP4;
	} else {
		puts("Change container type to 'mkv'");
		mContainerType = kContainerTypeMKV;
	}
}

void NaCl264Instance::doSendFrameCommand(pp::VarArrayBuffer& abPictureFrame) {
	const uint32_t w = mEncoderParams.i_width;
	const uint32_t h = mEncoderParams.i_height;
	const uint32_t len = abPictureFrame.ByteLength();
	const uint32_t nRows = (len / 3) / w;
	uint32_t x, y;
	const unsigned char* p = (const unsigned char*) abPictureFrame.Map();

	if (nRows < h) {
		puts("Error: too few rows");
		return;
	}
	
	puts("Convert RGB->YUV");
	
	x264_image_t* outImage = &mTempPicture.img;
    uint8_t* pY0 = outImage->plane[0];
    uint8_t* pU0 = outImage->plane[1];
    uint8_t* pV0 = outImage->plane[2];

	const uint32_t pitch = w*3;
	const uint32_t hh = h >> 1;
	const uint32_t hw = w >> 1;
	uint32_t pos1  = 0;
	uint32_t pos2 = pitch;
	for (y = 0;y < hh;++y) {
	    uint8_t* pY1 = pY0 + outImage->i_stride[0] * (y << 1);
	    uint8_t* pY2 = pY0 + outImage->i_stride[0] * ((y<<1) + 1);
	    uint8_t* pU = pU0 + outImage->i_stride[1] * y;
	    uint8_t* pV = pV0 + outImage->i_stride[2] * y;

		for (x = 0;x < hw;++x) {
			const int cR11 = p[pos1++];
			const int cG11 = p[pos1++];
			const int cB11 = p[pos1++];
			const int cR12 = p[pos1++];
			const int cG12 = p[pos1++];
			const int cB12 = p[pos1++];
			
			const int Y11 = calcYUV_Y(cR11, cG11, cB11);
			const int Y12 = calcYUV_Y(cR12, cG12, cB12);
			*pY1++ = Y11;
			*pY1++ = Y12;
			*pU++ = (calcYUV_U(cR11, cG11, cB11) + calcYUV_U(cR12, cG12, cB12)) >> 1;

			const int cR21 = p[pos2++];
			const int cG21 = p[pos2++];
			const int cB21 = p[pos2++];
			const int cR22 = p[pos2++];
			const int cG22 = p[pos2++];
			const int cB22 = p[pos2++];

			const int Y21 = calcYUV_Y(cR21, cG21, cB21);
			const int Y22 = calcYUV_Y(cR22, cG22, cB22);
			*pY2++ = Y21;
			*pY2++ = Y22;
			*pV++ = (calcYUV_V(cR21, cG21, cB21) + calcYUV_V(cR22, cG22, cB22)) >> 1;
		}
		
		pos1  += pitch;
		pos2  += pitch;
	}
	
	abPictureFrame.Unmap();
	addFrame();
}

void NaCl264Instance::addFrame() {
	x264_picture_t out_pic;
	x264_nal_t *nal;
	int i_nal;
	int i_frame_size = 0;
	
	// Set PTS
	mTempPicture.i_pts = mNextPTS++;
	
	if (mTempPicture.i_pts > mMaxPTS) {
		mSecondPTS = mMaxPTS;
		mMaxPTS = mTempPicture.i_pts;
	}
    
	i_frame_size = x264_encoder_encode(mX264, &nal, &i_nal, &mTempPicture, &out_pic );
	printf("Added to encoder [PTS=%d] ", mNextPTS-1);
	if( i_frame_size && mOutHandle ) {
		printf(" -> output");
		i_frame_size = sCLIOutput.write_frame(mOutHandle, nal[0].p_payload, i_frame_size, &out_pic);
	}
	
	printf(".\n");
	notifyFrameDone();
}

void NaCl264Instance::notifyFrameDone() {
	pp::VarDictionary msg;
	msg.Set( pp::Var("type") , pp::Var("encode-frame-done") );
	
	PostMessage(msg);
}

void NaCl264Instance::notifyEncoderClosed() {
	pp::VarDictionary msg;
	msg.Set( pp::Var("type") , pp::Var("encoder-closed") );
	
	PostMessage(msg);
}

void NaCl264Instance::doOpenEncoderCommand() {
	prepareTempPicture();
	closeEncoder();
	mNextPTS = 0;

	mX264 = x264_encoder_open(&mEncoderParams);
	openBufferOutput();

    x264_encoder_parameters(mX264, &mEncoderParams);
	sCLIOutput.set_param(mOutHandle, &mEncoderParams);
	
	{
		// Write SPS/PPS/SEI
		x264_nal_t *headers;
		int i_nal;

		x264_encoder_headers(mX264, &headers, &i_nal);
		sCLIOutput.write_headers(mOutHandle, headers);
	}
}

void NaCl264Instance::openBufferOutput() {
	char outFilename[2] = "+";

    if (mContainerType == kContainerTypeMP4) {
		mp4_set_buffer_writer(mp4WriteBuffer, mp4SeekBuffer, this);
		sCLIOutput = mp4_output;
	} else {
		sCLIOutput = mkv_output;
	}

	cli_output_opt_t output_opt;
	output_opt.use_dts_compress = 0;
	sCLIOutput.open_file(outFilename, &mOutHandle, &output_opt );

    if (mContainerType == kContainerTypeMKV) {
		mk_set_buffer_writer(mOutHandle, mkFlush, mkSeek, this);
	}
}

void NaCl264Instance::closeOutput() {
	if (mOutHandle) {
		sCLIOutput.close_file(mOutHandle, mMaxPTS, mSecondPTS);
		mOutHandle = NULL;
	}
}

void NaCl264Instance::doCloseEncoderCommand() {
	cleanTempPicture();
	closeEncoder();

	closeOutput();
	notifyEncoderClosed();
}

void NaCl264Instance::closeEncoder() {
	if (mX264) {
		x264_encoder_close(mX264);
		mX264 = NULL;
	}
}

void NaCl264Instance::sendBufferedData(const void *buf, size_t size) {
	pp::VarArrayBuffer ab((uint32_t)size);
	unsigned char* pWrite = static_cast<unsigned char*>(ab.Map());

	memcpy(pWrite, buf, size);

	// Send
	pp::VarDictionary dic;
	dic.Set( pp::Var("content"), ab );
	dic.Set( pp::Var("type"), pp::Var("send-buffered-data") );
	PostMessage(dic);

	ab.Unmap();
}

int NaCl264Instance::sendBufferSeek(long pos, int seek_origin) {
	if (seek_origin != SEEK_SET) {
		puts("** WARNING! bad seek origin **");
		return -1;
	}
	
	pp::VarDictionary dic;
	dic.Set( pp::Var("position"), pp::Var((int32_t)pos) );
	dic.Set( pp::Var("type"), pp::Var("seek-buffer") );

	PostMessage(dic);
	return 0;
}

// bridge functions
size_t mkFlush(const void *buf, size_t size, void* user_data) {
	NaCl264Instance* that = static_cast<NaCl264Instance*>(user_data);
	that->sendBufferedData(buf, size);
	return size;
}

size_t mkSeek(long pos, void* user_data) {
	NaCl264Instance* that = static_cast<NaCl264Instance*>(user_data);
	return (size_t)that->sendBufferSeek(pos, SEEK_SET);
}

int mp4WriteBuffer(void *opaque, uint8_t *buf, int size) {
	return mkFlush(buf, size, opaque); 
}

int64_t mp4SeekBuffer(void *opaque, int64_t offset, int whence) {
	NaCl264Instance* that = static_cast<NaCl264Instance*>(opaque);
	return (int64_t)that->sendBufferSeek(offset, whence);
}

