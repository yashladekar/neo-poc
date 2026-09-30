package com.neo.workflow.api;

import com.neo.workflow.api.dto.ClaimTaskRequest;
import com.neo.workflow.api.dto.CompleteTaskRequest;
import com.neo.workflow.api.dto.ProcessInstanceResponse;
import com.neo.workflow.api.dto.TaskResponse;
import com.neo.workflow.service.WorkflowFacade;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/internal/tasks")
public class TaskController {

    private final WorkflowFacade workflowFacade;

    public TaskController(WorkflowFacade workflowFacade) {
        this.workflowFacade = workflowFacade;
    }

    @GetMapping
    public List<TaskResponse> list(
            @RequestParam(required = false) String assignee,
            @RequestParam(required = false) String candidateGroup,
            @RequestParam(required = false) String processInstanceId) {
        return workflowFacade.listTasks(assignee, candidateGroup, processInstanceId);
    }

    @GetMapping("/{taskId}")
    public TaskResponse get(@PathVariable String taskId) {
        return workflowFacade.getTask(taskId);
    }

    @PostMapping("/{taskId}/complete")
    public ProcessInstanceResponse complete(
            @PathVariable String taskId,
            @RequestBody CompleteTaskRequest request) {
        return workflowFacade.complete(taskId, request);
    }

    @PostMapping("/{taskId}/claim")
    public TaskResponse claim(@PathVariable String taskId, @RequestBody ClaimTaskRequest request) {
        return workflowFacade.claim(taskId, request.userId());
    }
}
