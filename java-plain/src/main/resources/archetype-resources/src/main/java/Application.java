package ${package};

import org.apache.camel.main.Main;

public class Application {

    public static void main(String[] args) throws Exception {
        System.out.println("Hello");

        // use Camels Main class
        Main main = new Main(Application.class);
        // and add all the XML routes
        main.configure().withRoutesIncludePattern("camel/*.xml");
        // turn on reloading routes on code-changes
        main.configure().withRoutesReloadEnabled(true);
        main.configure().withRoutesReloadDirectory("src/main/resources");
        main.configure().withRoutesReloadPattern("camel/*.xml");

        // now keep the application running until the JVM is terminated (ctrl + c or sigterm)
        main.run(args);

    }

}