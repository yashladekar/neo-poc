package com.neo.workflow.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.neo.workflow.api.dto.CompleteTaskRequest;
import com.neo.workflow.api.dto.ProcessInstanceResponse;
import com.neo.workflow.api.dto.StartProcessRequest;
import java.util.HashMap;
import java.util.Map;
import org.flowable.engine.RepositoryService;
import org.flowable.engine.TaskService;
import org.flowable.task.api.Task;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

/**
 * Regression guard for the null-valued-variable bug.
 *
 * <p>The application sends {@code comment: null} when a reviewer leaves the comment box empty. The
 * facade built its variable map with {@code Collectors.toMap}, which delegates to {@code Map.merge}
 * and therefore throws {@link NullPointerException} on a null value. Because that mapping ran inside
 * the transactional complete method, the exception rolled back a task that had already executed,
 * leaving the request marked completed while the engine still held the task open.
 */
@SpringBootTest
class WorkflowFacadeNullVariableTest {

    private static final String PROBE_PROCESS =
            """
            <?xml version="1.0" encoding="UTF-8"?>
            <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
                         xmlns:flowable="http://flowable.org/bpmn"
                         targetNamespace="http://neo.com/test">
              <process id="nullVariableProbe" isExecutable="true">
                <startEvent id="start"/>
                <sequenceFlow id="flow-start" sourceRef="start" targetRef="waitState"/>
                <userTask id="waitState" name="Wait"/>
                <sequenceFlow id="flow-end" sourceRef="waitState" targetRef="end"/>
                <endEvent id="end"/>
              </process>
            </definitions>
            """;

    @Autowired
    private WorkflowFacade facade;

    @Autowired
    private RepositoryService repositoryService;

    @Autowired
    private TaskService taskService;

    private String deploymentId;

    @BeforeEach
    void deployProbeProcess() {
        deploymentId = repositoryService.createDeployment()
                .addString("nullVariableProbe.bpmn20.xml", PROBE_PROCESS)
                .name("null-variable-probe")
                .deploy()
                .getId();
    }

    @AfterEach
    void removeProbeProcess() {
        if (deploymentId != null) {
            repositoryService.deleteDeployment(deploymentId, true);
        }
    }

    @Test
    void completesAndReadsBackWithNullVariableValues() {
        Map<String, Object> startVariables = new HashMap<>();
        startVariables.put("requestId", "req-null-1");
        startVariables.put("comment", null);

        ProcessInstanceResponse started =
                facade.start(new StartProcessRequest("nullVariableProbe", "bk-null-1", startVariables));

        assertThat(started.ended()).isFalse();
        assertThat(started.activeTaskKeys()).containsExactly("waitState");
        assertThat(started.variables()).containsKey("comment");
        assertThat(started.variables().get("comment")).isNull();

        Task task = taskService.createTaskQuery()
                .processInstanceId(started.processInstanceId())
                .singleResult();
        assertThat(task).isNotNull();

        Map<String, Object> completionVariables = new HashMap<>();
        completionVariables.put("approved", false);
        completionVariables.put("comment", null);

        ProcessInstanceResponse completed =
                facade.complete(task.getId(), new CompleteTaskRequest("tester", completionVariables));

        // The command must actually commit: an ended instance and no leftover task.
        assertThat(completed.ended()).isTrue();
        assertThat(taskService.createTaskQuery()
                        .processInstanceId(started.processInstanceId())
                        .count())
                .isZero();
        assertThat(completed.variables()).containsKey("comment");
        assertThat(completed.variables().get("comment")).isNull();
    }
}
