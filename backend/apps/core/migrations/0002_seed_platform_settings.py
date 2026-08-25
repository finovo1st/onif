"""
Data migration: seed PlatformSettings with default FINOVO business constants.

All values are admin-editable in the Django admin panel without code changes.
"""
from django.db import migrations


DEFAULT_SETTINGS = [
    # Investment limits
    ('MIN_INVESTMENT',           '120.00',  'Minimum investment amount in USD'),
    ('MAX_TOTAL_RETURN',         '350.00',  'Maximum total return per investment (capital + profit) in USD'),
    ('NET_PROFIT',               '230.00',  'Net profit per investment cycle in USD'),
    # Withdrawal
    ('MIN_PROFIT_WITHDRAWAL',    '10.00',   'Minimum profit/wallet withdrawal amount in USD'),
    ('PROFIT_WITHDRAWAL_FEE',    '1.00',    'Flat fee per profit/wallet withdrawal transaction in USD'),
    ('MIN_CAPITAL_WITHDRAWAL',   '100.00',  'Minimum capital withdrawal amount in USD'),
    ('CAPITAL_WITHDRAWAL_FEE',   '10.00',   'Fund-management charge for capital withdrawal in USD'),
    # Income rates (percentage)
    ('DIRECT_INCOME_RATE',       '2.00',    'Direct income rate per referral level (%)'),
    ('ROI_INCOME_RATE',          '1.50',    'ROI income rate per referral level (%)'),
    # Referral levels
    ('MAX_REFERRAL_LEVELS',      '5',       'Maximum referral income depth levels'),
    ('LEVEL1_UNLOCK_DIRECTS',    '2',       'Active direct members required to unlock Level 1 income'),
    ('LEVEL2_UNLOCK_DIRECTS',    '4',       'Active direct members required to unlock Level 2 income'),
    ('LEVEL3_UNLOCK_DIRECTS',    '6',       'Active direct members required to unlock Level 3 income'),
    ('LEVEL4_UNLOCK_DIRECTS',    '8',       'Active direct members required to unlock Level 4 income'),
    ('LEVEL5_UNLOCK_DIRECTS',    '10',      'Active direct members required to unlock Level 5 income'),
    # ROI distribution schedule
    ('ROI_DISTRIBUTION_DAY',     '5',       'Weekday for ROI distribution: 0=Mon … 5=Sat, 6=Sun'),
    # Supported networks
    ('SUPPORTED_NETWORKS',       'BEP20,TRC20', 'Comma-separated list of supported crypto networks'),
    # Company Deposit Wallets & QR Codes
    ('COMPANY_WALLET_BEP20',     '0x71C8bf7B67295F2797e883FffFa7617bFF524b08', 'Company USDT (BEP20 BSC) deposit wallet address'),
    ('COMPANY_WALLET_TRC20',     'TYDzsYUE288J1EX9732B8kG89kEGY82kL9',         'Company USDT (TRC20 TRON) deposit wallet address'),
    ('COMPANY_WALLET_BEP20_QR',  '',                                           'Custom QR code image or data URL for BEP20 deposit (leave empty for auto-generated)'),
    ('COMPANY_WALLET_TRC20_QR',  '',                                           'Custom QR code image or data URL for TRC20 deposit (leave empty for auto-generated)'),
]


def seed_settings(apps, schema_editor):
    PlatformSettings = apps.get_model('core', 'PlatformSettings')
    for key, value, description in DEFAULT_SETTINGS:
        PlatformSettings.objects.get_or_create(
            key=key,
            defaults={'value': value, 'description': description},
        )


def unseed_settings(apps, schema_editor):
    PlatformSettings = apps.get_model('core', 'PlatformSettings')
    keys = [row[0] for row in DEFAULT_SETTINGS]
    PlatformSettings.objects.filter(key__in=keys).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(seed_settings, reverse_code=unseed_settings),
    ]
