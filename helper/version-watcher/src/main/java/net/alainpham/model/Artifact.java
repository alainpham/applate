package net.alainpham.model;

import java.io.Serializable;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;

import io.quarkus.hibernate.orm.panache.PanacheEntityBase;

@Entity
public class Artifact extends PanacheEntityBase implements Serializable{
    @Id
    public long id;
    public String project;
    public String currentVersionResource;
    public String currentVersionExpression;
    public String currentVersion;

    public String coordinates;
    public String latestVersionFilter;
    public String latestVersion;
    public String latestAndGreatest;

}
