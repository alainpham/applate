package ${package};
#if (${cxfSupport} == 'true')
import org.apache.cxf.transport.servlet.CXFServlet;
import org.apache.cxf.bus.spring.SpringBus;
import org.apache.camel.component.cxf.CxfEndpoint;
import java.util.Map;
import jakarta.xml.namespace.QName;
import java.util.HashMap;
import java.util.Map;
#end
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.web.servlet.ServletRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.ImportResource;
import org.springframework.beans.factory.annotation.Value;

import org.springframework.boot.web.servlet.ServletRegistrationBean;

import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

import org.apache.camel.opentelemetry.starter.CamelOpenTelemetry;


@SpringBootApplication
@EnableWebSocket
@CamelOpenTelemetry
public class Application implements WebSocketConfigurer{

#if (${cxfSupport} == 'true')

    @Value("${cxf.path}")
    private String cxfPath;

    @Bean
    public ServletRegistrationBean cxfServletRegistrationBean() {
        ServletRegistrationBean mapping = new ServletRegistrationBean();
        mapping.setServlet(new CXFServlet());
        mapping.addUrlMappings(cxfPath+"/*");
        mapping.setName("cxfServlet");
        return mapping;
    }

    @Bean
    public SpringBus cxf() {        
        return new SpringBus();
    }

    @Bean(name = "cxfPayload")
    public CxfEndpoint configurePayloadCxf(){
        		// SOAP endpoint
		CxfEndpoint cxf = new CxfEndpoint();
		cxf.setAddress("/soappayload");
		cxf.setWsdlURL("api-definitions/contract.wsdl");
		cxf.setServiceNameAsQName(new QName("http://www.demo.com/businessService", "personSoapHttpService"));
		cxf.setEndpointNameAsQName(new QName("http://www.demo.com/businessService","personSoapHttpPort"));
		Map<String,Object> props = new HashMap<String,Object>();
		props.put("dataFormat", "PAYLOAD");
		cxf.setProperties(props);
        return cxf;
    }

    // @Bean(name = "cxfPojo")
    // public CxfEndpoint configurePojoCxf(){
    //     		// SOAP endpoint
	// 	CxfEndpoint cxf = new CxfEndpoint();
	// 	cxf.setAddress("/soappojo");
    //     cxf.setServiceClass(PersonPortType.class);
	// 	Map<String,Object> props = new HashMap<String,Object>();
	// 	props.put("dataFormat", "POJO");
	// 	cxf.setProperties(props);
    //     return cxf;
    // }

#end
    // must have a main method spring-boot can run
    public static void main(String[] args) {
        SpringApplication.run(Application.class, args);
    }

    @Override
	public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
		
		// Expose endpoint and add Handler. Wildcard allowed origins to support COORS
		// registry.addHandler(new WebsocketTextHandler(), "/websocket").setAllowedOrigins("*");
		registry.addHandler(new WebSocketTextHandler(), "/websocket");
	}
}