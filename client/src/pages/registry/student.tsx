import { Button, Col, Form, Input, message, Result, Row, Select, Typography, Tooltip } from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';
import axios from 'axios';
import { RegistrationPageLayout } from 'components';
import { LocationSelect } from 'components/Forms';
import { NoCourses } from 'components/Registry/NoCourses';
import withSession from 'components/withSession';
import { withGoogleMaps } from 'components/withGoogleMaps';
import { useCallback, useState, useEffect } from 'react';
import { useAsync, useUpdate } from 'react-use';
import { CoursesService } from 'services/courses';
import { formatMonthFriendly } from 'services/formatter';
import { Course } from 'services/models';
import { UserFull, UserService } from 'services/user';
import { emailPattern, englishNamePattern } from 'services/validators';
import { Props, TYPES } from './../../configs/registry';
import { NextPageContext } from 'next';
import { Location } from '../../../../common/models';
import { css } from 'styled-jsx/css';

const defaultRowGutter = 24;
const TEXT_LOCATION_TOOLTIP = 'We need your location for understanding the audience and for mentor distribution.';
const TEXT_EMAIL_TOOLTIP = 'No spam e-mails. Only for course purposes.';

function Page(props: Props & { courseAlias?: string }) {
  const [form] = Form.useForm();
  const update = useUpdate();
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [courses, setCourses] = useState([] as Course[]);
  const [location, setLocation] = useState(null as Location | null);
  const [initialData, setInitialData] = useState({} as Partial<UserFull>);

  useAsync(async () => {
    setLoading(true);
    const userService = new UserService();
    const courseService = new CoursesService();
    const [profile, courses] = await Promise.all([userService.getMyProfile(), courseService.getCourses()]);
    const activeCourses = props.courseAlias
      ? courses.filter((course: Course) => course.alias === props.courseAlias)
      : courses.filter(isCourseOpenForRegistry).sort(sortByStartDate);

    setCourses(activeCourses);
    setInitialData(profile);
    setLoading(false);
  }, []);

  useEffect(() => {
    setLocation({
      countryName: initialData.countryName,
      cityName: initialData.cityName,
    } as Location);
  }, [initialData]);

  const handleSubmit = useCallback(
    async (values: any) => {
      if (loading) {
        return;
      }
      setLoading(true);
      const { courseId, location, primaryEmail, firstName, lastName } = values;
      const registryModel = { type: TYPES.STUDENT, courseId };
      const userModel = {
        cityName: location.cityName,
        countryName: location.countryName,
        primaryEmail,
        firstName,
        lastName,
      };

      try {
        const userResponse = await axios.post('/api/profile/me', userModel);
        const githubId = userResponse && userResponse.data ? userResponse.data.data.githubId : '';
        if (githubId) {
          await axios.post('/api/registry', registryModel);
          setSubmitted(true);
        } else {
          message.error('Invalid github id');
        }
      } catch (e) {
        message.error('An error occured. Please try later.');
      } finally {
        setLoading(false);
      }
    },
    [loading],
  );

  let content: React.ReactNode;
  if (loading) {
    content = undefined;
  } else if (!courses.length) {
    content = <NoCourses />;
  } else if (submitted) {
    content = (
      <Result
        status="success"
        title="You have successfully registered."
        extra={
          <Button type="primary" href="/">
            Go to Home
          </Button>
        }
      />
    );
  } else {
    content = (
      <Form
        layout="vertical"
        style={{ margin: '104px 10px', height: '100%' }}
        form={form}
        initialValues={getInitialValues(initialData, courses)}
        onChange={update}
        onFinish={(values: any) => handleSubmit({ ...values, location })}
      >
        <div className="student-registration">
          <div className="student-registration-slide">
            <header>
              <img className="rss-logo" src="/static/images/logo-rsschool3.png" alt="Rolling Scopes School Logo" />
              <p className="rss-logo-descriptions">Free courses from the developer community</p>
            </header>
            <footer>
              <img className="logo" src="/static/svg/logo-github.svg" alt="GitHub Logo" />
              <img className="logo-rs" src="/static/svg/logo-rs.svg" alt="Rolling Scopes Logo" />
              <img className="logo" src="/static/svg/logo-epam.svg" alt="EPAM Logo" />
            </footer>
          </div>
          <div className="student-registration-content">
            <Col>
              <Row>
                <Typography.Title level={3} style={{ margin: '8px 0 40px' }}>
                  Welcome to RS School!
                </Typography.Title>
              </Row>
              <Row>
                <Typography.Title level={5}>Course</Typography.Title>
              </Row>
              <Row gutter={defaultRowGutter}>
                <Col xs={24} sm={24} md={20} lg={20} xl={20}>
                  <Form.Item name="courseId">
                    <Select placeholder="Select course...">
                      {courses.map(course => (
                        <Select.Option key={course.id} value={course.id}>
                          {course.name} ({course.primarySkillName}, {formatMonthFriendly(course.startDate)})
                        </Select.Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={defaultRowGutter}>
                <Col xs={24} sm={12} md={10} lg={10} xl={10} style={{ marginBottom: 24 }}>
                  <Row>
                    <Typography.Title level={5}>First Name</Typography.Title>
                  </Row>
                  <Row>
                    <Col xs={24} sm={24} md={24} lg={24} xl={24}>
                      <Form.Item
                        name="firstName"
                        style={{ marginBottom: '0' }}
                        rules={[{ pattern: englishNamePattern, message: 'First name should be in English' }]}
                      >
                        <Input placeholder="Dzmitry" />
                      </Form.Item>
                    </Col>
                  </Row>
                  <span className="descriptions-name">In English, as in passport</span>
                </Col>
                <Col xs={24} sm={12} md={10} lg={10} xl={10} style={{ marginBottom: 24 }}>
                  <Row>
                    <Typography.Title level={5}>Last Name</Typography.Title>
                  </Row>
                  <Row>
                    <Col xs={24} sm={24} md={24} lg={24} xl={24}>
                      <Form.Item
                        name="lastName"
                        style={{ marginBottom: '0' }}
                        rules={[{ pattern: englishNamePattern, message: 'Last name should be in English' }]}
                      >
                        <Input placeholder="Varabei" />
                      </Form.Item>
                    </Col>
                  </Row>
                  <span className="descriptions-name last">In English, as in passport</span>
                </Col>
              </Row>
              <Row gutter={defaultRowGutter}>
                <Col xs={24} sm={24} md={20} lg={20} xl={20}>
                  <Row>
                    <Typography.Title level={5}>Location {getInfoCircle(TEXT_LOCATION_TOOLTIP)}</Typography.Title>
                  </Row>
                  <Row>
                    <Col xs={24} sm={24} md={24} lg={24} xl={24}>
                      <Form.Item
                        name="location"
                        rules={[{ required: true, message: 'Please select city' }]}
                        valuePropName={'location'}
                      >
                        <LocationSelect onChange={setLocation} location={location} />
                      </Form.Item>
                    </Col>
                  </Row>
                </Col>
              </Row>
              <Row gutter={defaultRowGutter}>
                <Col xs={24} sm={24} md={20} lg={20} xl={20} style={{ marginBottom: 16 }}>
                  <Row>
                    <Typography.Title level={5}>E-mail {getInfoCircle(TEXT_EMAIL_TOOLTIP)}</Typography.Title>
                  </Row>
                  <Row>
                    <Col xs={24} sm={24} md={24} lg={24} xl={24}>
                      <Form.Item
                        name="primaryEmail"
                        rules={[{ required: true, pattern: emailPattern, message: 'Email is required' }]}
                      >
                        <Input placeholder="user@example.com" />
                      </Form.Item>
                    </Col>
                  </Row>
                </Col>
              </Row>
              <Row gutter={defaultRowGutter}>
                <Col xs={24} sm={24} md={20} lg={20} xl={20}>
                  <span>
                    Pushing the button I agree with the processing my personal data, contained in the application, and
                    sharing it with companies only for students employment purposes.
                  </span>
                </Col>
              </Row>
              <Row>
                <Button size="large" type="primary" htmlType="submit" style={{ marginTop: 16 }}>
                  Submit
                </Button>
              </Row>
            </Col>
          </div>
        </div>
        <style jsx>{styles}</style>
      </Form>
    );
  }

  return (
    <RegistrationPageLayout loading={loading} githubId={props.session.githubId}>
      {content}
    </RegistrationPageLayout>
  );
}

function sortByStartDate(a: Course, b: Course) {
  return a.startDate.localeCompare(b.startDate);
}

function isCourseOpenForRegistry(course: Course) {
  // invite only courses do not open for public registration
  if (course.inviteOnly || course.completed) {
    return false;
  }
  if (course.planned) {
    return true;
  }
  if (course.registrationEndDate) {
    return new Date(course.registrationEndDate).getTime() > Date.now();
  }
  return false;
}

function getInitialValues({ countryName, cityName, ...initialData }: Partial<UserFull>, courses: Course[]) {
  const location =
    countryName &&
    cityName &&
    ({
      countryName,
      cityName,
    } as Location | null);
  return {
    ...initialData,
    courseId: courses[0].id,
    location,
  };
}

const RegistryStudentPage: any = withGoogleMaps(withSession(Page));
RegistryStudentPage.getInitialProps = async (context: NextPageContext) => {
  try {
    const courseAlias = context.query.course;
    return { courseAlias };
  } catch (e) {
    console.error(e.message);
    return { courseAlias: undefined };
  }
};

const getInfoCircle = (text: string) => {
  return (
    <Tooltip title={text} color="#000000bf">
      <InfoCircleOutlined style={{ fontSize: 13 }} />
    </Tooltip>
  );
};

const styles = css`
  .student-registration {
    max-width: 970px;
    margin: 0 auto;
    background-color: #fff;
    display: flex;
    font-size: 12px;
    box-shadow: 1px 1px 10px #59595940;
  }
  .ant-typography {
    font-size: 14px;
  }
  .rss-logo {
    margin: 38px 24px 0 24px;
    height: 64px;
    -webkit-filter: invert(100%);
    filter: invert(100%);
  }
  .rss-logo-descriptions {
    margin: 32px 24px 0 24px;
    padding: 4px 0;
    font-size: 14px;
    font-weight: 700;
    background-color: #ffec3d;
    text-align: center;
  }
  .student-registration-slide {
    background-color: #141414;
    width: 350px;
    flex: 2;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }
  footer {
    display: flex;
    justify-content: space-around;
    align-items: center;
    padding: 0 10px 30px;
  }
  .student-registration-content {
    padding: 32px 10px 80px 24px;
    flex: 3;
  }
  .descriptions-name {
    color: rgba(0, 0, 0, 0.45);
  }
  .descriptions-name.last {
    visibility: hidden;
  }
  .logo {
    height: 20px;
  }
  .logo-rs {
    height: 40px;
  }
  @media (max-width: 768px) {
    .student-registration-content {
      padding: 32px 24px 80px 24px;
    }
    .student-registration-slide {
      background-color: #141414;
      width: 220px;
    }
  }
  @media (max-width: 575px) {
    .student-registration {
      flex-direction: column;
    }
    .student-registration-slide {
      background-color: #141414;
      width: 100%;
      display: flex;
      justify-content: center;
      flex-direction: column;
    }
    .rss-logo {
      margin: 22px auto;
      height: 45px;
      -webkit-filter: invert(100%);
      filter: invert(100%);
    }
    .rss-logo-descriptions {
      margin: 0 16px 16px;
    }
    .descriptions-name.last {
      visibility: visible;
    }
    footer {
      display: none;
    }
    header {
      display: contents;
    }
  }
`;

export default RegistryStudentPage;
