import { Button, Col, Table, Form, Input, message, Row, Typography, notification, Radio, Checkbox } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { PageLayout, withSession } from 'components';
import { CourseTaskSelect } from 'components/Forms';
import withCourseData from 'components/withCourseData';
import { useMemo, useState } from 'react';
import { useAsync } from 'react-use';
import { CourseService, CourseTask, SelfEducationQuestion, SelfEducationQuestionWithIndex } from 'services/course';
import { CoursePageProps } from 'services/models';
import { notUrlPattern } from 'services/validators';
import { shortDateTimeRenderer } from 'components/Table';
import { AxiosError } from 'axios';
import shuffle from 'lodash/shuffle';

function Page(props: CoursePageProps) {
  const courseId = props.course.id;

  const [form] = Form.useForm();
  const courseService = useMemo(() => new CourseService(courseId), [courseId]);
  const [loading, setLoading] = useState(false);
  const [courseTasks, setCourseTasks] = useState([] as CourseTask[]);
  const [verifications, setVerifications] = useState([] as any[]);
  const [courseTaskId, setCourseTaskId] = useState(null as number | null);

  const courseTask = useMemo(() => {
    const courseTask = courseTasks.find(t => t.id === courseTaskId);

    if (courseTask?.type === 'selfeducation') {
      return {
        ...courseTask,
        publicAttributes: {
          ...courseTask.publicAttributes!,
          questions: getRandomQuestions(courseTask.publicAttributes?.questions || []).slice(
            0,
            courseTask?.publicAttributes?.numberOfQuestions,
          ),
        },
      };
    }

    return courseTask;
  }, [courseTaskId]);

  useAsync(async () => {
    try {
      setLoading(true);
      loadVerifications();
      const tasks = await courseService.getCourseTasks();
      const courseTasks = filterAutoTestTasks(tasks);
      setCourseTasks(courseTasks);
    } catch {
      message.error('An error occured. Please try later.');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSubmit = async (values: any) => {
    const { courseTaskId } = values;
    const task = courseTasks.find(t => t.id === courseTaskId);
    if (!task) {
      return;
    }
    try {
      const data = getSubmitData(task, values);
      if (data == null) {
        return;
      }

      setLoading(true);
      const {
        courseTask: { type },
      } = await courseService.postTaskVerification(courseTaskId, data);

      if (type === 'selfeducation') {
        message.success('The task has been submitted.');
        loadVerifications();
      } else {
        message.success('The task has been submitted for verification and it will be checked soon.');
      }

      form.resetFields();
    } catch (e) {
      const error = e as AxiosError;
      if (error.response?.status === 429) {
        notification.warn({
          message: (
            <>Please wait. You will be able to submit your task again when the current verification is completed.</>
          ),
        });
        return;
      }
      if (error.response?.status === 423) {
        notification.error({
          message: <>Please reload page. This task was expired for submit.</>,
        });
        return;
      }
      if (error.response?.status === 403) {
        notification.error({
          message: (
            <>
              You already submit this task {courseTask?.publicAttributes?.maxAttemptsNumber || 0} times. Attempts limit
              is over!
            </>
          ),
        });
        form.resetFields();
        return;
      }
      message.error('An error occured. Please try later.');
    } finally {
      setLoading(false);
      setCourseTaskId(null);
    }
  };

  const loadVerifications = async () => {
    try {
      setLoading(true);
      const data = await courseService.getTaskVerifications();
      setVerifications(data);
    } finally {
      setLoading(false);
    }
  };

  const handleCourseTaskChange = (courseTaskId: number) => {
    if (courseTask?.type === 'selfeducation') {
      form.resetFields();
    }

    setCourseTaskId(courseTaskId);
    form.setFieldsValue({ courseTaskId });
    loadVerifications();
  };

  return (
    <PageLayout loading={loading} title="Auto-Test" courseName={props.course.name} githubId={props.session.githubId}>
      <Row gutter={24}>
        <Col style={{ marginBottom: 32 }} xs={24} sm={18} md={12} lg={10}>
          <Form form={form} onFinish={handleSubmit} layout="vertical">
            <CourseTaskSelect onChange={handleCourseTaskChange} data={courseTasks} />
            {renderTaskFields(props.session.githubId, courseTask)}
            <Row>
              <Button size="large" type="primary" htmlType="submit">
                Submit
              </Button>
            </Row>
          </Form>
        </Col>
        <Col xs={24} sm={20} md={18} lg={14}>
          <Row justify="space-between">
            <Typography.Title type="secondary" level={4}>
              Verification Results
            </Typography.Title>
            <Button type="dashed" onClick={loadVerifications} icon={<ReloadOutlined />}>
              Refresh
            </Button>
          </Row>
          <Table
            size="small"
            rowKey="id"
            pagination={false}
            columns={[
              {
                title: 'Date/Time',
                dataIndex: 'createdDate',
                render: shortDateTimeRenderer,
              },
              {
                title: 'Status',
                dataIndex: 'status',
              },
              {
                title: 'Task Name',
                dataIndex: ['courseTask', 'task', 'name'],
                ellipsis: true,
              },
              {
                title: 'Score',
                dataIndex: 'score',
                width: 60,
              },
              {
                title: 'Details',
                dataIndex: 'details',
              },
            ]}
            dataSource={verifications}
          />
        </Col>
      </Row>
    </PageLayout>
  );
}

export default withCourseData(withSession(Page));

function renderTaskFields(githubId: string, courseTask?: CourseTask) {
  const repoUrl = `https://github.com/${githubId}/${courseTask?.githubRepoName}`;
  switch (courseTask?.type) {
    case 'jstask':
      return renderJsTaskFields(repoUrl);
    case 'kotlintask':
    case 'objctask':
      return renderKotlinTaskFields(repoUrl);
    case 'selfeducation':
      return (
        <>
          {renderDescription(courseTask?.descriptionUrl)}
          {renderSelfEducation(courseTask)}
        </>
      );
    // TODO: Left hardcoded (codewars:stage1|codewars:stage2) configs only for backward compatibility. Delete them in the future.
    case 'codewars':
    case 'codewars:stage1':
    case 'codewars:stage2': {
      return (
        <>
          {renderDescription(courseTask.descriptionUrl)}
          <Form.Item
            name="codewars"
            label="Codewars Account"
            rules={[{ pattern: notUrlPattern, message: 'Enter valid Codewars account' }]}
          >
            <Input style={{ maxWidth: 250 }} placeholder="username" />
          </Form.Item>
        </>
      );
    }
    default:
      return null;
  }
}

function renderSelfEducation(courseTask: CourseTask) {
  const questions = (courseTask?.publicAttributes?.questions as SelfEducationQuestionWithIndex[]) || [];
  const { maxAttemptsNumber = 0, tresholdPercentage = 0 } = courseTask?.publicAttributes ?? {};

  return (
    <>
      <Typography.Paragraph>To submit the task answer the questions.</Typography.Paragraph>
      <Typography.Paragraph>
        <Typography.Text mark strong>
          Note: You must to score at least {tresholdPercentage}% of points to pass. You have only {maxAttemptsNumber}{' '}
          attempts.
        </Typography.Text>
      </Typography.Paragraph>
      {questions.map(({ question, answers, multiple, index: questionIndex }) => (
        <Form.Item
          key={questionIndex}
          label={question}
          name={`answer-${questionIndex}`}
          rules={[{ required: true, message: 'Please answer the question' }]}
        >
          {multiple ? (
            <Checkbox.Group>
              {answers.map((answer, index) => (
                <Row key={index}>
                  <Checkbox value={index}>{answer}</Checkbox>
                </Row>
              ))}
            </Checkbox.Group>
          ) : (
            <Radio.Group>
              {answers.map((answer, index) => (
                <Row key={index}>
                  <Radio value={index}>{answer}</Radio>
                </Row>
              ))}
            </Radio.Group>
          )}
        </Form.Item>
      ))}
    </>
  );
}

function renderJsTaskFields(repoUrl: string) {
  return (
    <Row>
      <Typography.Paragraph>
        The system will run tests in the following repository and will update the score based on the result:
      </Typography.Paragraph>
      <Typography.Paragraph>
        <a href={repoUrl} target="_blank">
          {repoUrl}
        </a>
      </Typography.Paragraph>
      <Typography.Paragraph type="warning">
        IMPORTANT: Tests are run using NodeJS 12. Please make sure your solution works in NodeJS 12.
      </Typography.Paragraph>
    </Row>
  );
}

function renderKotlinTaskFields(repoUrl: string) {
  return (
    <Row>
      <Typography.Paragraph>
        The system will run tests in the following repository and will update the score based on the result:
      </Typography.Paragraph>
      <Typography.Paragraph>
        <a href={repoUrl} target="_blank">
          {repoUrl}
        </a>
      </Typography.Paragraph>
    </Row>
  );
}

function renderDescription(descriptionUrl: string | null | undefined) {
  if (descriptionUrl == null) {
    return null;
  }
  return (
    <Row>
      <Typography.Paragraph>
        <div>Description:</div>
        <a href={descriptionUrl!} target="_blank">
          {descriptionUrl}
        </a>
      </Typography.Paragraph>
    </Row>
  );
}

function filterAutoTestTasks(tasks: CourseTask[]) {
  return tasks.filter(
    task =>
      task.studentEndDate &&
      (new Date(task.studentEndDate).getTime() > Date.now() ||
        task.type === 'codewars' ||
        // TODO: Left hardcoded (codewars:stage1|codewars:stage2) configs only for backward compatibility. Delete them in the future.
        task.type === 'codewars:stage1' ||
        task.type === 'codewars:stage2') &&
      (task.verification === 'auto' || task.checker === 'auto-test') &&
      task.checker !== 'taskOwner' &&
      task.type !== 'test',
  );
}

function getRandomQuestions(questions: SelfEducationQuestion[]) {
  const questionsWithIndex = questions.map((question, index) => ({ ...question, index }));
  return shuffle(questionsWithIndex);
}

function getSubmitData(task: CourseTask, values: any) {
  let data: object = {};
  switch (task.type) {
    case 'selfeducation':
      data = Object.entries(values)
        .filter(([key]) => /answer/.test(key))
        .map(([key, value]) => {
          const [, index] = key.match(/answer-(.*)$/) || [];
          return { index: Number(index), value };
        });
      break;
    // TODO: Left hardcoded (codewars:stage1|codewars:stage2) configs only for backward compatibility. Delete them in the future.
    case 'codewars':
    case 'codewars:stage1':
    case 'codewars:stage2':
      if (!values.codewars) {
        message.error('Enter Account');
        return null;
      }

      data = {
        codewars: values.codewars,
        deadline: task.studentEndDate,
        // TODO: Left hardcoded (codewars:stage1|codewars:stage2) configs only for backward compatibility. Delete them in the future.
        variant: task.type !== 'codewars' ? task.type.split(':')[1] : undefined,
      };
      break;

    case 'jstask':
    case 'kotlintask':
    case 'objctask':
      data = {
        githubRepoName: task.githubRepoName,
        sourceGithubRepoUrl: task.sourceGithubRepoUrl,
      };
      break;

    case 'cv:markdown':
    case 'cv:html':
    case null:
      data = {};
      break;

    default:
      return null;
  }

  return data;
}
