#!/bin/sh

SCRIPT_DIR=$(dirname $0)

mvn -f $SCRIPT_DIR/../../java-spring-boot/pom.xml install
mvn -f $SCRIPT_DIR/../../java-plain/pom.xml install
mvn -f $SCRIPT_DIR/../../java-spring-boot-camel/pom.xml install
mvn -f $SCRIPT_DIR/../../java-quarkus-camel/pom.xml install


rm /usr/local/bin/jcamelquarkus
cp $SCRIPT_DIR/jcamelquarkus.sh /usr/local/bin/jcamelquarkus
chmod 755 /usr/local/bin/jcamelquarkus

rm /usr/local/bin/jcamelspring
cp $SCRIPT_DIR/jcamelspring.sh /usr/local/bin/jcamelspring
chmod 755 /usr/local/bin/jcamelspring

rm /usr/local/bin/jplain
cp $SCRIPT_DIR/jplain.sh /usr/local/bin/jplain
chmod 755 /usr/local/bin/jplain

rm /usr/local/bin/jspring
cp $SCRIPT_DIR/jspring.sh /usr/local/bin/jspring
chmod 755 /usr/local/bin/jspring

echo "done"