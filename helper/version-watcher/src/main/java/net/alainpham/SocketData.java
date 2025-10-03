package net.alainpham;

import java.io.Serializable;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.TreeSet;

public class SocketData implements Serializable{
   
    private static final long serialVersionUID = 1L;

    public static final String APPEND_DATA = "append-data";
    public static final String UPSERT_DATA = "upsert-data";
    public static final String CLEAR_DATA = "clear-data";
    public static final String REFRESH_DATA = "refresh-data";
    public static final String NOTIFY = "notify";
    public static final String UPDATE_HEADER = "update-header";

    private Set<String> elementIds;
    private String type;
    private Set<String> actions=new TreeSet<String>();
    private List<Serializable> data=new ArrayList<Serializable>();

    public static SocketData defaultSocketData(Serializable data,String type, Boolean notify, Boolean updateHeader, Boolean changeData, String dataOperationType , String targetTableId){
        SocketData dataElement=new SocketData();
        Set<String> elements = new HashSet<String>(Arrays.asList(targetTableId.split(",")));
        dataElement.setElementIds(elements);
        dataElement.type=type;
        if (notify){
            dataElement.getActions().add(NOTIFY);
        }
        if (updateHeader){
            dataElement.getActions().add(UPDATE_HEADER);
        }
        if (changeData){
            dataElement.getActions().add(dataOperationType);
        }
        dataElement.getData().add(data);
        return dataElement;
    }


    public Set<String> getElementIds() {
        return elementIds;
    }

    public void setElementIds(Set<String> elementIds) {
        this.elementIds = elementIds;
    }

    public Set<String> getActions() {
        return actions;
    }

    public void setActions(Set<String> actions) {
        this.actions = actions;
    }

    public List<Serializable> getData() {
        return data;
    }

    public void setData(List<Serializable> data) {
        this.data = data;
    }

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    

    
}

