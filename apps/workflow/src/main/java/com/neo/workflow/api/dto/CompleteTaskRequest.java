package com.neo.workflow.api.dto;

import java.util.Map;

public record CompleteTaskRequest(String userId, Map<String, Object> variables) {
}
