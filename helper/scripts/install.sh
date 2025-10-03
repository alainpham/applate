#!/bin/sh
rm /usr/local/bin/jcamelquarkus
cp jcamelquarkus.sh /usr/local/bin/jcamelquarkus
chmod 755 /usr/local/bin/jcamelquarkus

rm /usr/local/bin/jcamelspring
cp jcamelspring.sh /usr/local/bin/jcamelspring
chmod 755 /usr/local/bin/jcamelspring

rm /usr/local/bin/jplain
cp jplain.sh /usr/local/bin/jplain
chmod 755 /usr/local/bin/jplain

rm /usr/local/bin/jspring
cp jspring.sh /usr/local/bin/jspring
chmod 755 /usr/local/bin/jspring

echo "done"