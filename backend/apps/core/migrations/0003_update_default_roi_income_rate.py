"""
Data migration: update default ROI_INCOME_RATE in PlatformSettings to 75.00%.
"""
from django.db import migrations


def update_roi_income_rate(apps, schema_editor):
    PlatformSettings = apps.get_model('core', 'PlatformSettings')
    PlatformSettings.objects.filter(key='ROI_INCOME_RATE').update(value='75.00')


def reverse_roi_income_rate(apps, schema_editor):
    PlatformSettings = apps.get_model('core', 'PlatformSettings')
    PlatformSettings.objects.filter(key='ROI_INCOME_RATE').update(value='1.50')


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0002_seed_platform_settings'),
    ]

    operations = [
        migrations.RunPython(update_roi_income_rate, reverse_code=reverse_roi_income_rate),
    ]
