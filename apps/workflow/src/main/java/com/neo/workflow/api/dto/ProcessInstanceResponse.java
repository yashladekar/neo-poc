package com.neo.workflow.api.dto;

import java.util.List;
import java.util.Map;

public record ProcessInstanceResponse(
        String processInstanceId,
        String businessKey,
        String processDefinitionKey,
        boolean ended,
        Map<String, Object> variables,
        List<String> activeTaskKeys) {
}
