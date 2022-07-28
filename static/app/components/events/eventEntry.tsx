import Breadcrumbs from 'sentry/components/events/interfaces/breadcrumbs';
import Csp from 'sentry/components/events/interfaces/csp';
import DebugMetaV2 from 'sentry/components/events/interfaces/debugMeta-v2';
import Exception from 'sentry/components/events/interfaces/deprecatedException';
import StackTrace from 'sentry/components/events/interfaces/deprecatedStackTrace';
import Threads from 'sentry/components/events/interfaces/deprecatedThreads';
import ExceptionV2 from 'sentry/components/events/interfaces/exception';
import Generic from 'sentry/components/events/interfaces/generic';
import Message from 'sentry/components/events/interfaces/message';
import Request from 'sentry/components/events/interfaces/request';
import Spans from 'sentry/components/events/interfaces/spans';
import StackTraceV2 from 'sentry/components/events/interfaces/stackTrace';
import Template from 'sentry/components/events/interfaces/template';
import ThreadsV2 from 'sentry/components/events/interfaces/threads';
import {Group, Organization, Project, SharedViewOrganization} from 'sentry/types';
import {Entry, EntryType, Event, EventTransaction} from 'sentry/types/event';

import {FocusedSpanIDMap} from './interfaces/spans/types';

type Props = Pick<React.ComponentProps<typeof Breadcrumbs>, 'route' | 'router'> & {
  entry: Entry;
  event: Event;
  organization: SharedViewOrganization | Organization;
  projectSlug: Project['slug'];
  group?: Group;
};

function EventEntry({
  entry,
  projectSlug,
  event,
  organization,
  group,
  route,
  router,
}: Props) {
  const hasHierarchicalGrouping =
    !!organization.features?.includes('grouping-stacktrace-ui') &&
    !!(event.metadata.current_tree_label || event.metadata.finest_tree_label);

  const hasNativeStackTraceV2 = !!organization.features?.includes(
    'native-stack-trace-v2'
  );

  const groupingCurrentLevel = group?.metadata?.current_level;

  switch (entry.type) {
    case EntryType.EXCEPTION: {
      const {data, type} = entry;
      return hasNativeStackTraceV2 ? (
        <ExceptionV2
          type={type}
          event={event}
          data={data}
          projectId={projectSlug}
          groupingCurrentLevel={groupingCurrentLevel}
          hasHierarchicalGrouping={hasHierarchicalGrouping}
        />
      ) : (
        <Exception
          type={type}
          event={event}
          data={data}
          projectId={projectSlug}
          groupingCurrentLevel={groupingCurrentLevel}
          hasHierarchicalGrouping={hasHierarchicalGrouping}
        />
      );
    }
    case EntryType.MESSAGE: {
      const {data} = entry;
      return <Message data={data} />;
    }
    case EntryType.REQUEST: {
      const {data, type} = entry;
      return <Request type={type} event={event} data={data} />;
    }
    case EntryType.STACKTRACE: {
      const {data, type} = entry;
      return hasNativeStackTraceV2 ? (
        <StackTraceV2
          type={type}
          event={event}
          data={data}
          projectId={projectSlug}
          groupingCurrentLevel={groupingCurrentLevel}
          hasHierarchicalGrouping={hasHierarchicalGrouping}
        />
      ) : (
        <StackTrace
          type={type}
          event={event}
          data={data}
          projectId={projectSlug}
          groupingCurrentLevel={groupingCurrentLevel}
          hasHierarchicalGrouping={hasHierarchicalGrouping}
        />
      );
    }
    case EntryType.TEMPLATE: {
      const {data, type} = entry;
      return <Template type={type} event={event} data={data} />;
    }
    case EntryType.CSP: {
      const {data} = entry;
      return <Csp event={event} data={data} />;
    }
    case EntryType.EXPECTCT:
    case EntryType.EXPECTSTAPLE:
    case EntryType.HPKP: {
      const {data, type} = entry;
      return <Generic type={type} data={data} />;
    }
    case EntryType.BREADCRUMBS: {
      const {data, type} = entry;
      return (
        <Breadcrumbs
          type={type}
          data={data}
          organization={organization as Organization}
          event={event}
          router={router}
          route={route}
        />
      );
    }
    case EntryType.THREADS: {
      const {data, type} = entry;
      return hasNativeStackTraceV2 ? (
        <ThreadsV2
          type={type}
          event={event}
          data={data}
          projectId={projectSlug}
          groupingCurrentLevel={groupingCurrentLevel}
          hasHierarchicalGrouping={hasHierarchicalGrouping}
        />
      ) : (
        <Threads
          type={type}
          event={event}
          data={data}
          projectId={projectSlug}
          groupingCurrentLevel={groupingCurrentLevel}
          hasHierarchicalGrouping={hasHierarchicalGrouping}
        />
      );
    }
    case EntryType.DEBUGMETA:
      const {data} = entry;

      return (
        <DebugMetaV2
          event={event}
          projectId={projectSlug}
          groupId={group?.id}
          organization={organization as Organization}
          data={data as React.ComponentProps<typeof DebugMetaV2>['data']}
        />
      );
    case EntryType.SPANS:
      return (
        <Spans
          event={event as EventTransaction}
          organization={organization as Organization}
        />
      );
    case EntryType.SPANTREE:
      if (!organization.features?.includes('performance-extraneous-spans-poc')) {
        return null;
      }

      const {focusedSpanIds: _focusedSpanIds} = entry;

      const focusedSpanIds: FocusedSpanIDMap = {};
      _focusedSpanIds.forEach(spanId => (focusedSpanIds[spanId] = new Set()));

      return (
        <Spans
          event={event as EventTransaction}
          organization={organization as Organization}
          focusedSpanIds={focusedSpanIds}
        />
      );
    default:
      // this should not happen
      /* eslint no-console:0 */
      window.console &&
        console.error &&
        console.error('Unregistered interface: ' + (entry as any).type);
      return null;
  }
}

export default EventEntry;
