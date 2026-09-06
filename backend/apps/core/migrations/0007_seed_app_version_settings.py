"""
Data migration: seed PlatformSettings with mobile app version control settings.

Enables administrators to configure patch releases, minimum required versions,
direct APK download URLs, release notes, and force update flags without redeployment.
"""
from django.db import migrations


APP_VERSION_SETTINGS = [
    ('APP_LATEST_VERSION',       '1.0.0',                                      'Latest published mobile app version (e.g. 1.0.1)'),
    ('APP_MIN_REQUIRED_VERSION', '1.0.0',                                      'Minimum supported mobile app version required to use platform'),
    ('APP_DOWNLOAD_URL',         'https://finovo1.com',                        'Direct download URL for latest Android APK package'),
    ('APP_RELEASE_NOTES',        'Regular stability enhancements and performance optimizations.', 'Summary of patch release changes shown to mobile users'),
    ('APP_FORCE_UPDATE',         'false',                                      'Set to "true" to block app usage until user installs latest update'),
]


def seed_app_version_settings(apps, schema_editor):
    PlatformSettings = apps.get_model('core', 'PlatformSettings')
    for key, value, description in APP_VERSION_SETTINGS:
        PlatformSettings.objects.get_or_create(
            key=key,
            defaults={'value': value, 'description': description},
        )


def unseed_app_version_settings(apps, schema_editor):
    PlatformSettings = apps.get_model('core', 'PlatformSettings')
    keys = [item[0] for item in APP_VERSION_SETTINGS]
    PlatformSettings.objects.filter(key__in=keys).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0006_cleanup_unused_platform_settings'),
    ]

    operations = [
        migrations.RunPython(seed_app_version_settings, reverse_code=unseed_app_version_settings),
    ]
