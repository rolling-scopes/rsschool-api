import { Spin, Layout } from 'antd';

const { Content } = Layout;

type Props = { loading: boolean; githubId: string; courseName?: string; title?: string; children?: any };

export function RegistrationPageLayout(props: Props) {
  return (
    <Layout style={{ backgroundColor: '#F5F5F5', height: '100vh' }}>
      <Content>
        <Spin spinning={props.loading}>{props.children}</Spin>
      </Content>
    </Layout>
  );
}
