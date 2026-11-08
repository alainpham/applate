package ${package}.config;

import org.springframework.context.annotation.Configuration;
#if (${cxfSupport} == 'true')
import org.apache.camel.component.cxf.common.DataFormat;
import org.apache.camel.component.cxf.jaxws.CxfEndpoint;
import org.apache.cxf.bus.spring.SpringBus;
import org.apache.cxf.transport.servlet.CXFServlet;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.servlet.ServletRegistrationBean;
import org.springframework.context.annotation.Bean;
#end

@Configuration
public class CamelConfiguration {
#if (${cxfSupport} == 'true')

    @Value("${cxf.path}")
    private String cxfPath;

    @Bean
    public ServletRegistrationBean<CXFServlet> cxfServletRegistrationBean() {
        ServletRegistrationBean<CXFServlet> mapping = new ServletRegistrationBean<>();
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
    public CxfEndpoint configurePayloadCxf() {
        CxfEndpoint cxf = new CxfEndpoint();
        cxf.setAddress("/soappayload");
        cxf.setWsdlURL("api-definitions/contract.wsdl");
        cxf.setServiceName("{http://www.demo.com/businessService}personSoapHttpService");
        cxf.setEndpointName("{http://www.demo.com/businessService}personSoapHttpPort");
        cxf.setDataFormat(DataFormat.PAYLOAD);
        cxf.setSchemaValidationEnabled(true);
        return cxf;
    }

#end
}
