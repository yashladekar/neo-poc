package com.neo.workflow.config;

import jakarta.servlet.Filter;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletRequest;
import jakarta.servlet.ServletResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import org.springframework.stereotype.Component;

/**
 * Guards the /internal/** API with a shared service token. This service is only
 * ever called by the NestJS application layer, never by a browser.
 */
@Component
public class InternalApiFilter implements Filter {

    private static final String HEADER = "X-Internal-Token";
    private final InternalApiProperties properties;

    public InternalApiFilter(InternalApiProperties properties) {
        this.properties = properties;
    }

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
            throws IOException, ServletException {
        if (request instanceof HttpServletRequest httpRequest
                && httpRequest.getRequestURI().startsWith("/internal/")) {
            String provided = httpRequest.getHeader(HEADER);
            if (!matches(provided)) {
                ((HttpServletResponse) response)
                        .sendError(HttpServletResponse.SC_UNAUTHORIZED, "Invalid internal service token");
                return;
            }
        }
        chain.doFilter(request, response);
    }

    private boolean matches(String provided) {
        if (provided == null) {
            return false;
        }
        return MessageDigest.isEqual(
                provided.getBytes(StandardCharsets.UTF_8),
                properties.getToken().getBytes(StandardCharsets.UTF_8));
    }
}
