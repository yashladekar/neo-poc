package com.neo.workflow.api;

import com.neo.workflow.api.dto.HistoryEntry;
import com.neo.workflow.api.dto.ProcessInstanceResponse;
import com.neo.workflow.api.dto.StartProcessRequest;
import com.neo.workflow.service.WorkflowFacade;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/internal/process-instances")
public class ProcessInstanceController {

    private final WorkflowFacade workflowFacade;

    public ProcessInstanceController(WorkflowFacade workflowFacade) {
        this.workflowFacade = workflowFacade;
    }

    @PostMapping
    public ProcessInstanceResponse start(@RequestBody StartProcessRequest request) {
        return workflowFacade.start(request);
    }

    @GetMapping("/{processInstanceId}")
    public ProcessInstanceResponse get(@PathVariable String processInstanceId) {
        return workflowFacade.getInstance(processInstanceId);
    }

    @GetMapping("/{processInstanceId}/history")
    public java.util.List<HistoryEntry> history(@PathVariable String processInstanceId) {
        return workflowFacade.getHistory(processInstanceId);
    }
}
