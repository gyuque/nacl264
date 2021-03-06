# Copyright (c) 2013 The Chromium Authors. All rights reserved.
# Use of this source code is governed by a BSD-style license that can be
# found in the LICENSE file.

# GNU Makefile based on shared rules provided by the Native Client SDK.
# See README.Makefiles for more details.

#VALID_TOOLCHAINS := newlib glibc pnacl
VALID_TOOLCHAINS := pnacl

NACL_SDK_ROOT ?= $(abspath $(CURDIR)/../nacl_sdk/pepper_35/)

include $(NACL_SDK_ROOT)/tools/common.mk

TARGET = nacl264
DEPS = ppapi_simple
LIBS = ppapi_simple ppapi_cpp ppapi
NACL_CFLAGS = -Wno-long-long

LSMASH_SRC = lsmash/core/box.c      \
             lsmash/core/chapter.c  \
             lsmash/core/fragment.c \
             lsmash/core/isom.c     \
             lsmash/core/meta.c     \
             lsmash/core/print.c    \
             lsmash/core/read.c     \
             lsmash/core/summary.c  \
             lsmash/core/timeline.c \
             lsmash/core/write.c    \
             lsmash/codecs/a52.c         \
             lsmash/codecs/description.c \
             lsmash/codecs/h264.c        \
             lsmash/codecs/mp4a.c        \
             lsmash/codecs/vc1.c         \
             lsmash/codecs/alac.c        \
             lsmash/codecs/dts.c         \
             lsmash/codecs/hevc.c        \
             lsmash/codecs/mp4sys.c      \
             lsmash/common/alloc.c   \
             lsmash/common/bstream.c \
             lsmash/common/list.c    \
             lsmash/common/utils.c


CFLAGS = -Wall -I./x264 -I./lsmash -DLSMASH_DEMUXER_ENABLED
SOURCES = nacl264.cc \
          instance.cc \
          x264/common/bitstream.c \
          x264/common/cabac.c \
          x264/common/common.c \
          x264/common/cpu.c \
          x264/common/dct.c \
          x264/common/deblock.c \
          x264/common/frame.c \
          x264/common/macroblock.c \
          x264/common/mc.c \
          x264/common/mvpred.c \
          x264/common/osdep.c \
          x264/common/pixel.c \
          x264/common/predict.c \
          x264/common/quant.c \
          x264/common/rectangle.c \
          x264/common/set.c \
          x264/common/vlc.c \
          x264/encoder/analyse.c \
          x264/encoder/cabac.c \
          x264/encoder/cavlc.c \
          x264/encoder/encoder.c \
          x264/encoder/lookahead.c \
          x264/encoder/macroblock.c \
          x264/encoder/me.c \
          x264/encoder/ratecontrol.c \
          x264/encoder/set.c \
          x264/output/matroska.c \
          x264/output/mp4_lsmash.c \
          x264/output/matroska_ebml_b.c \
          $(LSMASH_SRC)


.PHONY: serve2
serve2: all
	$(HTTPD_PY) --no-dir-check -C $(CURDIR)


# Build rules generated by macros from common.mk:

$(foreach dep,$(DEPS),$(eval $(call DEPEND_RULE,$(dep))))
$(foreach src,$(SOURCES),$(eval $(call COMPILE_RULE,$(src),$(CFLAGS))))

ifeq ($(CONFIG),Release)
$(eval $(call LINK_RULE,$(TARGET)_unstripped,$(SOURCES),$(LIBS),$(DEPS)))
$(eval $(call STRIP_RULE,$(TARGET),$(TARGET)_unstripped))
else
$(eval $(call LINK_RULE,$(TARGET),$(SOURCES),$(LIBS),$(DEPS)))
endif

$(eval $(call NMF_RULE,$(TARGET),))
