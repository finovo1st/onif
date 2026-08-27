"""
Data migration: update default ROI_INCOME_RATE in PlatformSettings to 18.75%.
"""
from django.db import migrations


def update_roi_income_rate(apps, schema_editor):
    PlatformSettings = apps.get_model('core', 'PlatformSettings')
    PlatformSettings.objects.filter(key='ROI_INCOME_RATE').update(value='18.75')


def revert_roi_income_rate(apps, schema_editor):
    PlatformSettings = apps.get_model('core', 'PlatformSettings')
    PlatformSettings.objects.filter(key='ROI_INCOME_RATE').update(value='75.00')


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0004_separate_level_settings'),
    ]

    operations = [
        migrations.RunPython(update_roi_income_rate, reverse_code=revert_roi_income_rate),
    ]
