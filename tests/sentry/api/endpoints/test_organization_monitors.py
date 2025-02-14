from unittest.mock import patch

from sentry.models import Monitor, MonitorStatus, MonitorType, ScheduleType
from sentry.testutils import APITestCase
from sentry.testutils.silo import region_silo_test


class OrganizationMonitorsTestBase(APITestCase):
    endpoint = "sentry-api-0-organization-monitors"

    def setUp(self):
        super().setUp()
        self.login_as(self.user)


@region_silo_test(stable=True)
class ListOrganizationMonitorsTest(OrganizationMonitorsTestBase):
    def check_valid_response(self, response, expected_monitors):
        assert [str(monitor.guid) for monitor in expected_monitors] == [
            str(monitor_resp["id"]) for monitor_resp in response.data
        ]

    def test_simple(self):
        monitor = Monitor.objects.create(
            project_id=self.project.id,
            organization_id=self.organization.id,
            name="My Monitor",
        )
        response = self.get_success_response(self.organization.slug)
        self.check_valid_response(response, [monitor])


@region_silo_test(stable=True)
class CreateOrganizationMonitorTest(OrganizationMonitorsTestBase):
    method = "post"

    @patch("sentry.analytics.record")
    def test_simple(self, mock_record):
        data = {
            "project": self.project.slug,
            "name": "My Monitor",
            "type": "cron_job",
            "config": {"schedule_type": "crontab", "schedule": "@daily"},
        }
        response = self.get_success_response(self.organization.slug, **data)

        assert response.data["id"]

        monitor = Monitor.objects.get(guid=response.data["id"])
        assert monitor.organization_id == self.organization.id
        assert monitor.project_id == self.project.id
        assert monitor.name == "My Monitor"
        assert monitor.status == MonitorStatus.ACTIVE
        assert monitor.type == MonitorType.CRON_JOB
        assert monitor.config == {
            "schedule_type": ScheduleType.CRONTAB,
            "schedule": "0 0 * * *",
            "checkin_margin": None,
            "max_runtime": None,
        }

        self.project.refresh_from_db()
        assert self.project.flags.has_cron_monitors

        mock_record.assert_called_with(
            "first_cron_monitor.created",
            user_id=self.user.id,
            organization_id=self.organization.id,
            project_id=self.project.id,
        )
