package ${package}.model;

public class Person {
    
    private String id;
    private String name;
    private String firstName;
    private String vote;
    private String textArea;
    
    public String getId() {
        return id;
    }
    public void setId(String id) {
        this.id = id;
    }
    public String getName() {
        return name;
    }
    public void setName(String name) {
        this.name = name;
    }
    public String getFirstName() {
        return firstName;
    }
    public void setFirstName(String firstName) {
        this.firstName = firstName;
    }
    public String getVote() {
        return vote;
    }
    public void setVote(String vote) {
        this.vote = vote;
    }
    public String getTextArea() {
        return textArea;
    }
    public void setTextArea(String textArea) {
        this.textArea = textArea;
    }
    
    @Override
    public String toString() {
        return "Person [id=" + id + ", name=" + name + ", firstName=" + firstName + ", vote=" + vote + ", textArea="
                + textArea + "]";
    }
    
}
