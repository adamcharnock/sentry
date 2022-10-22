import {InjectedRouter} from 'react-router';
import {ProjectDetails} from 'fixtures/js-stubs/projectDetails.js';
import {Location} from 'history';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import {Organization} from 'sentry/types';
import {OrganizationContext} from 'sentry/views/organizationContext';
import {RouteContext} from 'sentry/views/routeContext';
import ProjectSecurityAndPrivacy from 'sentry/views/settings/projectSecurityAndPrivacy';

function ComponentProviders({
  router,
  location,
  organization,
  children,
}: {
  children: React.ReactNode;
  location: Location;
  organization: Organization;
  router: InjectedRouter;
}) {
  return (
    <OrganizationContext.Provider value={organization}>
      <RouteContext.Provider
        value={{
          router,
          location,
          params: {},
          routes: [],
        }}
      >
        {children}
      </RouteContext.Provider>
    </OrganizationContext.Provider>
  );
}

describe('projectSecurityAndPrivacy', function () {
  it('renders form fields', function () {
    const {organization, router} = initializeOrg();
    const project = ProjectDetails();

    render(
      <ComponentProviders
        organization={organization}
        router={router}
        location={router.location}
      >
        <ProjectSecurityAndPrivacy project={project} organization={organization} />
      </ComponentProviders>
    );

    expect(
      screen.getByRole('checkbox', {
        name: 'Enable server-side data scrubbing',
      })
    ).not.toBeChecked();

    expect(
      screen.getByRole('checkbox', {
        name: 'Enable to apply default scrubbers to prevent things like passwords and credit cards from being stored',
      })
    ).not.toBeChecked();

    expect(
      screen.getByRole('checkbox', {
        name: 'Enable to prevent IP addresses from being stored for new events',
      })
    ).not.toBeChecked();

    expect(
      screen.getByRole('textbox', {
        name: 'Enter field names which data scrubbers should ignore. Separate multiple entries with a newline',
      })
    ).toHaveValue('business-email\ncompany');

    expect(
      screen.getByRole('textbox', {
        name: 'Enter additional field names to match against when scrubbing data. Separate multiple entries with a newline',
      })
    ).toHaveValue('creditcard\nssn');

    expect(
      screen.getByRole('textbox', {
        name: 'Enter additional field names to match against when scrubbing data. Separate multiple entries with a newline',
      })
    ).toHaveValue('creditcard\nssn');
  });

  it('disables field when equivalent org setting is true', function () {
    const {organization, router} = initializeOrg();
    const project = ProjectDetails();

    organization.dataScrubber = true;
    organization.scrubIPAddresses = false;

    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/`,
      method: 'GET',
      body: project,
    });

    render(
      <ComponentProviders
        organization={organization}
        router={router}
        location={router.location}
      >
        <ProjectSecurityAndPrivacy project={project} organization={organization} />
      </ComponentProviders>
    );

    expect(
      screen.getByRole('checkbox', {
        name: 'Enable to prevent IP addresses from being stored for new events',
      })
    ).toBeEnabled();

    expect(
      screen.getByRole('checkbox', {
        name: 'Enable to prevent IP addresses from being stored for new events',
      })
    ).not.toBeChecked();

    expect(
      screen.getByRole('checkbox', {name: 'Enable server-side data scrubbing'})
    ).toBeDisabled();

    expect(
      screen.getByRole('checkbox', {name: 'Enable server-side data scrubbing'})
    ).toBeChecked();
  });
});
