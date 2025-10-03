#!/bin/sh

SCRIPT_DIR=$(dirname $0)

# JAVA
mvn -f $SCRIPT_DIR/../../java-spring-boot/pom.xml install
mvn -f $SCRIPT_DIR/../../java-plain/pom.xml install
mvn -f $SCRIPT_DIR/../../java-spring-boot-camel/pom.xml install
mvn -f $SCRIPT_DIR/../../java-quarkus-camel/pom.xml install


if [ -f /usr/local/bin/jcamelquarkus ]; then
sudo rm /usr/local/bin/jcamelquarkus
fi

sudo cp $SCRIPT_DIR/jcamelquarkus.sh /usr/local/bin/jcamelquarkus
sudo chmod 755 /usr/local/bin/jcamelquarkus

if [ -f /usr/local/bin/jcamelspring ]; then
sudo rm /usr/local/bin/jcamelspring
fi
sudo cp $SCRIPT_DIR/jcamelspring.sh /usr/local/bin/jcamelspring
sudo chmod 755 /usr/local/bin/jcamelspring

if [ -f /usr/local/bin/jplain ]; then
sudo rm /usr/local/bin/jplain
fi
sudo cp $SCRIPT_DIR/jplain.sh /usr/local/bin/jplain
sudo chmod 755 /usr/local/bin/jplain

if [ -f /usr/local/bin/jspring ]; then
sudo rm /usr/local/bin/jspring
fi
sudo cp $SCRIPT_DIR/jspring.sh /usr/local/bin/jspring
sudo chmod 755 /usr/local/bin/jspring


# zip template generator
mkdir -p ~/.m2/repository/net/alainpham/applate/templategen/
rm -r ~/.m2/repository/net/alainpham/applate/templategen/*
cp -R  $SCRIPT_DIR/../templategen/* ~/.m2/repository/net/alainpham/applate/templategen/
# Run npm install in the templategen directory
npm install --prefix ~/.m2/repository/net/alainpham/applate/templategen/ 

# nodejs

if [ -f ~/.m2/repository/net/alainpham/applate/nodejs-express/nodejs-express.zip ]; then
rm ~/.m2/repository/net/alainpham/applate/nodejs-express/nodejs-express.zip
fi

mkdir -p ~/.m2/repository/net/alainpham/applate/nodejs-express/
rm -r ~/.m2/repository/net/alainpham/applate/nodejs-express/*
zip -r ~/.m2/repository/net/alainpham/applate/nodejs-express/nodejs-express.zip $SCRIPT_DIR/../../nodejs-express -x '*node_modules*'

if [ -f /usr/local/bin/njsexpress ]; then
sudo rm /usr/local/bin/njsexpress
fi
sudo cp $SCRIPT_DIR/njsexpress.sh /usr/local/bin/njsexpress
sudo chmod 755 /usr/local/bin/njsexpress

echo "done"