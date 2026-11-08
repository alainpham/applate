package ${package}.helper;

import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.TextMessage;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;

@Component
public class View {
    @Autowired
    WebSocketTextHandler webSocketTextHandler;

    private ObjectMapper objectMapper = new ObjectMapper();

    public void update(String type, List<Object> data) throws JsonProcessingException {
        WebSocketData webSocketData = new WebSocketData();
        WebSocketData.Metadata metadata = webSocketData.new Metadata();
        metadata.setType(type);
        webSocketData.setMetadata(metadata);
        webSocketData.setData(data);
        String value = objectMapper.writeValueAsString(webSocketData);
        webSocketTextHandler.sendMessageToAllClients(new TextMessage(value));
    }

}