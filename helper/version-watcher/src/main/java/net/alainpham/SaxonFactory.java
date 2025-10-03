package net.alainpham;

import jakarta.enterprise.context.Dependent;
import jakarta.enterprise.inject.Produces;
import javax.xml.xpath.XPathFactory;

import net.sf.saxon.xpath.XPathFactoryImpl;


@Dependent
public class SaxonFactory {
    
    @Produces
    public XPathFactory saxonXPathFactory = new XPathFactoryImpl();
    
}
