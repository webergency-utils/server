FROM gcr.io/oss-fuzz-base/base-builder-javascript
COPY . $SRC/server
WORKDIR $SRC/server
COPY .clusterfuzzlite/build.sh $SRC/build.sh
