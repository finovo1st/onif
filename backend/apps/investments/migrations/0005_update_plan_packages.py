from decimal import Decimal
import django.core.validators
from django.db import migrations, models


def seed_packages(apps, schema_editor):
    Plan = apps.get_model('investments', 'Plan')
    packages_data = [
        {
            'name': 'Package 1',
            'cost': Decimal('120.00'),
            'trading_capital': Decimal('100.00'),
            'max_return_factor': Decimal('3.00'),
            'max_total_return': Decimal('350.00'),
            'weekly_roi_rate': Decimal('3.00'),
            'duration_weeks': 0,
            'is_active': True,
        },
        {
            'name': 'Package 2',
            'cost': Decimal('350.00'),
            'trading_capital': Decimal('300.00'),
            'max_return_factor': Decimal('3.00'),
            'max_total_return': Decimal('1000.00'),
            'weekly_roi_rate': Decimal('3.00'),
            'duration_weeks': 0,
            'is_active': True,
        },
        {
            'name': 'Package 3',
            'cost': Decimal('575.00'),
            'trading_capital': Decimal('500.00'),
            'max_return_factor': Decimal('3.00'),
            'max_total_return': Decimal('1700.00'),
            'weekly_roi_rate': Decimal('3.00'),
            'duration_weeks': 0,
            'is_active': True,
        },
        {
            'name': 'Package 4',
            'cost': Decimal('1100.00'),
            'trading_capital': Decimal('1000.00'),
            'max_return_factor': Decimal('3.00'),
            'max_total_return': Decimal('3300.00'),
            'weekly_roi_rate': Decimal('3.00'),
            'duration_weeks': 0,
            'is_active': True,
        },
        {
            'name': 'Package 5',
            'cost': Decimal('5500.00'),
            'trading_capital': Decimal('5000.00'),
            'max_return_factor': Decimal('3.00'),
            'max_total_return': Decimal('16500.00'),
            'weekly_roi_rate': Decimal('3.00'),
            'duration_weeks': 0,
            'is_active': True,
        },
        {
            'name': 'Package 6',
            'cost': Decimal('11000.00'),
            'trading_capital': Decimal('10000.00'),
            'max_return_factor': Decimal('3.00'),
            'max_total_return': Decimal('33000.00'),
            'weekly_roi_rate': Decimal('3.00'),
            'duration_weeks': 0,
            'is_active': True,
        },
    ]

    for data in packages_data:
        Plan.objects.update_or_create(
            name=data['name'],
            defaults=data
        )


class Migration(migrations.Migration):

    dependencies = [
        ('investments', '0004_remove_investment_amount_and_more'),
    ]

    operations = [
        migrations.AlterModelOptions(
            name='plan',
            options={'ordering': ['cost'], 'verbose_name': 'Investment Plan', 'verbose_name_plural': 'Investment Plans'},
        ),
        migrations.AddField(
            model_name='investment',
            name='amount',
            field=models.DecimalField(decimal_places=2, default=Decimal('120.00'), help_text='Legacy field / synced with cost.', max_digits=18, validators=[django.core.validators.MinValueValidator(Decimal('0.01'))], verbose_name='Principal Amount ($)'),
        ),
        migrations.AddField(
            model_name='plan',
            name='max_total_return',
            field=models.DecimalField(decimal_places=2, default=Decimal('350.00'), help_text='Investment stops crediting once this amount is reached. Default: $350', max_digits=18, validators=[django.core.validators.MinValueValidator(Decimal('0.01'))], verbose_name='Maximum Total Return ($) (Capital Included)'),
        ),
        migrations.RunPython(seed_packages, migrations.RunPython.noop),
    ]
