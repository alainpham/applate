package ${package};

import org.apache.camel.builder.RouteBuilder;
import org.apache.camel.component.micrometer.eventnotifier.MicrometerExchangeEventNotifier;
import org.apache.camel.component.micrometer.eventnotifier.MicrometerRouteEventNotifier;
import org.apache.camel.component.micrometer.messagehistory.MicrometerMessageHistoryFactory;
import org.apache.camel.component.micrometer.routepolicy.MicrometerRoutePolicyFactory;
import org.apache.camel.model.rest.RestBindingMode;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

@Component
public class RestConfigurator extends RouteBuilder {

	@Autowired
	Environment environment;

	@Override
	public void configure() throws Exception {
		restConfiguration()
		.apiContextRouteId("api-docs")
		.component("platform-http")
		.bindingMode(RestBindingMode.json)
		.apiContextPath("/api-docs")
		.apiProperty("cors", "true")
		.apiProperty("api.title", environment.getProperty("camel.springboot.name"))
		.apiProperty("api.version", environment.getProperty("camelrest.apiversion"))
		.dataFormatProperty("prettyPrint", "true");

		getContext().addRoutePolicyFactory(new MicrometerRoutePolicyFactory());
		getContext().setMessageHistoryFactory(new MicrometerMessageHistoryFactory());
		getCamelContext().getManagementStrategy().addEventNotifier(new MicrometerExchangeEventNotifier());
		getCamelContext().getManagementStrategy().addEventNotifier(new MicrometerRouteEventNotifier());

	}


}
