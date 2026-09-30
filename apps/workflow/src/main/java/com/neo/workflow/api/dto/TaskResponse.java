package com.neo.workflow.api.dto;

import java.time.Instant;
import java.util.List;
import java.util.Map;

public record TaskResponse(
        String taskId,
        String name,
        String taskDefinitionKey,
        String processInstanceId,
        String processDefinitionKey,
        String businessKey,
        String assignee,
        List<String> candidateGroups,
        String formKey,
        Map<String, Object> variables,
        Instant createdTime) {
}
