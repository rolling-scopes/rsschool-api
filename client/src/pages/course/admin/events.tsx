import { Button, DatePicker, Input, Form, Modal, Select, Table } from 'antd';
import { FormComponentProps } from 'antd/lib/form';
import { Header, withSession, GithubUserLink } from 'components';
import { dateRenderer, idFromArrayRenderer } from 'components/Table';
import withCourseData from 'components/withCourseData';
import moment from 'moment';
import * as React from 'react';
import { CourseEvent, CourseService } from 'services/course';
import { Event, EventService } from 'services/event';
import { formatTimezoneToUTC } from 'services/formatter';
import { CoursePageProps, PageWithModalState } from 'services/models';
import { Stage, StageService } from 'services/stage';
import { urlPattern } from 'services/validators';
import { UserService } from 'services/user';
import { UserSearch } from 'components/UserSearch';
import { DEFAULT_TIMEZONE, TIMEZONES } from '../../../configs/timezones';

type Props = CoursePageProps & FormComponentProps;

interface State extends PageWithModalState<CourseEvent> {
  events: Event[];
  stages: Stage[];
  timeZone: string;
}

class CourseEventsPage extends React.Component<Props, State> {
  state: State = {
    events: [],
    data: [],
    stages: [],
    modalData: null,
    modalAction: 'update',
    timeZone: DEFAULT_TIMEZONE,
  };

  private courseService = new CourseService();
  private userService = new UserService();

  async componentDidMount() {
    const courseId = this.props.course.id;
    const [data, stages, events] = await Promise.all([
      this.courseService.getCourseEvents(courseId),
      new StageService().getCourseStages(courseId),
      new EventService().getEvents(),
    ]);
    data.forEach(d => {
      if (!d.dateTime) {
        d.dateTime = d.date + 'T' + d.time;
      }
    });
    this.setState({ data, stages, events });
  }

  private handleTimeZoneChange = (timeZone: string) => {
    this.setState({ timeZone });
  };

  timeZoneRenderer = value => {
    return value
      ? moment(value, 'YYYY-MM-DD HH:mmZ')
          .tz(this.state.timeZone)
          .format('HH:mm')
      : '';
  };

  private refreshData = async () => {
    const courseId = this.props.course.id;
    const data = await this.courseService.getCourseEvents(courseId);
    this.setState({ data });
  };

  private handleModalSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    this.props.form.validateFields(async (err: any, values: any) => {
      if (err) {
        return;
      }
      const data = {
        place: values.place,
        dateTime: values.dateTime ? formatTimezoneToUTC(values.dateTime, values.timeZone) : undefined,
        eventId: values.eventId,
        stageId: values.stageId,
        comment: values.comment,
        courseId: this.props.course.id,
        coordinator: values.coordinator,
        organizerId: values.organizerId,
        broadcastUrl: values.broadcastUrl,
      };

      this.state.modalAction === 'update'
        ? await this.courseService.updateCourseEvent(this.props.course.id, this.state.modalData!.id!, data)
        : await this.courseService.createCourseEvent(this.props.course.id, data);

      await this.refreshData();
      this.setState({ modalData: null });
    });
  };

  render() {
    return (
      <div>
        <Header username={this.props.session.githubId} />
        <Button type="primary" className="mt-3 ml-3" onClick={this.handleAddItem}>
          Add Event
        </Button>
        <Select
          className="mt-3 ml-3"
          placeholder="Please select a timezone"
          defaultValue={this.state.timeZone}
          onChange={this.handleTimeZoneChange}
        >
          {Object.entries(TIMEZONES).map(tz => (
            <Select.Option key={tz[0]} value={tz[0]}>
              {tz[0]}
            </Select.Option>
          ))}
        </Select>
        <Table
          className="m-3"
          rowKey="id"
          pagination={{ pageSize: 100 }}
          size="small"
          dataSource={this.state.data}
          columns={[
            { title: 'Id', dataIndex: 'id' },
            {
              title: 'Name',
              dataIndex: 'eventId',
              render: idFromArrayRenderer(this.state.events),
            },
            { title: 'Type', dataIndex: 'event.type' },
            { title: 'Date', dataIndex: 'dateTime', render: dateRenderer },
            { title: 'Time', dataIndex: 'dateTime', render: this.timeZoneRenderer },
            { title: 'Place', dataIndex: 'place' },
            {
              title: 'Organizer',
              dataIndex: 'organizer.githubId',
              render: (value: string) => (value ? <GithubUserLink value={value} /> : ''),
            },
            { title: 'Comment', dataIndex: 'comment' },
            {
              title: 'Stage',
              dataIndex: 'stageId',
              render: idFromArrayRenderer(this.state.stages),
            },
            {
              title: 'Actions',
              dataIndex: 'actions',
              render: (_, record: CourseEvent) => (
                <>
                  <span>
                    <a onClick={() => this.handleEditItem(record)}>Edit</a>{' '}
                  </span>
                  <span className="ml-1 mr-1">
                    <a onClick={() => this.handleDeleteItem(record.id)}>Delete</a>
                  </span>
                </>
              ),
            },
          ]}
        />

        {this.renderModal()}
      </div>
    );
  }

  private renderModal() {
    const { getFieldDecorator: field } = this.props.form;
    const { events, stages } = this.state;
    const modalData = this.state.modalData as CourseEvent;
    if (modalData == null) {
      return null;
    }
    return (
      <Modal
        visible={!!modalData}
        title="Course Event"
        okText="Save"
        onOk={this.handleModalSubmit}
        onCancel={() => this.setState({ modalData: null })}
      >
        <Form layout="vertical">
          <Form.Item label="Event">
            {field<CourseEvent>('eventId', {
              initialValue: modalData.eventId,
              rules: [{ required: true, message: 'Please select an event' }],
            })(
              <Select placeholder="Please select an event">
                {events.map(event => (
                  <Select.Option key={event.id} value={event.id}>
                    {event.name}
                  </Select.Option>
                ))}
              </Select>,
            )}
          </Form.Item>
          <Form.Item label="Stage">
            {field<CourseEvent>('stageId', {
              initialValue: modalData.stageId,
              rules: [{ required: true, message: 'Please select a stage' }],
            })(
              <Select placeholder="Please select a stage">
                {stages.map((stage: Stage) => (
                  <Select.Option key={stage.id} value={stage.id}>
                    {stage.name}
                  </Select.Option>
                ))}
              </Select>,
            )}
          </Form.Item>
          <Form.Item label="TimeZone">
            {field('timeZone', {
              initialValue: DEFAULT_TIMEZONE,
            })(
              <Select placeholder="Please select a timezone">
                {Object.entries(TIMEZONES).map(tz => (
                  <Select.Option key={tz[0]} value={tz[0]}>
                    {tz[0]}
                  </Select.Option>
                ))}
              </Select>,
            )}
          </Form.Item>
          <Form.Item label="Date and Time">
            {field('dateTime', {
              initialValue: modalData.dateTime ? moment.tz(modalData.dateTime, DEFAULT_TIMEZONE) : null,
              rules: [{ required: false, message: 'Please enter date and time' }],
            })(<DatePicker format="YYYY-MM-DD HH:mm" showTime={{ format: 'HH:mm' }} />)}
          </Form.Item>
          <Form.Item label="Place">
            {field<CourseEvent>('place', { initialValue: modalData.place })(<Input />)}
          </Form.Item>
          <Form.Item label="Organizer">
            {field('organizerId', {
              initialValue: modalData.organizerId,
            })(
              <UserSearch
                defaultValues={modalData.organizer ? [modalData.organizer] : []}
                user={modalData.organizer}
                searchFn={this.loadUsers}
              />,
            )}
          </Form.Item>
          <Form.Item label="Broadcast URL">
            {field<CourseEvent>('broadcastUrl', {
              initialValue: modalData.broadcastUrl,
              rules: [{ pattern: urlPattern, message: 'Enter valid url' }],
            })(<Input />)}
          </Form.Item>
          <Form.Item label="Comment">
            {field<CourseEvent>('comment', { initialValue: modalData.comment })(<Input.TextArea />)}
          </Form.Item>
        </Form>
      </Modal>
    );
  }

  private loadUsers = async (searchText: string) => {
    return this.userService.searchUser(searchText);
  };

  private handleAddItem = () => this.setState({ modalData: {}, modalAction: 'create' });

  private handleEditItem = (record: CourseEvent) => this.setState({ modalData: record, modalAction: 'update' });

  private handleDeleteItem = async (id: number) => {
    await this.courseService.deleteCourseEvent(this.props.course.id, id);
    const records = await this.courseService.getCourseEvents(this.props.course.id);
    this.setState({ data: records });
  };
}

export default withCourseData(withSession(Form.create()(CourseEventsPage)));
