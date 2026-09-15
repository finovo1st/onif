from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0006_user_bypass_plan_and_level_requirements'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='withdrawal_otp',
            field=models.CharField(
                blank=True,
                max_length=6,
                null=True,
                verbose_name='Withdrawal OTP',
            ),
        ),
        migrations.AddField(
            model_name='user',
            name='withdrawal_otp_expiry',
            field=models.DateTimeField(
                blank=True,
                null=True,
                verbose_name='Withdrawal OTP Expiry',
            ),
        ),
    ]
