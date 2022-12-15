import EventDataSection from 'sentry/components/events/eventDataSection';
import KeyValueList from 'sentry/components/events/interfaces/keyValueList';
import {Event, Group, IssueCategory} from 'sentry/types';

type EvidenceProps = {event: Event; group?: Group};

const Evidence = ({event, group}: EvidenceProps) => {
  const evidenceDisplay = event.occurrence?.evidenceDisplay;

  if (!evidenceDisplay?.length || group?.issueCategory === IssueCategory.PERFORMANCE) {
    return null;
  }

  return (
    <EventDataSection title="Evidence" type="evidence">
      <KeyValueList
        data={evidenceDisplay.map(item => ({
          subject: item.name,
          key: item.name,
          value: item.value,
        }))}
        isSorted={false}
      />
    </EventDataSection>
  );
};

export default Evidence;
