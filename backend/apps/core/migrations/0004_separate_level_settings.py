"""
Data migration: seed DIR_LEVEL and ROI_LEVEL platform settings for separate referral requirements.
"""
from django.db import migrations


LEVEL_SETTINGS = [
    # Direct Income level unlock criteria (0, 2, 4, 6, 8)
    ('DIR_LEVEL1_UNLOCK_DIRECTS', '0',  'Active direct members required to unlock Level 1 Direct Income'),
    ('DIR_LEVEL2_UNLOCK_DIRECTS', '2',  'Active direct members required to unlock Level 2 Direct Income'),
    ('DIR_LEVEL3_UNLOCK_DIRECTS', '4',  'Active direct members required to unlock Level 3 Direct Income'),
    ('DIR_LEVEL4_UNLOCK_DIRECTS', '6',  'Active direct members required to unlock Level 4 Direct Income'),
    ('DIR_LEVEL5_UNLOCK_DIRECTS', '8',  'Active direct members required to unlock Level 5 Direct Income'),
    # ROI Referral Income level unlock criteria (2, 4, 6, 8, 10)
    ('ROI_LEVEL1_UNLOCK_DIRECTS', '2',  'Active direct members required to unlock Level 1 ROI Referral Income'),
    ('ROI_LEVEL2_UNLOCK_DIRECTS', '4',  'Active direct members required to unlock Level 2 ROI Referral Income'),
    ('ROI_LEVEL3_UNLOCK_DIRECTS', '6',  'Active direct members required to unlock Level 3 ROI Referral Income'),
    ('ROI_LEVEL4_UNLOCK_DIRECTS', '8',  'Active direct members required to unlock Level 4 ROI Referral Income'),
    ('ROI_LEVEL5_UNLOCK_DIRECTS', '10', 'Active direct members required to unlock Level 5 ROI Referral Income'),
]


def seed_level_settings(apps, schema_editor):
    PlatformSettings = apps.get_model('core', 'PlatformSettings')
    for key, value, description in LEVEL_SETTINGS:
        PlatformSettings.objects.update_or_create(
            key=key,
            defaults={'value': value, 'description': description},
        )


def unseed_level_settings(apps, schema_editor):
    PlatformSettings = apps.get_model('core', 'PlatformSettings')
    keys = [row[0] for row in LEVEL_SETTINGS]
    PlatformSettings.objects.filter(key__in=keys).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0003_update_default_roi_income_rate'),
    ]

    operations = [
        migrations.RunPython(seed_level_settings, reverse_code=unseed_level_settings),
    ]
