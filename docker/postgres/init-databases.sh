#!/bin/bash
# Tạo database riêng cho từng service khi container Postgres khởi tạo lần đầu.
set -euo pipefail
for db in identity_db catalog_db commerce_db social_db crm_db; do
  echo "Tạo database $db"
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres <<-EOSQL
    SELECT 'CREATE DATABASE $db OWNER $POSTGRES_USER'
    WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '$db')\gexec
EOSQL
done
