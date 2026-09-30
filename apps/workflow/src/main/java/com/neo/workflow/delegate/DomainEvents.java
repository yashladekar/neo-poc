package com.neo.workflow.delegate;

import com.neo.workflow.client.DomainServiceClient;
import org.flowable.engine.delegate.DelegateExecution;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Thin adapters used by the BPMN service tasks. Each one translates a workflow
 * step into a call to the NestJS application layer. They are stateless beans
 * invoked through method expressions (thread-safe, no field injection).
 */
@Component("domainEvents")
public class DomainEvents {

    private static final Logger log = LoggerFactory.getLogger(DomainEvents.class);

    private final DomainServiceClient client;

    public DomainEvents(DomainServiceClient client) {
        this.client = client;
    }

    public void handle(DelegateExecution execution, String event) {
        String requestId = requireRequestId(execution);
        log.info("Publishing domain event {} for request {}", event, requestId);
        client.publishEvent(requestId, event);
    }

    public void evaluatePolicy(DelegateExecution execution) {
        String requestId = requireRequestId(execution);
        boolean requiresFinance = client.evaluatePolicy(requestId);
        execution.setVariable("requiresFinance", requiresFinance);
        log.info("Policy decision for request {}: requiresFinance={}", requestId, requiresFinance);
    }

    public void finalizeRequest(DelegateExecution execution) {
        String requestId = requireRequestId(execution);
        boolean approved = Boolean.TRUE.equals(execution.getVariable("approved"));
        client.finalizeRequest(requestId, approved ? "APPROVED" : "REJECTED");
    }

    /** Confirms travel with the booking integration once a request is approved. */
    public void confirmBooking(DelegateExecution execution) {
        String requestId = requireRequestId(execution);
        String bookingReference = client.confirmBooking(requestId);
        if (bookingReference != null) {
            execution.setVariable("bookingReference", bookingReference);
            log.info("Booking confirmed for request {}: {}", requestId, bookingReference);
        }
    }

    private String requireRequestId(DelegateExecution execution) {
        Object requestId = execution.getVariable("requestId");
        if (requestId == null) {
            throw new IllegalStateException("Process variable 'requestId' is required");
        }
        return requestId.toString();
    }
}
