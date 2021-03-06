# if [ "${CAAT_DST}" == "" ]; then
#   echo CAAT_DST is not defined.
#   exit -1;
# fi
CAAT_DST='caat'

echo -e "\n\nCompilation process\n\n"


./version.compile.pack.sh


#
# define CAAT products files.
#
DST_FILE_NAME="${CAAT_DST}";

FILE_CAAT=build/"${DST_FILE_NAME}-min.js"
FILE_CAAT_CSS=build/"${DST_FILE_NAME}-css-min.js"
FILE_CAAT_BOX2D=build/"${DST_FILE_NAME}-box2d-min.js"

#
# DST_FILE is a file name.
# This script will produce different target files as follow:
#   + DST_FILE.js
#   + DST_FILE-css.js
#   + DST_FILE-box2d.js
#
echo "" > "${FILE_CAAT}"
echo "" > "${FILE_CAAT_CSS}"
echo "" > "${FILE_CAAT_BOX2D}"

SOURCE_DIR=/Users/yeungmoses/TestApp/git_project/CAAT/src
TOOL_DIR=/Users/yeungmoses/Documents/caat_tools

#
# set compilation level
#
COMPILATION_LEVEL=$1
if [ "${COMPILATION_LEVEL}" ]; then
  if [[ "${COMPILATION_LEVEL}" == "simple" ]]; then
    echo "Compilation level set to simple"
    COMPILATION_LEVEL="SIMPLE_OPTIMIZATIONS"
  elif [[ "${COMPILATION_LEVEL}" == "advanced" ]]; then
    echo "Compilation level set to advanced"
    COMPILATION_LECEL="ADVANCED_OPTIMIZATIONS"
  elif [[ "${COMPILATION_LEVEL}" == "spaces" ]]; then
    echo "Compilation level set to white spaces"
    COMPILATION_LEVEL="WHITESPACE_ONLY"
  else
    echo "Compilation level unknown: '${COMPILATION_LEVEL}'. Change to SIMPLE_OPTIMIZATIONS"
    COMPILATION_LEVEL="SIMPLE_OPTIMIZATIONS"
  fi
else
  echo "Compilation level defaults to simple optimizations."
  COMPILATION_LEVEL="SIMPLE_OPTIMIZATIONS"
fi

#
# execute version procedure. 
# version.nfo contains new version value.
#
./version.sh
VERSION=`cat version.nfo`
echo "New generated version: ${VERSION}"
echo "Generated at: ${DST_FILE_NAME}"
echo "From files at: ${SOURCE_DIR}"

#
# create stub files for all CAAT products.
#
echo -e "/*" >> "${FILE_CAAT}"
cat LICENSE >> "${FILE_CAAT}"
echo -e "\nVersion: ${VERSION}\n" >> "${FILE_CAAT}"
echo -e "Created on:" >> "${FILE_CAAT}"
date "+DATE: %Y-%m-%d%nTIME: %H:%M:%S" >> "${FILE_CAAT}"
echo -e "*/\n\n" >> "${FILE_CAAT}"

echo -e "/*" >> "${FILE_CAAT_CSS}"
cat LICENSE >> "${FILE_CAAT_CSS}"
echo -e "\nVersion: ${VERSION}\n" >> "${FILE_CAAT_CSS}"
echo -e "Created on:" >> "${FILE_CAAT_CSS}"
date "+DATE: %Y-%m-%d%nTIME: %H:%M:%S" >> "${FILE_CAAT_CSS}"
echo -e "*/\n\n" >> "${FILE_CAAT_CSS}"

echo -e "/*" >> "${FILE_CAAT_BOX2D}"
cat LICENSE >> "${FILE_CAAT_BOX2D}"
echo -e "\nVersion: ${VERSION}\n" >> "${FILE_CAAT_BOX2D}"
echo -e "Created on:" >> "${FILE_CAAT_BOX2D}"
date "+DATE: %Y-%m-%d%nTIME: %H:%M:%S" >> "${FILE_CAAT_BOX2D}"
echo -e "*/\n\n" >> "${FILE_CAAT_BOX2D}"


#
# Compile canvas/GL
#
echo -e "\nCreating CAAT canvas/webGL"
/usr/bin/java -jar "${TOOL_DIR}"/closure/compiler.jar --compilation_level "${COMPILATION_LEVEL}" \
--js build/caat.js \
 >> "${FILE_CAAT}"

#
# Compile box2d
#
echo "Creating CAAT Box2d"
 /usr/bin/java -jar "${TOOL_DIR}"/closure/compiler.jar --compilation_level "${COMPILATION_LEVEL}" --js build/caat-box2d.js >> "${FILE_CAAT_BOX2D}"

#
# Compile css
#
echo "Creating CAAT CSS"
echo -e "CAAT.__CSS__=1;" >> /tmp/__css.js
java -jar "${TOOL_DIR}"/closure/compiler.jar --compilation_level "${COMPILATION_LEVEL}" \
 --js build/caat-css.js >> "${FILE_CAAT_CSS}"

#
# Distribute resulting compiled files
#
echo -e "\nCopying:"
while read LINE; do
  echo -e "\tCopying results to ${LINE}"
  cp ${FILE_CAAT} ${LINE} 
  cp ${FILE_CAAT_CSS} ${LINE} 
  cp ${FILE_CAAT_BOX2D} ${LINE} 
done < version.distribution

#./version.compile.pack.sh

#
# Generating JSDoc.
#
echo -e "\nGenerating JSDoc"
./version.compile.doc.sh
