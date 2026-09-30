package com.neo.workflow.client;

import com.neo.workflow.config.InternalApiProperties;
import java.util.Map;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

/**
 * Calls the NestJS application layer. This is the only outbound edge from the
 * workflow engine, and it is always a domain call — never a direct database
 * access. Flowable owns process state only; the application owns business data.
 */
@Component
public class DomainServiceClient {

    private final RestClient client;
    private final InternalApiProperties properties;

    public DomainServiceClient(RestClient.Builder builder, InternalApiProperties properties) {
        this.properties = properties;
        this.client = builder.baseUrl(properties.getDomainBaseUrl()).build();
    }

    public void publishEvent(String requestId, String event) {
        client.post()
                .uri("/api/internal/requests/{id}/events", requestId)
                .header("X-Internal-Token", properties.getToken())
                .contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("event", event))
                .retrieve()
                .toBodilessEntity();
    }

    public boolean evaluatePolicy(String requestId) {
        PolicyResponse response = client.post()
                .uri("/api/internal/requests/{id}/policy", requestId)
                .header("X-Internal-Token", properties.getToken())
                .retrieve()
                .body(PolicyResponse.class);
        return response != null && response.requiresFinance();
    }

    public void finalizeRequest(String requestId, String decision) {
        client.post()
                .uri("/api/internal/requests/{id}/finalize", requestId)
                .header("X-Internal-Token", properties.getToken())
                .contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("decision", decision))
                .retrieve()
                .toBodilessEntity();
    }

    /**
     * Asks the application layer to confirm travel with the booking provider.
     * Credentials and the provider itself live in the app layer, never here.
     */
    public String confirmBooking(String requestId) {
        BookingResponse response = client.post()
                .uri("/api/internal/requests/{id}/integrations/booking", requestId)
                .header("X-Internal-Token", properties.getToken())
                .retrieve()
                .body(BookingResponse.class);
        return response == null ? null : response.bookingReference();
    }

    public record PolicyResponse(boolean requiresFinance) {
    }

    public record BookingResponse(String bookingReference) {
    }
}
