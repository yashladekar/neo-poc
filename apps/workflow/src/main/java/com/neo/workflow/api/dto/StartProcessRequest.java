package com.neo.workflow.api.dto;

import java.util.Map;

public record StartProcessRequest(
        String processDefinitionKey,
        String businessKey,
        Map<String, Object> variables) {
}
