package com.neo.workflow.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "neo.internal")
public class InternalApiProperties {

    private String token = "dev-internal-token";
    private String domainBaseUrl = "http://localhost:3001";

    public String getToken() {
        return token;
    }

    public void setToken(String token) {
        this.token = token;
    }

    public String getDomainBaseUrl() {
        return domainBaseUrl;
    }

    public void setDomainBaseUrl(String domainBaseUrl) {
        this.domainBaseUrl = domainBaseUrl;
    }
}
