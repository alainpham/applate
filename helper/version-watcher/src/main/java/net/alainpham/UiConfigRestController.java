package net.alainpham;

import java.util.Map;
import java.util.TreeMap;

import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;

import org.eclipse.microprofile.config.ConfigProvider;

@Path("/uiconfig")
public class UiConfigRestController {
    private Map<String,String> uiConfig;

    public UiConfigRestController() {
        uiConfig = new TreeMap<String,String>();
        uiConfig.put("theme", ConfigProvider.getConfig().getValue("theme",String.class));
    }

    @GET
    @Produces(MediaType.APPLICATION_JSON)
    public Map<String,String> getUiConfig(){
        return uiConfig;
    }
}
