"""
Data migration: remove unused and obsolete PlatformSettings keys.

Removes keys superseded by Plan models (MAX_TOTAL_RETURN, MIN_INVESTMENT, NET_PROFIT),
disabled capital withdrawal keys (MIN_CAPITAL_WITHDRAWAL, CAPITAL_WITHDRAWAL_FEE),
and legacy fallback level unlock keys (LEVEL1_UNLOCK_DIRECTS ... LEVEL5_UNLOCK_DIRECTS).
"""
from django.db import migrations

OBSOLETE_KEYS = [
    'MAX_TOTAL_RETURN',
    'MIN_INVESTMENT',
    'NET_PROFIT',
    'MIN_CAPITAL_WITHDRAWAL',
    'CAPITAL_WITHDRAWAL_FEE',
    'LEVEL1_UNLOCK_DIRECTS',
    'LEVEL2_UNLOCK_DIRECTS',
    'LEVEL3_UNLOCK_DIRECTS',
    'LEVEL4_UNLOCK_DIRECTS',
    'LEVEL5_UNLOCK_DIRECTS',
]


def cleanup_unused_settings(apps, schema_editor):
    PlatformSettings = apps.get_model('core', 'PlatformSettings')
    PlatformSettings.objects.filter(key__in=OBSOLETE_KEYS).delete()


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0005_update_roi_income_rate_to_18_75'),
    ]

    operations = [
        migrations.RunPython(cleanup_unused_settings, reverse_code=noop),
    ]
