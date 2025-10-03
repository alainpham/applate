package ${package};
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.beans.factory.annotation.Autowired;

import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

import ${package}.helper.WebSocketTextHandler;

@SpringBootApplication
@EnableWebSocket
public class Application implements WebSocketConfigurer{

    public static void main(String[] args) {
        SpringApplication.run(Application.class, args);
    }

	@Autowired
	WebSocketTextHandler webSocketTextHandler;

    @Override
	public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
		
		// Expose endpoint and add Handler. Wildcard allowed origins to support COORS
		// registry.addHandler(new WebsocketTextHandler(), "/websocket").setAllowedOrigins("*");
		registry.addHandler(webSocketTextHandler, "/websocket");
	}
}