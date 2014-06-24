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
//		sCLIOutput = mkv_output;
		return new NaCl264Module();
	}
}
