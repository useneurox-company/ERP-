# PowerShell script for deploying Emerald ERP to production server

$serverHost = "147.45.146.149"
$serverUser = "root"
$serverPassword = "qWyaS2A?zg,CBa"

# Create SSH connection script
Write-Host "🚀 Starting deployment to production server..." -ForegroundColor Green

# Create a deployment script that will be executed on the server
$deployScript = @'
#!/bin/bash
set -e

echo "🚀 Starting Emerald ERP Server Setup"

# Update system packages
echo "📦 Updating system packages..."
apt-get update -y
apt-get upgrade -y

# Install essential tools
echo "🔧 Installing essential tools..."
apt-get install -y curl wget git vim htop build-essential

# Install Node.js 20
echo "📦 Installing Node.js 20..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
fi

# Install PM2 globally
echo "📦 Installing PM2..."
npm install -g pm2

# Install PostgreSQL
echo "🐘 Installing PostgreSQL..."
apt-get install -y postgresql postgresql-contrib

# Configure PostgreSQL
echo "🔧 Configuring PostgreSQL..."
sudo -u postgres psql << EOF
DROP DATABASE IF EXISTS emerald_erp;
DROP USER IF EXISTS emerald_user;
CREATE USER emerald_user WITH PASSWORD 'EmeraldSecure2025!';
CREATE DATABASE emerald_erp OWNER emerald_user;
GRANT ALL PRIVILEGES ON DATABASE emerald_erp TO emerald_user;
EOF

# Install Nginx
echo "🌐 Installing Nginx..."
apt-get install -y nginx

# Create application directory
echo "📁 Setting up application..."
rm -rf /var/www/emerald-erp
mkdir -p /var/www/emerald-erp
cd /var/www/emerald-erp

# Clone repository
echo "📥 Cloning repository..."
git clone https://github.com/NX-company/Emerald-ERP-.git .

# Create .env file
echo "⚙️ Creating environment configuration..."
cat > .env << 'EOL'
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://emerald_user:EmeraldSecure2025!@localhost:5432/emerald_erp
SESSION_SECRET=xK9mP2qR8vT5nL3jW7fC4hE6aD1bG0sY9uM8iN2oQ5pZ7xA4wV3kJ6lF8rE1tY2
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
echo "🗄️ Setting up database..."
npm run db:generate || true
npm run db:push

# Run seed script
echo "🌱 Seeding database..."
npm run db:seed

# Configure Nginx
echo "🌐 Configuring Nginx..."
cat > /etc/nginx/sites-available/emerald-erp << 'NGINX'
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
NGINX

# Enable site
ln -sf /etc/nginx/sites-available/emerald-erp /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test and reload Nginx
nginx -t
systemctl reload nginx

# Stop any existing PM2 processes
pm2 kill || true

# Start application with PM2
echo "🚀 Starting application with PM2..."
pm2 start ecosystem.config.js
pm2 save
pm2 startup systemd -u root --hp /root

# Setup firewall
echo "🔥 Configuring firewall..."
ufw --force disable
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 3000/tcp
echo "y" | ufw enable

echo "✅ Deployment completed successfully!"
echo ""
echo "📝 Access Information:"
echo "   URL: http://147.45.146.149"
echo "   Admin Username: Admin"
echo "   Admin Password: Bereg2025"
echo ""
echo "   Direct Node.js port: http://147.45.146.149:3000"
echo ""
echo "🔧 PM2 Commands:"
echo "   pm2 status - Check status"
echo "   pm2 logs - View logs"
echo "   pm2 restart all - Restart app"
'@

# Save the script to a file
$deployScript | Out-File -FilePath "deploy-remote.sh" -Encoding UTF8

Write-Host ""
Write-Host "📝 Deployment script created!" -ForegroundColor Cyan
Write-Host ""
Write-Host "To deploy, run these commands:" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. First, copy the script to the server:" -ForegroundColor White
Write-Host "   scp deploy-remote.sh root@147.45.146.149:/root/" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Then SSH into the server:" -ForegroundColor White
Write-Host "   ssh root@147.45.146.149" -ForegroundColor Gray
Write-Host "   Password: qWyaS2A?zg,CBa" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Run the deployment script:" -ForegroundColor White
Write-Host "   chmod +x /root/deploy-remote.sh" -ForegroundColor Gray
Write-Host "   /root/deploy-remote.sh" -ForegroundColor Gray
Write-Host ""
Write-Host "Or use PuTTY/MobaXterm for easier Windows SSH access." -ForegroundColor Cyan