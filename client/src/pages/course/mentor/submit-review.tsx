import { Button, Col, Form, Input, InputNumber, message, Select } from 'antd';
import { FormComponentProps } from 'antd/lib/form';
import { Header, UserSearch, withSession } from 'components';
import withCourseData from 'components/withCourseData';
import * as React from 'react';
import { CourseService, CourseTask } from 'services/course';
import { sortTasksByEndDate } from 'services/rules';
import { CoursePageProps } from 'services/models';
import { StudentBasic } from '../../../../../common/models';

type Props = CoursePageProps & FormComponentProps;

type State = {
  students: StudentBasic[];
  courseTasks: CourseTask[];
  isLoading: boolean;
  isPowerMentor: boolean;
  courseTaskId: number | null;
};

class TaskScorePage extends React.Component<Props, State> {
  state: State = {
    isLoading: false,
    isPowerMentor: false,
    students: [],
    courseTasks: [],
    courseTaskId: null,
  };

  private courseService: CourseService;

  constructor(props: Props) {
    super(props);
    this.courseService = new CourseService(props.course.id);
  }

  async componentDidMount() {
    const courseId = this.props.course.id;
    const { isAdmin, roles } = this.props.session;
    const isCourseManager = roles[courseId] === 'coursemanager';
    const isMentor = roles[courseId] === 'mentor';
    const isPowerMentor = isAdmin || isCourseManager;

    const isCheckedByMentor = task => task.checker === 'mentor';
    const isNotAutoChecked = task => task.verification !== 'auto';
    const isCheckedByTaskOwner = task => task.checker === 'taskOwner';
    const hasStudentEndDate = task => Boolean(task.studentEndDate);
    const isNotUseJury = task => !task.useJury;

    const isSumbitedByTaskOwner = task => this.isTaskOwner(task) && isCheckedByTaskOwner(task);

    const isSumbitedByMentor = task =>
      hasStudentEndDate(task) &&
      isNotAutoChecked(task) &&
      isNotUseJury(task) &&
      isCheckedByMentor(task) &&
      (isMentor || isPowerMentor);

    const isSumbitedByPowerAdmin = task => isPowerMentor && (isCheckedByTaskOwner(task) || isSumbitedByMentor(task));

    const courseTasks = (await this.courseService.getCourseTasks())
      .sort(sortTasksByEndDate)
      .filter(task => isSumbitedByPowerAdmin(task) || isSumbitedByTaskOwner(task) || isSumbitedByMentor(task));

    const { students } = await this.courseService.getAllMentorStudents(courseId).catch(() => ({ students: [] }));

    this.setState({ isPowerMentor, students, courseTasks });
  }

  render() {
    const { getFieldDecorator: field, getFieldValue } = this.props.form;
    const courseTaskId = getFieldValue('courseTaskId');
    const courseTask = this.state.courseTasks.find(t => t.id === courseTaskId);
    const maxScore = courseTask ? courseTask.maxScore || 100 : undefined;
    return (
      <>
        <Header title="Submit Review" courseName={this.props.course.name} username={this.props.session.githubId} />
        <Col className="m-2" sm={12}>
          <Form onSubmit={this.handleSubmit} layout="vertical">
            <Form.Item label="Task">
              {field('courseTaskId', { rules: [{ required: true, message: 'Please select a task' }] })(
                <Select size="large" placeholder="Select task" onChange={this.handleTaskChange}>
                  {this.state.courseTasks.map(task => (
                    <Select.Option key={task.id} value={task.id}>
                      {task.name}
                    </Select.Option>
                  ))}
                </Select>,
              )}
            </Form.Item>
            <Form.Item label="Student">
              {field('studentId', { rules: [{ required: true, message: 'Please select a student' }] })(
                <UserSearch
                  defaultValues={this.state.students}
                  disabled={!courseTaskId}
                  searchFn={this.loadStudents}
                />,
              )}
            </Form.Item>
            <Form.Item label="Github Pull Request URL">
              {field('githubPrUrl', {
                rules: [
                  {
                    message: 'Please enter a valid Github Pull Request URL',
                    pattern: /https:\/\/github.com\/(\w|\d|\-)+\/(\w|\d|\-)+\/pull\/(\d)+/gi,
                  },
                ],
              })(<Input size="large" />)}
            </Form.Item>
            <Form.Item label={`Score${maxScore ? ` (Max ${maxScore} points)` : ''}`}>
              {field('score', {
                rules: [
                  {
                    required: true,
                    message: 'Please enter task score',
                  },
                ],
              })(<InputNumber size="large" step={1} min={0} max={maxScore} />)}
            </Form.Item>
            <Form.Item label="Comment">{field('comment')(<Input.TextArea />)}</Form.Item>
            <Button size="large" type="primary" htmlType="submit">
              Submit
            </Button>
          </Form>
        </Col>
      </>
    );
  }

  private isTaskOwner = task => {
    const courseId = this.props.course.id;
    const { courseRoles } = this.props.session;

    const { tasksIds = [] }: any =
      (courseRoles &&
        courseRoles.taskOwnerRole &&
        courseRoles.taskOwnerRole.courses.find(course => course.id === courseId)) ||
      {};

    return tasksIds.includes(task.id);
  };

  private loadStudents = async (searchText: string) => {
    const { isPowerMentor, courseTaskId, students } = this.state;

    return isPowerMentor || this.isTaskOwner({ id: courseTaskId })
      ? this.courseService.searchCourseStudent(this.props.course.id, searchText)
      : students.filter(({ githubId, firstName, lastName }: any) =>
          `${githubId} ${firstName} ${lastName}`.match(searchText),
        );
  };

  private handleTaskChange = async (value: number) => {
    const courseTaskId = Number(value);
    const courseTask = this.state.courseTasks.find(t => t.courseTaskId === courseTaskId);
    if (courseTask === null) {
      return;
    }
    this.setState({ courseTaskId });
  };

  private handleSubmit = async (e: any) => {
    e.preventDefault();
    this.props.form.validateFields(async (err: any, values: any) => {
      if (err || this.state.isLoading) {
        return;
      }
      try {
        this.setState({ isLoading: true });
        const courseId = this.props.course.id;
        const { studentId, ...data } = values;
        await this.courseService.postStudentScore(courseId, studentId, data);

        this.setState({ isLoading: false });
        message.success('Score has been submitted.');
        this.props.form.resetFields();
      } catch (e) {
        this.setState({ isLoading: false });
        message.error('An error occured. Please try later.');
      }
    });
  };
}

export default withCourseData(withSession(Form.create()(TaskScorePage)));
