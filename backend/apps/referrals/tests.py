from decimal import Decimal
from django.test import TestCase
from django.contrib.auth import get_user_model
from apps.referrals.models import ReferralRelationship, ReferralCommission

User = get_user_model()


class ReferralsModelTests(TestCase):
    def setUp(self):
        self.sponsor = User.objects.create_user(email='sponsor@example.com', username='sponsor')
        self.ref_user = User.objects.create_user(email='refuser@example.com', username='refuser', parent=self.sponsor)

    def test_referral_relationship_creation(self):
        rel = ReferralRelationship.objects.create(user=self.ref_user, sponsor=self.sponsor)
        self.assertEqual(rel.sponsor, self.sponsor)

    def test_referral_commission_creation(self):
        comm = ReferralCommission.objects.create(
            user=self.sponsor,
            from_user=self.ref_user,
            amount=Decimal('100.00'),
            level=1,
            commission_type=ReferralCommission.CommissionType.DIRECT
        )
        self.assertFalse(comm.is_paid)
        self.assertEqual(comm.amount, Decimal('100.00'))


from rest_framework.test import APITestCase
from rest_framework import status
from django.urls import reverse

class TeamViewTests(APITestCase):
    def setUp(self):
        self.top_user = User.objects.create_user(email='top@example.com', username='topuser', password='Pass123!')
        self.l1_user = User.objects.create_user(email='l1@example.com', username='l1user', password='Pass123!', parent=self.top_user)
        self.l2_user = User.objects.create_user(email='l2@example.com', username='l2user', password='Pass123!', parent=self.l1_user)
        self.l3_user = User.objects.create_user(email='l3@example.com', username='l3user', password='Pass123!', parent=self.l2_user)
        self.client.force_authenticate(user=self.top_user)

    def test_get_all_downline_levels(self):
        url = reverse('referral_team')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.data['results'] if 'results' in response.data else response.data
        self.assertEqual(len(results), 3)
        
        # Check levels
        emails_to_level = {m['email']: m['level'] for m in results}
        self.assertEqual(emails_to_level['l1@example.com'], 1)
        self.assertEqual(emails_to_level['l2@example.com'], 2)
        self.assertEqual(emails_to_level['l3@example.com'], 3)

    def test_filter_by_specific_level(self):
        url = reverse('referral_team')
        # Filter Level 2 only
        response = self.client.get(f"{url}?level=2")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.data['results'] if 'results' in response.data else response.data
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]['email'], 'l2@example.com')
        self.assertEqual(results[0]['level'], 2)
        self.assertEqual(results[0]['sponsor_email'], 'l1@example.com')


class LevelStatsViewTests(APITestCase):
    def setUp(self):
        self.top_user = User.objects.create_user(email='topstats@example.com', username='topstats', password='Pass123!')
        self.client.force_authenticate(user=self.top_user)

    def test_level_stats_separate_direct_and_roi_thresholds(self):
        url = reverse('referral_levels')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.data
        self.assertEqual(len(data), 5)

        # Expected direct requirements: 0, 2, 4, 6, 8
        # Expected ROI requirements: 2, 4, 6, 8, 10
        expected_dirs = [0, 2, 4, 6, 8]
        expected_rois = [2, 4, 6, 8, 10]

        for i, item in enumerate(data):
            self.assertEqual(item['level'], i + 1)
            self.assertEqual(item['dir_req'], expected_dirs[i])
            self.assertEqual(item['roi_req'], expected_rois[i])

        # Top user has 0 active directs: Level 1 direct is unlocked, ROI is locked
        self.assertTrue(data[0]['is_direct_unlocked'])
        self.assertFalse(data[0]['is_roi_unlocked'])

