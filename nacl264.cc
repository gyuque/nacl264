// nacl264 - x264 on Google Native Client
// 2014.06 Satoshi Ueyama
// distributed under GPL

#include "instance.h"
#include <stdio.h>
#include <math.h>

class NaCl264Module : public pp::Module {
public:
	NaCl264Module() : pp::Module() {}
	virtual ~NaCl264Module() {}

	virtual pp::Instance* CreateInstance(PP_Instance instance) {
		return new NaCl264Instance(instance);
	}
};

namespace pp {
	Module* CreateModule() {
		return new NaCl264Module();
	}
}
