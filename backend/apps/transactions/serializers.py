from decimal import Decimal
from rest_framework import serializers
from .models import Deposit, Withdrawal, NetworkChoices


class DepositSerializer(serializers.ModelSerializer):
    class Meta:
        model = Deposit
        fields = [
            'id', 'amount', 'network', 'sender_wallet_address',
            'txn_hash', 'payment_proof', 'status', 'reviewed_at',
            'notes', 'created_at',
        ]
        read_only_fields = ['id', 'status', 'reviewed_at', 'notes', 'created_at']

    def create(self, validated_data):
        validated_data['user'] = self.context['request'].user
        return super().create(validated_data)


class WithdrawalSerializer(serializers.ModelSerializer):
    class Meta:
        model = Withdrawal
        fields = [
            'id', 'amount', 'withdrawal_type', 'fee', 'capital_charge', 'net_amount',
            'network', 'wallet_address', 'txn_hash', 'status', 'reviewed_at',
            'notes', 'created_at',
        ]
        read_only_fields = [
            'id', 'fee', 'capital_charge', 'net_amount', 'txn_hash',
            'status', 'reviewed_at', 'notes', 'created_at',
        ]

    def validate(self, attrs):
        from apps.core.models import PlatformSettings
        withdrawal_type = attrs.get('withdrawal_type', Withdrawal.WithdrawalType.PROFIT)
        amount = attrs['amount']

        if withdrawal_type == Withdrawal.WithdrawalType.CAPITAL:
            raise serializers.ValidationError(
                {'withdrawal_type': 'Capital withdrawals are temporarily disabled.'}
            )

        min_withdrawal = Decimal(PlatformSettings.get('MIN_PROFIT_WITHDRAWAL', '10.00'))
        fee = Decimal(PlatformSettings.get('PROFIT_WITHDRAWAL_FEE', '1.00'))
        capital_charge = Decimal('0.00')
        if amount < min_withdrawal:
            raise serializers.ValidationError(
                {'amount': f'Minimum withdrawal is ${min_withdrawal}.'}
            )

        net_amount = amount - fee - capital_charge
        if net_amount <= Decimal('0.00'):
            raise serializers.ValidationError({'amount': 'Net amount after fees must be greater than 0.'})

        # Check wallet balance
        user = self.context['request'].user
        try:
            wallet = user.wallet
            total_deduction = amount
            if wallet.balance < total_deduction:
                raise serializers.ValidationError(
                    {'amount': f'Insufficient wallet balance. Available: ${wallet.balance}'}
                )
        except Exception:
            raise serializers.ValidationError({'amount': 'Could not verify wallet balance.'})

        attrs['fee'] = fee
        attrs['capital_charge'] = capital_charge
        attrs['net_amount'] = net_amount
        return attrs

    def create(self, validated_data):
        validated_data['user'] = self.context['request'].user
        return super().create(validated_data)
