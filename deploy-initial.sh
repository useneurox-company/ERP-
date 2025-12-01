#!/bin/bash

# Initial Server Setup Script for Emerald ERP
# Run this script on a fresh Ubuntu server

set -e

echo "🚀 Starting Emerald ERP Initial Server Setup"

# Update system packages
echo "📦 Updating system packages..."
apt-get update
apt-get upgrade -y

# Install essential tools
echo "🔧 Installing essential tools..."
apt-get install -y curl wget git vim htop build-essential

# Install Node.js 20
echo "📦 Installing Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# Install PM2 globally
echo "📦 Installing PM2..."
npm install -g pm2

# Install PostgreSQL
echo "🐘 Installing PostgreSQL..."
apt-get install -y postgresql postgresql-contrib

# Configure PostgreSQL
echo "🔧 Configuring PostgreSQL..."
sudo -u postgres psql << EOF
CREATE USER emerald_user WITH PASSWORD 'EmeraldSecure2025!';
CREATE DATABASE emerald_erp OWNER emerald_user;
GRANT ALL PRIVILEGES ON DATABASE emerald_erp TO emerald_user;
EOF

# Install Nginx
echo "🌐 Installing Nginx..."
apt-get install -y nginx

# Install Certbot for SSL
echo "🔒 Installing Certbot..."
apt-get install -y certbot python3-certbot-nginx

# Create application directory
echo "📁 Creating application directory..."
mkdir -p /var/www/emerald-erp
cd /var/www/emerald-erp

# Clone repository
echo "📥 Cloning repository..."
git clone https://github.com/NX-company/Emerald-ERP.git .

# Create .env file
echo "⚙️ Creating environment configuration..."
cat > .env << 'EOL'
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://emerald_user:EmeraldSecure2025!@localhost:5432/emerald_erp
SESSION_SECRET=$(openssl rand -base64 64 | tr -d '\n')
ADMIN_PASSWORD=Bereg2025
UPLOAD_DIR=/var/www/emerald-erp/attached_assets
LOG_LEVEL=info
EOL

# Create upload directory
mkdir -p /var/www/emerald-erp/attached_assets
chown -R www-data:www-data /var/www/emerald-erp/attached_assets

# Install dependencies
echo "📦 Installing application dependencies..."
npm ci

# Build application
echo "🔨 Building application..."
npm run build

# Run database migrations
echo "🗄️ Running database migrations..."
npm run db:generate || true
npm run db:push

# Run seed script
echo "🌱 Seeding database..."
npm run db:seed

# Configure Nginx
echo "🌐 Configuring Nginx..."
cat > /etc/nginx/sites-available/emerald-erp << 'EOL'
server {
    listen 80;
    server_name 147.45.146.149;

    client_max_body_size 500M;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /attached_assets {
        alias /var/www/emerald-erp/attached_assets;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
EOL

# Enable site
ln -sf /etc/nginx/sites-available/emerald-erp /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test and reload Nginx
nginx -t
systemctl reload nginx

# Start application with PM2
echo "🚀 Starting application with PM2..."
pm2 start ecosystem.config.js
pm2 save
pm2 startup systemd -u root --hp /root

# Setup firewall
echo "🔥 Configuring firewall..."
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 3000/tcp
echo "y" | ufw enable

# Create backup script
echo "💾 Creating backup script..."
cat > /root/backup-emerald.sh << 'EOL'
#!/bin/bash
BACKUP_DIR="/var/backups/emerald-erp"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR

# Backup database
sudo -u postgres pg_dump emerald_erp | gzip > $BACKUP_DIR/emerald_erp_$DATE.sql.gz

# Backup uploads
tar -czf $BACKUP_DIR/uploads_$DATE.tar.gz /var/www/emerald-erp/attached_assets

# Keep only last 7 days of backups
find $BACKUP_DIR -type f -mtime +7 -delete

echo "Backup completed: $DATE"
EOL
chmod +x /root/backup-emerald.sh

# Add backup to crontab
echo "⏰ Setting up daily backups..."
(crontab -l 2>/dev/null; echo "0 2 * * * /root/backup-emerald.sh") | crontab -

echo "✅ Initial server setup completed!"
echo ""
echo "📝 Important information:"
echo "   Database: emerald_erp"
echo "   Database User: emerald_user"
echo "   Database Password: EmeraldSecure2025!"
echo "   Admin Username: Admin"
echo "   Admin Password: Bereg2025"
echo "   Application URL: http://147.45.146.149"
echo ""
echo "🔐 Security recommendations:"
echo "   1. Change database password in production"
echo "   2. Set up SSL certificate with a domain name"
echo "   3. Configure proper firewall rules"
echo "   4. Set up monitoring (e.g., with Prometheus/Grafana)"
echo ""
echo "📦 PM2 commands:"
echo "   pm2 status       - Check application status"
echo "   pm2 logs         - View application logs"
echo "   pm2 restart all  - Restart application"
echo "   pm2 monit        - Monitor application"