<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0"
                xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
                xmlns:svc="http://www.demo.com/businessService">
    <xsl:output method="xml" omit-xml-declaration="yes"/>

    <!-- Demo response: preserve the requested ID; replace the sample fields with a real lookup. -->
    <xsl:template match="/svc:queryPerson">
        <svc:person>
            <id><xsl:value-of select="id"/></id>
            <name>Demo Person</name>
            <age>30</age>
        </svc:person>
    </xsl:template>
</xsl:stylesheet>
