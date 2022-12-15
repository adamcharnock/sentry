import styled from '@emotion/styled';

import KeyValueList from 'sentry/components/events/interfaces/keyValueList';
import {t} from 'sentry/locale';
import {EventTransaction, IssueType, Organization} from 'sentry/types';

import {DataSection} from '../../eventTagsAndScreenshot/dataSection';
import TraceView from '../spans/traceView';
import {TraceContextType} from '../spans/types';
import WaterfallModel from '../spans/waterfallModel';

import {getSpanInfoFromTransactionEvent} from './utils';

interface Props {
  event: EventTransaction;
  issueType: IssueType;
  organization: Organization;
}

export type TraceContextSpanProxy = Omit<TraceContextType, 'span_id'> & {
  span_id: string; // TODO: Remove this temporary type.
};

function getEvidenceDescription(issueType: IssueType) {
  if (issueType === IssueType.PERFORMANCE_FILE_IO_MAIN_THREAD) {
    return t('Span Evidence identifies the span where the file IO occurred.');
  }
  return t(
    'Span Evidence identifies the parent span where the N+1 occurs, and the repeating spans.'
  );
}

export function SpanEvidenceSection({event, issueType, organization}: Props) {
  const spanInfo = getSpanInfoFromTransactionEvent(event);

  if (!spanInfo) {
    return null;
  }

  const {affectedSpanIds} = spanInfo;

  return (
    <DataSection
      title={t('Span Evidence')}
      description={getEvidenceDescription(issueType)}
    >
      <KeyValueList
        data={event.occurrence?.evidenceDisplay.map(item => ({
          subject: item.name,
          key: item.name,
          value: item.value,
        }))}
        isSorted={false}
      />

      <TraceViewWrapper>
        <TraceView
          organization={organization}
          waterfallModel={new WaterfallModel(event as EventTransaction, affectedSpanIds)}
          isEmbedded
        />
      </TraceViewWrapper>
    </DataSection>
  );
}

const TraceViewWrapper = styled('div')`
  border: 1px solid ${p => p.theme.innerBorder};
  border-radius: ${p => p.theme.borderRadius};
`;
