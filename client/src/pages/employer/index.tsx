import React, { useState, useCallback, useEffect } from 'react';
// TODO: uncomment after testing
import { Layout, Table, List, Typography, Row, Col, Badge, Avatar, Popconfirm /* Result */, Tooltip } from 'antd';
import { LoadingScreen } from 'components/LoadingScreen';
import { getColumnSearchProps } from 'components/Table';
import { Header, FooterLayout } from 'components';
import { NextRouter, withRouter } from 'next/router';
import withSession, { Session } from 'components/withSession';
import { CVService } from '../../services/cv';
import heroesBadges from '../../configs/heroes-badges';
import { DeleteOutlined } from '@ant-design/icons';

const { Content } = Layout;
const { Text } = Typography;
const { Item } = List;

type Props = {
  router: NextRouter;
  session: Session;
};

type State = {
  isLoading: boolean;
  users: any;
};

function Page(props: Props) {
  const [state, setState] = useState<State>({
    isLoading: false,
    users: null,
  });

  const cvService = new CVService();

  const countBadges = (badges: any) => {
    const badgesCount: any = {};

    badges.forEach(({ badgeId }: { badgeId: any }) => {
      if (badgeId) {
        badgesCount[badgeId] ? (badgesCount[badgeId] += 1) : (badgesCount[badgeId] = 1);
      }
    });

    return badgesCount;
  };

  const columns = [
    {
      title: 'Name',
      dataIndex: 'complexData',
      key: 'complexData',
      render: (data: any) => {
        const { name, githubId } = data;
        // TODO: ucnomment after testing
        /*         const { isAdmin } = props.session; */

        return (
          <>
            <a href={`/cv?githubId=${githubId}`}>{name}</a>
            {/* TODO: ucnomment after testing */}
            {/*             {isAdmin && ( */}
            <Popconfirm
              title="Are you sure you want to remove this user?"
              onConfirm={() => removeJobSeeker(githubId)}
              okText="Yes"
              cancelText="No"
            >
              <DeleteOutlined />
            </Popconfirm>
            {/* TODO: ucnomment after testing */}
            {/* )} */}
          </>
        );
      },
      ...getColumnSearchProps('name'),
    },
    {
      title: 'CV expires',
      dataIndex: 'expires',
      key: 'expires',
      render: (expirationTimestamp: number) => {
        const expirationDate = new Date(expirationTimestamp);
        const addZeroPadding = (num: number) => `0${num}`.slice(-2);
        const [year, month, date] = [
          expirationDate.getFullYear(),
          expirationDate.getMonth() + 1,
          expirationDate.getDate(),
        ];
        const expirationDateFormatted = `${year}-${addZeroPadding(month)}-${addZeroPadding(date)}`;
        return <Text>{expirationDateFormatted}</Text>;
      },
      ...getColumnSearchProps('expires'),
    },
    {
      title: 'Desired postion',
      dataIndex: 'desiredPosition',
      key: 'desiredPosition',
      ...getColumnSearchProps('desiredPosition'),
    },
    {
      title: 'Location',
      dataIndex: 'location',
      key: 'location',
      ...getColumnSearchProps('location'),
    },
    {
      title: 'English level',
      dataIndex: 'englishLevel',
      key: 'englishLevel',
      ...getColumnSearchProps('englishLevel'),
    },
    {
      title: 'Full time',
      dataIndex: 'fullTime',
      key: 'fullTime',
      ...getColumnSearchProps('fullTime'),
    },
    {
      title: 'Start from',
      dataIndex: 'startFrom',
      key: 'startFrom',
      ...getColumnSearchProps('startFrom'),
    },
    {
      title: 'Courses',
      dataIndex: 'courses',
      key: 'courses',
      ...getColumnSearchProps('courses.courseFullName'),
      render: (courses: any) => {
        if (!courses) return 'No courses';
        return (
          <List
            dataSource={courses}
            renderItem={(record: any) => {
              const {
                courseFullName,
                courseName,
                locationName,
                isExpelled,
                certificateId,
                isCourseCompleted,
                totalScore,
                position,
                mentor: { name: mentorName, githubId: mentorGithubId },
              } = record;
              const title = `${courseFullName}${locationName ? locationName : ''}`;
              const certificateLink = certificateId ? `https://app.rs.school/certificate/${certificateId}` : '';
              const courseStats = (
                <>
                  <Text style={{ whiteSpace: 'nowrap' }}>Score: {totalScore}</Text>
                  <br />
                  <Text style={{ whiteSpace: 'nowrap' }}>Position: {position}</Text>
                </>
              );
              let courseStatus;
              if (isExpelled) {
                courseStatus = <Text>Expelled</Text>;
              } else if (certificateId) {
                courseStatus = (
                  <>
                    <Text>Completed with </Text>
                    <a href={certificateLink}>certificate</a>
                  </>
                );
              } else if (isCourseCompleted) {
                courseStatus = <Text>Completed</Text>;
              } else {
                courseStatus = <Text>In progress</Text>;
              }

              return (
                <Item style={{ fontSize: '14px' }}>
                  <details>
                    <summary>{courseName}</summary>
                    <Row justify="space-between" style={{ width: '100%' }}>
                      <Col span={12}>
                        <Text strong>{title}</Text>
                        <br />
                        <Text>Course status: </Text>
                        {courseStatus}
                      </Col>
                      <Col span={3}>
                        <Text>
                          Mentor: <a href={`https://github.com/${mentorGithubId}`}>{mentorName}</a>
                        </Text>
                      </Col>
                      <Col span={3}>
                        <Text>{courseStats}</Text>
                      </Col>
                    </Row>
                  </details>
                </Item>
              );
            }}
          />
        );
      },
    },
    {
      title: 'Public feedback',
      dataIndex: 'feedback',
      key: 'feedback',
      render: (badges: any) => {
        if (!badges.length) return 'No public feedback yet';
        const badgesCount = countBadges(badges);
        return Object.keys(badgesCount).map(badgeId => (
          <div style={{ margin: 5, display: 'inline-block' }} key={`badge-${badgeId}`}>
            <Tooltip title={`${(heroesBadges as any)[badgeId].name} badge`}>
              <Badge count={badgesCount[badgeId]}>
                <Avatar
                  src={`/static/svg/badges/${(heroesBadges as any)[badgeId].url}`}
                  alt={`${(heroesBadges as any)[badgeId].name} badge`}
                  size={50}
                />
              </Badge>
            </Tooltip>
          </div>
        ));
      },
    },
  ];

  const fetchData = useCallback(async () => {
    await setState({ ...state, isLoading: true });
    const data = await cvService.getJobSeekersData();
    await setState({ ...state, users: data, isLoading: false });
  }, []);

  const removeJobSeeker = async (githubId: string) => {
    await setState({ ...state, isLoading: true });
    await cvService.changeOpportunitiesConsent(githubId, false);
    await setState({ ...state, isLoading: false });
  };

  useEffect(() => {
    fetchData();
  }, []);

  // TODO: ucnomment after testing
  const { /* isAdmin, isHirer, */ githubId: userGithubId } = props.session;

  /*     if (!(isAdmin || isHirer)) return (
    <Result status="403" title="Sorry, but you don't have access to this page" />
  ); */

  const { isLoading, users } = state;

  let data;

  if (users) {
    data = users.map((item: any, index: any) => {
      const {
        name,
        fullTime,
        githubId,
        startFrom,
        englishLevel,
        desiredPosition,
        courses,
        feedback,
        location,
        expires,
      } = item;
      return {
        key: index,
        complexData: { name, githubId },
        expires: Number(expires),
        courses,
        feedback,
        desiredPosition,
        fullTime: fullTime ? 'Yes' : 'No',
        location,
        startFrom,
        englishLevel: englishLevel.toUpperCase(),
      };
    });
  } else {
    data = null;
  }

  return (
    <>
      <Header username={userGithubId} />
      <LoadingScreen show={isLoading}>
        <Layout style={{ margin: 'auto', backgroundColor: '#FFF' }}>
          <Content style={{ backgroundColor: '#FFF', minHeight: '500px', margin: 'auto' }}>
            <Table style={{ minWidth: '99vw' }} columns={columns} dataSource={data}></Table>
          </Content>
        </Layout>
      </LoadingScreen>
      <FooterLayout />
    </>
  );
}

export default withRouter(withSession(Page));
