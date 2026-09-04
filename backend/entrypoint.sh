#!/bin/sh
set -e

echo "==> Waiting for database..."
# Wait until postgres is accepting connections
until python -c "import dj_database_url, psycopg2; u = dj_database_url.config(); psycopg2.connect(dbname=u['NAME'], user=u['USER'], password=u['PASSWORD'], host=u['HOST'], port=u['PORT'])" 2>/dev/null; do
  sleep 1
done
echo "==> Database is ready."

echo "==> Running migrations..."
python manage.py migrate --noinput

echo "==> Ensuring superuser exists..."
python -c "
import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', os.getenv('DJANGO_SETTINGS_MODULE', 'config.settings.production'))
django.setup()
from django.contrib.auth import get_user_model
User = get_user_model()
email = os.getenv('DJANGO_SUPERUSER_EMAIL', 'admin@finovo.com')
username = os.getenv('DJANGO_SUPERUSER_USERNAME', 'admin')
password = os.getenv('DJANGO_SUPERUSER_PASSWORD')
if password and not User.objects.filter(email=email).exists():
    User.objects.create_superuser(email=email, username=username, password=password)
    print(f'==> Superuser {email} created successfully.')
elif User.objects.filter(email=email).exists():
    print(f'==> Superuser {email} already exists.')
else:
    print('==> DJANGO_SUPERUSER_PASSWORD not set, skipping superuser creation.')
"

echo "==> Collecting static files..."
python manage.py collectstatic --noinput --clear

echo "==> Starting server..."
exec "$@"
