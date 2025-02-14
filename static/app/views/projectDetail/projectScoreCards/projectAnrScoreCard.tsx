import {Fragment, useEffect, useState} from 'react';
import round from 'lodash/round';

import {doSessionsRequest} from 'sentry/actionCreators/sessions';
import {shouldFetchPreviousPeriod} from 'sentry/components/charts/utils';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import {parseStatsPeriod} from 'sentry/components/organizations/timeRangeSelector/utils';
import ScoreCard from 'sentry/components/scoreCard';
import {IconArrow} from 'sentry/icons/iconArrow';
import {t} from 'sentry/locale';
import {PageFilters} from 'sentry/types';
import {Organization, SessionApiResponse} from 'sentry/types/organization';
import {formatAbbreviatedNumber, formatPercentage} from 'sentry/utils/formatters';
import {getPeriod} from 'sentry/utils/getPeriod';
import useApi from 'sentry/utils/useApi';
import {
  getSessionTermDescription,
  SessionTerm,
} from 'sentry/views/releases/utils/sessionTerm';

type Props = {
  isProjectStabilized: boolean;
  organization: Organization;
  selection: PageFilters;
  query?: string;
};

export function ProjectAnrScoreCard({
  isProjectStabilized,
  organization,
  selection,
  query,
}: Props) {
  const {environments, projects, datetime} = selection;
  const {start, end, period} = datetime;

  const api = useApi();

  const [sessionsData, setSessionsData] = useState<SessionApiResponse | null>(null);
  const [previousSessionData, setPreviousSessionsData] =
    useState<SessionApiResponse | null>(null);

  useEffect(() => {
    let unmounted = false;

    const requestData = {
      orgSlug: organization.slug,
      field: ['foreground_anr_rate()'],
      environment: environments,
      project: projects,
      query,
      includeSeries: false,
    };

    doSessionsRequest(api, {...requestData, ...normalizeDateTimeParams(datetime)}).then(
      response => {
        if (unmounted) {
          return;
        }

        setSessionsData(response);
      }
    );
    return () => {
      unmounted = true;
    };
  }, [api, datetime, environments, organization.slug, projects, query]);

  useEffect(() => {
    let unmounted = false;
    if (
      !shouldFetchPreviousPeriod({
        start,
        end,
        period,
      })
    ) {
      setPreviousSessionsData(null);
    } else {
      const requestData = {
        orgSlug: organization.slug,
        field: ['foreground_anr_rate()'],
        environment: environments,
        project: projects,
        query,
        includeSeries: false,
      };

      const {start: previousStart} = parseStatsPeriod(
        getPeriod({period, start: undefined, end: undefined}, {shouldDoublePeriod: true})
          .statsPeriod!
      );

      const {start: previousEnd} = parseStatsPeriod(
        getPeriod({period, start: undefined, end: undefined}, {shouldDoublePeriod: false})
          .statsPeriod!
      );

      doSessionsRequest(api, {
        ...requestData,
        start: previousStart,
        end: previousEnd,
      }).then(response => {
        if (unmounted) {
          return;
        }

        setPreviousSessionsData(response);
      });
    }
    return () => {
      unmounted = true;
    };
  }, [start, end, period, api, organization.slug, environments, projects, query]);

  const value = sessionsData
    ? sessionsData.groups[0].totals['foreground_anr_rate()']
    : null;

  const previousValue = previousSessionData
    ? previousSessionData.groups[0].totals['foreground_anr_rate()']
    : null;

  const hasCurrentAndPrevious = previousValue && value;
  const trend = hasCurrentAndPrevious ? round(value - previousValue, 4) : null;
  const trendStatus = !trend ? undefined : trend < 0 ? 'good' : 'bad';

  if (!isProjectStabilized) {
    return null;
  }

  function renderTrend() {
    return trend ? (
      <Fragment>
        {trend >= 0 ? (
          <IconArrow direction="up" size="xs" />
        ) : (
          <IconArrow direction="down" size="xs" />
        )}
        {`${formatAbbreviatedNumber(Math.abs(trend))}\u0025`}
      </Fragment>
    ) : null;
  }

  return (
    <ScoreCard
      title={t('Foreground ANR Rate')}
      help={getSessionTermDescription(SessionTerm.FOREGROUND_ANR_RATE, null)}
      score={value ? formatPercentage(value, 3) : '\u2014'}
      trend={renderTrend()}
      trendStatus={trendStatus}
    />
  );
}
