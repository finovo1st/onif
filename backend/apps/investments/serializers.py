from decimal import Decimal
from django.utils import timezone
from rest_framework import serializers
from .models import Plan, Investment


class PlanSerializer(serializers.ModelSerializer):
    class Meta:
        model = Plan
        fields = [
            'id', 'name', 'description', 'cost', 'trading_capital',
            'max_return_factor', 'max_total_return', 'weekly_roi_rate', 'duration_weeks',
        ]
        read_only_fields = fields


class InvestmentSerializer(serializers.ModelSerializer):
    plan_name = serializers.CharField(source='plan.name', read_only=True)
    remaining_return = serializers.DecimalField(max_digits=18, decimal_places=2, read_only=True)
    profit = serializers.DecimalField(max_digits=18, decimal_places=2, read_only=True)
    deposit_proof_url = serializers.SerializerMethodField()

    class Meta:
        model = Investment
        fields = [
            'id', 'plan', 'plan_name', 'cost', 'trading_capital', 'amount',
            'max_return', 'total_credited', 'remaining_return', 'profit', 'status',
            'deposit_network', 'deposit_txn_hash', 'deposit_sender_address',
            'deposit_proof', 'deposit_proof_url', 'deposit_submitted_at',
            'start_date', 'end_date', 'last_roi_date', 'created_at',
        ]
        read_only_fields = [
            'id', 'plan_name', 'cost', 'trading_capital', 'max_return', 'total_credited', 'remaining_return',
            'profit', 'status', 'deposit_proof_url', 'deposit_submitted_at',
            'start_date', 'end_date', 'last_roi_date', 'created_at',
        ]

    def get_deposit_proof_url(self, obj) -> str | None:
        if obj.deposit_proof:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.deposit_proof.url)
            return obj.deposit_proof.url
        return None


class InvestmentCreateSerializer(serializers.ModelSerializer):
    """
    Serializer for creating a new investment.

    The user picks a plan (which has a fixed cost and trading capital)
    and provides deposit proof in the same request.
    """
    amount = serializers.DecimalField(max_digits=18, decimal_places=2, required=False)
    cost = serializers.DecimalField(max_digits=18, decimal_places=2, required=False)

    class Meta:
        model = Investment
        fields = [
            'plan', 'cost', 'amount',
            'deposit_network', 'deposit_txn_hash',
            'deposit_sender_address', 'deposit_proof',
        ]

    def validate_deposit_network(self, value):
        if not value:
            raise serializers.ValidationError('Deposit network is required.')
        return value

    def validate(self, attrs):
        user = self.context['request'].user
        if user.kyc_status != user.KYCStatus.APPROVED:
            raise serializers.ValidationError(
                'KYC verification required. You must submit your identity documents and get your KYC approved before purchasing an investment package.'
            )

        plan = attrs['plan']

        if not plan.is_active:
            raise serializers.ValidationError({'plan': 'This investment plan is not currently active.'})

        if not attrs.get('deposit_txn_hash') and not attrs.get('deposit_proof'):
            raise serializers.ValidationError(
                'Please provide either a transaction hash or a deposit proof screenshot.'
            )

        return attrs

    def create(self, validated_data):
        plan = validated_data['plan']
        user = self.context['request'].user
        cost = validated_data.get('cost') or validated_data.get('amount') or plan.cost
        trading_capital = plan.trading_capital
        max_return = plan.max_total_return if plan.max_total_return else (trading_capital * plan.max_return_factor)

        return Investment.objects.create(
            user=user,
            plan=plan,
            cost=cost,
            trading_capital=trading_capital,
            amount=cost,
            max_return=max_return,
            status=Investment.Status.DEPOSIT_PENDING,
            deposit_network=validated_data.get('deposit_network', ''),
            deposit_txn_hash=validated_data.get('deposit_txn_hash', ''),
            deposit_sender_address=validated_data.get('deposit_sender_address', ''),
            deposit_proof=validated_data.get('deposit_proof'),
            deposit_submitted_at=timezone.now(),
        )
