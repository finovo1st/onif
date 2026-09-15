from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0007_user_withdrawal_otp_user_withdrawal_otp_expiry'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='is_demo',
            field=models.BooleanField(
                db_index=True,
                default=False,
                help_text='Designates whether this is an isolated simulated demo account completely excluded from platform metrics and automation.',
                verbose_name='Is Demo Account',
            ),
        ),
    ]
