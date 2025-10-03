package ${package};

import jakarta.enterprise.context.ApplicationScoped;

import org.apache.camel.builder.RouteBuilder;
// import org.apache.camel.model.rest.RestBindingMode;

@ApplicationScoped
public class Main extends RouteBuilder {

    @Override
    public void configure() throws Exception {
        
		restConfiguration().apiContextRouteId("api-docs");

		// restConfiguration()
		// .apiContextRouteId("api-docs")
		// .bindingMode(RestBindingMode.json)
		// .contextPath("/camel")
		// .apiContextPath("/api-docs")
		// .apiProperty("cors", "true")
		// .apiProperty("api.title", "test")
		// .apiProperty("api.version", "test")
		// .dataFormatProperty("prettyPrint", "true");
        // ;


        from("timer:test-from-java?period=1s").routeId("hello-java").log("hello from java");
        
    }
    
}
