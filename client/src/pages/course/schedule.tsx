import { Form, Table, Tag, Row, Icon, Tooltip, Button, Typography } from 'antd';
import { FormComponentProps } from 'antd/lib/form';
import { Header, withSession, GithubUserLink } from 'components';
import { dateRenderer, timeRenderer } from 'components/Table';
import withCourseData from 'components/withCourseData';
import * as React from 'react';
import { CourseEvent, CourseService, CourseTask } from 'services/course';
import { CoursePageProps } from 'services/models';
import { formatTime } from 'services/formatter';
import css from 'styled-jsx/css';
import moment from 'moment';

const { Text } = Typography;

type Props = CoursePageProps & FormComponentProps;

interface State {
  data: CourseEvent[];
}

enum EventTypeColor {
  deadline = 'red',
  test = '#63ab91',
  jstask = 'green',
  htmltask = 'green',
  externaltask = 'green',
  codejam = 'green',
  newtask = 'green',
  lecture = 'blue',
  lecture_online = 'blue',
  lecture_offline = 'blue',
  lecture_mixed = 'blue',
  lecture_self_study = 'blue',
  info = '#ff7b00',
  warmup = '#63ab91',
  meetup = '#bde04a',
  workshop = '#bde04a',
  interview = '#63ab91',
}

const TaskTypes = {
  deadline: 'deadline',
  test: 'test',
  newtask: 'newtask',
  lecture: 'lecture',
};

const EventTypeToName = {
  lecture_online: 'online lecture',
  lecture_offline: 'offline lecture',
  lecture_mixed: 'mixed lecture',
  lecture_self_study: 'self study',
  warmup: 'warm-up',
  jstask: 'js task',
  htmltask: 'html task',
  codejam: 'code jam',
  externaltask: 'external task',
};

class SchedulePage extends React.Component<Props, State> {
  state: State = {
    data: [],
  };

  startOfToday = moment().startOf('day');

  readonly eventTypeToName = EventTypeToName;
  private courseService: CourseService;

  constructor(props: Props) {
    super(props);
    this.courseService = new CourseService(props.course.id);
  }

  async componentDidMount() {
    const courseId = this.props.course.id;
    const [events, tasks] = await Promise.all([
      this.courseService.getCourseEvents(courseId),
      this.courseService.getCourseTasks(),
    ]);
    const data = events
      .concat(
        tasks.reduce((acc: Array<CourseEvent>, task: CourseTask) => {
          if (task.type !== TaskTypes.test) {
            acc.push({
              id: task.id,
              date: task.studentStartDate ? dateRenderer(task.studentStartDate) : '',
              time: task.studentStartDate ? formatTime(task.studentStartDate) : '',
              event: {
                type: task.type,
                name: task.name,
                descriptionUrl: task.descriptionUrl,
              },
            } as CourseEvent);
          }
          acc.push({
            id: task.id,
            date: task.studentEndDate ? dateRenderer(task.studentEndDate) : '',
            time: task.studentEndDate ? formatTime(task.studentEndDate) : '',
            event: {
              type: task.type === TaskTypes.test ? TaskTypes.test : TaskTypes.deadline,
              name: task.name,
              descriptionUrl: task.descriptionUrl,
            },
          } as CourseEvent);
          return acc;
        }, []),
      )
      .sort((a, b) => a.date.localeCompare(b.date));
    this.setState({ data });
  }

  render() {
    return (
      <div>
        <Header title="Schedule" username={this.props.session.githubId} />
        <Row className="text-center">
          <p>
            <Text type="danger">This is a draft version!</Text>
          </p>
          <p>Please see the actual schedule here:</p>
          <p>
            <Button
              type="primary"
              icon="calendar"
              target="_blank"
              href="https://docs.google.com/spreadsheets/d/1oM2O8DtjC0HodB3j7hcIResaWBw8P18tXkOl1ymelvE/edit#gid=1509181302"
            >
              See Schedule
            </Button>
          </p>
        </Row>
        <Row type="flex" justify="end" className="m-3">
          <Button icon="calendar" href={`/api/course/${this.props.course.id}/events/ical`}>
            Events iCal
          </Button>
        </Row>
        <Table
          className="m-3"
          rowKey={record => (record.event.type === TaskTypes.deadline ? `${record.id}d` : record.id).toString()}
          pagination={{ pageSize: 100 }}
          size="small"
          dataSource={this.state.data}
          rowClassName={record => (moment(record.date).isBefore(this.startOfToday) ? 'rs-table-row-disabled' : '')}
          columns={[
            { title: 'Date', width: 120, dataIndex: 'date', render: dateRenderer },
            { title: 'Time', width: 60, dataIndex: 'time', render: timeRenderer },
            {
              title: 'Type',
              width: 100,
              dataIndex: 'event.type',
              render: (value: keyof typeof EventTypeColor) => (
                <Tag color={EventTypeColor[value]}>{this.eventTypeToName[value] || value}</Tag>
              ),
            },
            {
              title: 'Place',
              dataIndex: 'place',
              render: (value: string) => {
                return value === 'Youtube Live' ? (
                  <div>
                    <Icon type="youtube" /> {value}{' '}
                    <Tooltip title="Ссылка будет в Discord">
                      <Icon type="question-circle" />
                    </Tooltip>
                  </div>
                ) : (
                  value
                );
              },
            },
            {
              title: 'Name',
              dataIndex: 'event.name',
              render: (value: string, record) => {
                return record.event.descriptionUrl ? (
                  <a target="_blank" href={record.event.descriptionUrl}>
                    {value}
                  </a>
                ) : (
                  value
                );
              },
            },
            {
              title: 'Broadcast Url',
              width: 140,
              dataIndex: 'broadcastUrl',
              render: (url: string) =>
                url ? (
                  <a target="_blank" href={url}>
                    Link
                  </a>
                ) : (
                  ''
                ),
            },
            {
              title: 'Organizer',
              width: 140,
              dataIndex: 'organizer.githubId',
              render: (value: string) => (value ? <GithubUserLink value={value} /> : ''),
            },
            {
              title: 'Details Url',
              dataIndex: 'detailsUrl',
              render: (url: string) =>
                url ? (
                  <a target="_blank" href={url}>
                    Details
                  </a>
                ) : (
                  ''
                ),
            },
            { title: 'Comment', dataIndex: 'comment' },
          ]}
        />
        <style jsx>{styles}</style>
      </div>
    );
  }
}

const styles = css`
  :global(.rs-table-row-disabled) {
    opacity: 0.5;
  }
`;

export default withCourseData(withSession(Form.create()(SchedulePage)));
