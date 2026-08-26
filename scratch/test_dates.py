from datetime import date, timedelta

def get_profit_days(start_date: date, end_date: date) -> int:
    days = 0
    current = start_date
    while current <= end_date:
        if current.weekday() < 5:  # 0=Mon, 1=Tue, 2=Wed, 3=Thu, 4=Fri
            days += 1
        current += timedelta(days=1)
    return days

# Test case 1: Joined Wednesday, today is Saturday
d1 = date(2023, 10, 4) # Wed
d2 = date(2023, 10, 7) # Sat
print(f"Wed to Sat: {get_profit_days(d1, d2)} days (expected 3)")

# Test case 2: Last ROI was last Saturday, today is Saturday
d1 = date(2023, 9, 30) + timedelta(days=1) # Sun
d2 = date(2023, 10, 7) # Sat
print(f"Sun to Sat: {get_profit_days(d1, d2)} days (expected 5)")

# Test case 3: Joined Friday, today is Saturday
d1 = date(2023, 10, 6) # Fri
d2 = date(2023, 10, 7) # Sat
print(f"Fri to Sat: {get_profit_days(d1, d2)} days (expected 1)")
