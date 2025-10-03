#[[# Project]]# ${artifactId}

This project uses Quarkus, the Supersonic Subatomic Java Framework.

If you want to learn more about Quarkus, please visit its website: https://quarkus.io/ .

#[[## Running the application in dev mode]]#

You can run your application in dev mode that enables live coding using:

```
mvn quarkus:dev
```

Accessing the app : `http://localhost:8090`

Accessing SwaggerUi : `http://localhost:8090/swagger-ui/`

Accessing openapi spec of camel rests : `http://localhost:8090/camel-openapi`

Accessing metrics : `http://localhost:8090/q/metrics`

#[[## Packaging and running the application]]#

The application can be packaged using `mvn package`.

The application is now runnable using `java -jar target/quarkus-app/quarkus-run.jar`.

#[[## Creating a native executable]]#

You can create a native executable using: `mvn package -Pnative`.

You can then execute your native executable with: `./target/${artifactId}-${version}-runner`

#[[## Run local container with specific network and IP address]]#

Optionally you can create a separate local docker network for this app

```
docker network create --driver=bridge --subnet=172.18.0.0/16 --gateway=172.18.0.1 primenet 
```

```
docker stop ${artifactId}
docker rm ${artifactId}
docker rmi ${artifactId}

docker build -f src/main/docker/Dockerfile.multiarch -t ${artifactId}:${version} .

docker run --rm ${artifactId}:${version}

docker run -d --net primenet --ip 172.18.0.10 --name ${artifactId} ${artifactId}:${version}
```

Launch multple instaces

```
NB_CONTAINERS=2

for (( i=0; i<$NB_CONTAINERS; i++ ))
do
    docker run -d --net primenet --ip 172.18.0.1$i --name ${artifactId}-$i ${artifactId}:${version}
done

for (( i=0; i<$NB_CONTAINERS; i++ ))
do
   docker stop ${artifactId}-$i
   docker rm ${artifactId}-$i
done

```


#[[## Push on registry and deploy on kube]]#

change to your registry and ingress root domain

```

export localregistry=registry.work.lan
export kube_ingress_root_domain=kube.loc 

mvn clean package -DskipTests

docker build -f src/main/docker/Dockerfile.multiarch -t ${artifactId}:${version} .
docker tag ${artifactId}:${version} ${localregistry}/${artifactId}:${version}
docker push ${localregistry}/${artifactId}:${version}

envsubst < src/main/kube/deploy.envsubst.yaml | kubectl delete -f -
envsubst < src/main/kube/deploy.envsubst.yaml | kubectl apply -f -

```



#[[##Dealing with SSL/TLS]]#

Generate some private keys and truststores

```
keytool -genkey \
    -alias ${artifactId}  \
    -storepass password \
    -keyalg RSA \
    -storetype PKCS12 \
    -dname "cn=${artifactId}" \
    -validity 365000 \
    -keystore tls/keystore.p12

keytool -export \
    -alias ${artifactId} \
    -rfc \
    -storepass password \
    -keystore tls/broker-keystore.p12 \
    -file tls/${artifactId}.pem

FILES=tls/trusted-certs/*
for f in $FILES
do
#[[    full="${f##*/}"]]#
#[[    extension="${full##*.}"]]#
#[[    filename="${full%.*}"]]#
    echo "importing $full in alias $filename"

    keytool -import \
        -alias $filename \
        -storepass password\
        -storetype PKCS12 \
        -noprompt \
        -keystore tls/truststore.p12 \
        -file $f
done

keytool -list -storepass password -keystore tls/keystore.p12 -v
keytool -list -storepass password -keystore tls/truststore.p12 -v

base64 tls/truststore.p12>tls/truststore.base64
base64 tls/keystore.p12>tls/keystore.base64

```