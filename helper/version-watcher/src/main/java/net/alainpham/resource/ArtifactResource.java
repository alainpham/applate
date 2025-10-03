package net.alainpham.resource;

import java.util.List;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.inject.Named;
import jakarta.persistence.EntityManager;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;

import com.fasterxml.jackson.core.JsonProcessingException;

import org.apache.camel.ProducerTemplate;

import net.alainpham.ViewUpdate;
import net.alainpham.model.Artifact;

@Path("/artifacts")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Transactional
@ApplicationScoped
@Named("artifactResource")
public class ArtifactResource {

    @Inject
    EntityManager em;

    @Inject
    ProducerTemplate producer;
    
    @Inject
    ViewUpdate viewUpdate;

    @GET
    @Path("/check")
    public List<Artifact> check(){
        List<Artifact> artifacts = Artifact.listAll();
        for (Artifact artifact : artifacts) {
            // get current resource where version is written
            String response = producer.requestBody(artifact.currentVersionResource,null,String.class);

            // extract version from resource
            artifact.currentVersion = producer.requestBody(artifact.currentVersionExpression, response, String.class);
            
            System.out.println("current version " + artifact.currentVersion);

            if (artifact.coordinates.startsWith("mvn:")){
                String groupId = artifact.coordinates.split(":")[1].replaceAll("\\.", "/");
                String artifactId = artifact.coordinates.split(":")[2];
                String artifactResource = "https://repo.maven.apache.org/maven2/" + groupId + "/" + artifactId + "/maven-metadata.xml";
                String artifactResourceContent = producer.requestBody(artifactResource,null,String.class);

                String xpath = "language:xpath://version[matches(.,'"+ artifact.latestVersionFilter +"')][last()]/text()";
                System.out.println("xpath " + xpath);

                String latestVersion = producer.requestBody("language:xpath://version[matches(.,'"+ artifact.latestVersionFilter +"')][last()]/text()",artifactResourceContent,String.class);
                artifact.latestAndGreatest = producer.requestBody("language:xpath://latest/text()",artifactResourceContent,String.class);
                System.out.println("latest version " + latestVersion);
                artifact.latestVersion = latestVersion;

                try {
                    viewUpdate.upsertData(artifact,"artifact","state-table");
                } catch (JsonProcessingException e) {
                    e.printStackTrace();
                }
            }

            if (artifact.coordinates.startsWith("docker:")){
                // String artifactResource = "https://hub.docker.com/v2/repositories/" + artifact.coordinates.split(":")[1] +"/tags/?page_size=100&name="+artifact.latestVersionFilter.split(":")[0];
                // String artifactResource = "https://hub.docker.com/v2/repositories/" + artifact.coordinates.split(":")[1] +"/tags/?page_size=100";
                String artifactResource = "https://hub.docker.com/v2/namespaces/" + artifact.coordinates.split(":")[1].replace("/", "/repositories/") +"/tags?page_size=100&name=" + artifact.coordinates.split(":")[2];
                System.out.println(artifactResource);
                String artifactResourceContent = producer.requestBody(artifactResource,null,String.class);

                // String latestVersion = producer.requestBodyAndHeader("direct:extract-latest-container-tag",artifactResourceContent,"filter",artifact.latestVersionFilter.split(":")[1],String.class);
                String latestVersion = producer.requestBodyAndHeader("direct:extract-latest-container-tag",artifactResourceContent,"filter",artifact.latestVersionFilter,String.class);
                
                artifact.latestVersion = latestVersion;
                artifact.latestAndGreatest = producer.requestBodyAndHeader("direct:extract-latest-container-tag",artifactResourceContent,"filter","[0-9]+.*",String.class);
                System.out.println("current version " + artifact.currentVersion + " : latest version" + artifact.latestVersion);

                try {
                    viewUpdate.upsertData(artifact,"artifact","state-table");
                } catch (JsonProcessingException e) {
                    e.printStackTrace();
                }

            }

        }
        return artifacts;
    }

    @GET
    public List<Artifact> getAllArtifacts()  {
        List<Artifact> Artifacts = Artifact.listAll();
        return Artifacts;
    }

    @POST
    public Artifact createNewArtifact(Artifact artifact){
        artifact.persist();
        return artifact;
    }

    @POST
    @Path("/init")
    public List<Artifact> loadArtifacts(List<Artifact> artifacts){


        for (Artifact artifact : artifacts) {
            em.merge(artifact);
        }

        return artifacts;
    }

}
