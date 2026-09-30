package com.neo.workflow.service;

import com.neo.workflow.api.dto.CompleteTaskRequest;
import com.neo.workflow.api.dto.HistoryEntry;
import com.neo.workflow.api.dto.ProcessInstanceResponse;
import com.neo.workflow.api.dto.StartProcessRequest;
import com.neo.workflow.api.dto.TaskResponse;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.flowable.common.engine.api.FlowableObjectNotFoundException;
import org.flowable.engine.HistoryService;
import org.flowable.engine.RepositoryService;
import org.flowable.engine.RuntimeService;
import org.flowable.engine.TaskService;
import org.flowable.engine.history.HistoricProcessInstance;
import org.flowable.engine.runtime.ProcessInstance;
import org.flowable.identitylink.api.IdentityLink;
import org.flowable.identitylink.api.IdentityLinkType;
import org.flowable.task.api.Task;
import org.flowable.variable.api.history.HistoricVariableInstance;
import org.springframework.stereotype.Service;

/**
 * Thin, engine-facing facade. It exposes exactly the operations the application
 * layer needs and never touches business data: Flowable owns only process state,
 * user tasks and history.
 */
@Service
public class WorkflowFacade {

    private final RuntimeService runtimeService;
    private final TaskService taskService;
    private final RepositoryService repositoryService;
    private final HistoryService historyService;

    public WorkflowFacade(
            RuntimeService runtimeService,
            TaskService taskService,
            RepositoryService repositoryService,
            HistoryService historyService) {
        this.runtimeService = runtimeService;
        this.taskService = taskService;
        this.repositoryService = repositoryService;
        this.historyService = historyService;
    }

    public ProcessInstanceResponse start(StartProcessRequest request) {
        if (request.processDefinitionKey() == null || request.processDefinitionKey().isBlank()) {
            throw new IllegalArgumentException("processDefinitionKey is required");
        }
        Map<String, Object> variables = request.variables() == null ? new HashMap<>() : new HashMap<>(request.variables());
        ProcessInstance instance = runtimeService.startProcessInstanceByKey(
                request.processDefinitionKey(), request.businessKey(), variables);
        return getInstance(instance.getId());
    }

    public ProcessInstanceResponse getInstance(String processInstanceId) {
        ProcessInstance instance = runtimeService.createProcessInstanceQuery()
                .processInstanceId(processInstanceId)
                .singleResult();

        if (instance != null) {
            return new ProcessInstanceResponse(
                    instance.getId(),
                    instance.getBusinessKey(),
                    processDefinitionKey(instance.getProcessDefinitionId()),
                    false,
                    runtimeService.getVariables(instance.getId()),
                    activeTaskKeys(instance.getId()));
        }

        HistoricProcessInstance historic = historyService.createHistoricProcessInstanceQuery()
                .processInstanceId(processInstanceId)
                .singleResult();
        if (historic == null) {
            throw new FlowableObjectNotFoundException(
                    "Process instance not found: " + processInstanceId, ProcessInstance.class);
        }
        return new ProcessInstanceResponse(
                historic.getId(),
                historic.getBusinessKey(),
                processDefinitionKey(historic.getProcessDefinitionId()),
                true,
                historicVariables(processInstanceId),
                List.of());
    }

    public List<TaskResponse> listTasks(String assignee, String candidateGroup, String processInstanceId) {
        var query = taskService.createTaskQuery();
        if (assignee != null && !assignee.isBlank()) {
            query.taskAssignee(assignee);
        }
        if (candidateGroup != null && !candidateGroup.isBlank()) {
            query.taskCandidateGroup(candidateGroup);
        }
        if (processInstanceId != null && !processInstanceId.isBlank()) {
            query.processInstanceId(processInstanceId);
        }
        return query.orderByTaskCreateTime().desc().list().stream()
                .map(this::toTaskResponse)
                .collect(Collectors.toList());
    }

    public TaskResponse getTask(String taskId) {
        return toTaskResponse(requireTask(taskId));
    }

    /**
     * The engine's own record of every activity instance (including the ones that
     * are not exposed as user tasks), used to render the process history.
     */
    public List<HistoryEntry> getHistory(String processInstanceId) {
        getInstance(processInstanceId);
        return historyService.createHistoricActivityInstanceQuery()
                .processInstanceId(processInstanceId)
                .orderByHistoricActivityInstanceStartTime()
                .asc()
                .list()
                .stream()
                .map(activity -> new HistoryEntry(
                        activity.getActivityId(),
                        activity.getActivityName(),
                        activity.getActivityType(),
                        activity.getStartTime() == null ? null : activity.getStartTime().toInstant(),
                        activity.getEndTime() == null ? null : activity.getEndTime().toInstant()))
                .collect(Collectors.toList());
    }

    /**
     * Commands are intentionally NOT wrapped in an ambient transaction: the engine
     * call commits on its own, then the state is read back. A failure while mapping
     * the response can therefore never roll back a command that already succeeded.
     */
    public ProcessInstanceResponse complete(String taskId, CompleteTaskRequest request) {
        Task task = requireTask(taskId);
        String processInstanceId = task.getProcessInstanceId();
        Map<String, Object> variables = request.variables() == null ? new HashMap<>() : new HashMap<>(request.variables());
        if (request.userId() != null && !request.userId().isBlank()) {
            variables.put("lastCompletedBy", request.userId());
        }
        taskService.complete(taskId, variables);
        return getInstance(processInstanceId);
    }

    public TaskResponse claim(String taskId, String userId) {
        if (userId == null || userId.isBlank()) {
            throw new IllegalArgumentException("userId is required to claim a task");
        }
        taskService.claim(taskId, userId);
        return getTask(taskId);
    }

    private Task requireTask(String taskId) {
        Task task = taskService.createTaskQuery().taskId(taskId).singleResult();
        if (task == null) {
            throw new FlowableObjectNotFoundException("Task not found: " + taskId, Task.class);
        }
        return task;
    }

    private TaskResponse toTaskResponse(Task task) {
        return new TaskResponse(
                task.getId(),
                task.getName(),
                task.getTaskDefinitionKey(),
                task.getProcessInstanceId(),
                processDefinitionKey(task.getProcessDefinitionId()),
                businessKey(task.getProcessInstanceId()),
                task.getAssignee(),
                candidateGroups(task.getId()),
                task.getFormKey(),
                taskService.getVariables(task.getId()),
                task.getCreateTime() == null ? null : task.getCreateTime().toInstant());
    }

    private List<String> candidateGroups(String taskId) {
        return taskService.getIdentityLinksForTask(taskId).stream()
                .filter(link -> IdentityLinkType.CANDIDATE.equals(link.getType()))
                .map(IdentityLink::getGroupId)
                .filter(groupId -> groupId != null)
                .collect(Collectors.toList());
    }

    private String businessKey(String processInstanceId) {
        ProcessInstance instance = runtimeService.createProcessInstanceQuery()
                .processInstanceId(processInstanceId)
                .singleResult();
        return instance == null ? null : instance.getBusinessKey();
    }

    private String processDefinitionKey(String processDefinitionId) {
        if (processDefinitionId == null) {
            return null;
        }
        return repositoryService.getProcessDefinition(processDefinitionId).getKey();
    }

    private List<String> activeTaskKeys(String processInstanceId) {
        return taskService.createTaskQuery().processInstanceId(processInstanceId).list().stream()
                .map(Task::getTaskDefinitionKey)
                .distinct()
                .collect(Collectors.toList());
    }

    private Map<String, Object> historicVariables(String processInstanceId) {
        // A plain loop, not Collectors.toMap: toMap merges with Map.merge, which
        // throws NPE when a variable has a null value (e.g. an empty comment).
        Map<String, Object> variables = new HashMap<>();
        for (HistoricVariableInstance variable : historyService.createHistoricVariableInstanceQuery()
                .processInstanceId(processInstanceId)
                .list()) {
            variables.put(variable.getVariableName(), variable.getValue());
        }
        return variables;
    }
}
