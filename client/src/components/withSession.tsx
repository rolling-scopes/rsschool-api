import * as React from 'react';
import axios from 'axios';
import { LoadingScreen } from './LoadingScreen';
import Router from 'next/router';
import {TYPES} from "../configs/registry";

export type Role = 'student' | 'mentor' | 'coursemanager';

export interface Session {
  id: number;
  githubId: string;
  isAdmin: boolean;
  isHirer: boolean;
  isActivist: boolean;
  roles: { [key: number]: Role };
  coursesRoles?: { [key: string]: ('taskOwner' | 'juryActivist' | 'manager' | 'supervisor')[] | undefined };
}

type State = {
  session?: Session;
  isLoading: boolean;
};

let sessionCache: Session | undefined;

function withSession(WrappedComponent: React.ComponentType<any>, requiredRole?: Role) {
  return class extends React.Component<any, State> {
    state: State = {
      isLoading: true,
      session: undefined,
    };

    async componentDidMount() {
      if (sessionCache != null) {
        this.setState({ session: sessionCache, isLoading: false });
        return;
      }
      try {
        const response = await axios.get(`/api/session`);
        this.setState({ isLoading: false });
        sessionCache = response.data.data;
        this.setState({ session: sessionCache });
      } catch (e) {
        this.setState({ isLoading: false });
        Router.push('/login', {
          pathname: '/login',
          query: {
            url: encodeURIComponent(document.location.pathname + document.location.search),
          },
        });
      }
    }

    render() {
      if (this.state.session && requiredRole) {
        const { roles, isAdmin } = this.state.session;
        if (roles[this.props.course.id] !== requiredRole && !isAdmin && roles[this.props.course.id] !== TYPES.MENTOR) {
          return (
            <h4 className="m-5 d-flex justify-content-center">
              You are not [{requiredRole}] in {this.props.course.alias}
            </h4>
          );
        }
      }
      return (
        <LoadingScreen show={this.state.isLoading}>
          {this.state.session && <WrappedComponent session={this.state.session} {...this.props} />}
        </LoadingScreen>
      );
    }
  };
}

export default withSession;
export { withSession };
