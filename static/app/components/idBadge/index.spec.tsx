import {Organization} from 'fixtures/js-stubs/organization.js';
import {Project} from 'fixtures/js-stubs/project.js';
import {Team} from 'fixtures/js-stubs/team.js';
import {User} from 'fixtures/js-stubs/user.js';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import IdBadge from 'sentry/components/idBadge';

describe('IdBadge', function () {
  it('renders the correct component when `user` property is passed', function () {
    const user = User();
    render(<IdBadge user={user} />);
    expect(screen.getByTestId('letter_avatar-avatar')).toHaveTextContent('FB');
    expect(screen.getByText(user.email)).toBeInTheDocument();
  });

  it('renders the correct component when `team` property is passed', function () {
    render(<IdBadge team={Team()} />);
    expect(screen.getByTestId('badge-styled-avatar')).toHaveTextContent('TS');
    expect(screen.getByTestId('badge-display-name')).toHaveTextContent('#team-slug');
  });

  it('renders the correct component when `project` property is passed', function () {
    render(<IdBadge project={Project()} />);
    expect(screen.getByTestId('badge-display-name')).toHaveTextContent('project-slug');
  });

  it('renders the correct component when `organization` property is passed', function () {
    render(<IdBadge organization={Organization()} />);
    expect(screen.getByTestId('badge-styled-avatar')).toHaveTextContent('OS');
    expect(screen.getByTestId('badge-display-name')).toHaveTextContent('org-slug');
  });

  it('throws when no valid properties are passed', function () {
    // Error is expected, do not fail when calling console.error
    jest.spyOn(console, 'error').mockImplementation();
    expect(() => render(<IdBadge />)).toThrow();
  });
});
