#ifndef INSTANCE_H_INCLUDED
#define INSTANCE_H_INCLUDED

#include "ppapi/cpp/instance.h"
#include "ppapi/cpp/module.h"
#include "ppapi/cpp/var.h"
#include "ppapi/cpp/var_dictionary.h"
#include "ppapi/cpp/var_array_buffer.h"

extern "C" {
#include "common/common.h"
#include "x264.h"
#include "x264cli.h"
#include "output/output.h"
}

class NaCl264Instance : public pp::Instance {
public:
	explicit NaCl264Instance(PP_Instance instance);
	virtual ~NaCl264Instance();
	virtual void HandleMessage(const pp::Var& var_message);
	
	void sendBufferedData(const void *buf, size_t size);
	void sendBufferSeek(long pos);
protected:
	int mNextPTS;
	
	int mMaxPTS;
	int mSecondPTS;
	
	x264_t* mX264;
	hnd_t mOutHandle;
	x264_param_t mEncoderParams;
	x264_picture_t mTempPicture;
	bool mTempPictureReady;

	void closeEncoder();
	void closeOutput();
	
	void dispatchCommand(const std::string& cmdName, const pp::VarDictionary& msg_dic);
	void doSetParamsCommand(pp::VarDictionary& dicParams);
	void doOpenEncoderCommand();
	void doCloseEncoderCommand();
	void doSendFrameCommand(pp::VarArrayBuffer& abPictureFrame);
	
	void openBufferOutput();
	void addFrame();
	void prepareTempPicture();
	void cleanTempPicture();
	
	void notifyFrameDone();
};

#endif